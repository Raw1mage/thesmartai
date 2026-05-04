# Tasks: attachment-lifecycle

> Execution surface: `/home/pkcs12/projects/opencode-worktrees/attachment-lifecycle` on branch `beta/attachment-lifecycle`.
> Spec writes (this file, design.md, etc.): mainRepo at `/home/pkcs12/projects/opencode`.
> Always `source .beta-env/activate.sh` before any `bun test` / `bun run` in beta worktree.

User-framed as a "small hotfix" — 3 implementation phases, no feature flag, direct-ship architecture.

> **Recalibration v2 (2026-05-04)**: discovered `repo-incoming-attachments` already owns binary lifecycle.
>
> **Recalibration v3 (2026-05-04)**: vision subagent text-summary is the architectural mismatch; main agent should inline image directly.
>
> **Recalibration v4 (2026-05-04, current)**: v3's "inline into user message + dehydrate-by-mutation" violates Phase B's "static-front, dynamic-back" cache locality discipline. **Image inline goes to preface trailing tier (BP4 zone), NEVER conversation history**. Conversation history bytes byte-stable forever. No mutation. No dehydrated/annotation flags. Per design.md DD-19 / DD-20 / DD-21.
>
> v3 implementation commits (`f39d70e71`..`8039fcf65`) reverted on beta. v4 task list below replaces v3 T.1..T.4.

## 0. Prerequisites

- [x] T.0.1 Create beta worktree (done 2026-05-04):
  ```
  git worktree add -b beta/attachment-lifecycle \
    /home/pkcs12/projects/opencode-worktrees/attachment-lifecycle main
  ```
- [x] T.0.2 Bootstrap `.beta-env/activate.sh` (XDG isolation pointed at the new worktree path); `theme/opencode.json` copied; `bun install` ran clean.
- [x] T.0.3 Baseline test sweep on `packages/opencode/src/session/` — 52 Phase A/B tests pass (matches main).
- [x] T.0.4 (NEW) Read [`specs/_archive/repo-incoming-attachments/`](../repo-incoming-attachments/) — confirm `attachment_ref.repo_path` is populated by `routeOversizedAttachment` for all NEW image uploads. Skip dehydration when `repo_path` is undefined (DD-15).

## 1. Phase T.1 — v4 Foundation: ExecutionIdentity schema + active set lifecycle

- [x] T.1.1 (v4) Extend `Session.ExecutionIdentity` Zod schema with `activeImageRefs?: z.array(z.string()).optional()` (DD-20). Backwards compatible — old sessions default undefined → empty array semantics. 4 roundtrip tests: absent / empty array / single entry / multiple entries.

- [x] T.1.2 (v4) Pure helper `packages/opencode/src/session/active-image-refs.ts` with three operations:
  - `addOnUpload(session, userMessage): string[]` — scan a freshly-committed user message for image attachment_ref parts (mime image/* + repo_path populated); return identifiers to add.
  - `addOnReread(session, filename): boolean` — push filename onto activeImageRefs; return true on success.
  - `drainAfterAssistant(session): string[]` — clear activeImageRefs; return what was drained for telemetry.
  - 8 unit tests cover each op + edge cases (no images / no repo_path / dedup / cap-N FIFO).

- [x] T.1.3 (v4) Tweaks knobs in `packages/opencode/src/config/tweaks.ts`:
  - `attachment_inline_enabled: boolean` (default true)
  - `attachment_active_set_max: number` (default 3, FIFO cap per R9 mitigation)
  - 4 tests cover defaults / disabled / custom cap / invalid range.

~~### v3 T.1.1/T.1.2/T.1.3 (SUPERSEDED 2026-05-04 by v4 T.1)~~
v3 added `dehydrated` + `annotation` fields to AttachmentRefPart, an `extractAnnotation` helper, and dehydration tweaks. All reverted; v4 doesn't need them — annotation lives in assistant message text, no dehydration flag.

## 2. Phase T.2 — v4 Behavior: preface trailing inliner + lifecycle wiring

- [x] T.2.1 (v4) Inline image emitter in `packages/opencode/src/session/context-preface.ts`:
  - New helper `buildActiveImageContentBlocks(activeImageRefs, sessionMessages, projectRoot): Array<{type:"file",url,mediaType,filename}>`
  - For each ref in activeImageRefs: find matching attachment_ref in conversation history; resolve absolute path via `IncomingPaths.projectRoot()` + `attachment_ref.repo_path`; read bytes; emit AI SDK file content block with data URI.
  - Skip silently (with telemetry) if file missing — don't break preface assembly.
  - 6 unit tests cover: 0 active / 1 active / 2 active / file-missing skip / mime variants / determinism.

- [x] T.2.2 (v4) Wire into `buildPreface(input)`: extend `BuildPrefaceInput` with optional `activeImageBlocks: Array<{...}>`; emit them as the LAST entries in `trailingExtras` (after lazy catalog / notices). Pure function, byte-deterministic given inputs.

- [x] T.2.3 (v4) Wire into `llm.ts` system+preface assembly path:
  - Read `session.execution.activeImageRefs` (new field per T.1.1)
  - Call `buildActiveImageContentBlocks(...)`
  - Pass to `buildPreface(...)` via the new `activeImageBlocks` field
  - 3 integration smoke tests: empty active set / 1 active image / 2 active images cumulative.

- [x] T.2.4 (v4) Lifecycle hooks:
  - **Add on upload**: in user message commit path (likely `Session.updateMessage` or upstream user-message-parts.ts), call `ActiveImageRefs.addOnUpload(...)` after committing.
  - **Drain after assistant**: in `processor.ts` post-completion site (same site v3 hook used), call `ActiveImageRefs.drainAfterAssistant(...)` (replacing the old dehydration call).
  - 6 tests cover: upload adds / drain removes / drain clears even on finish≠stop (R9 mitigation) / multiple uploads dedup / FIFO cap when exceeded / subagent doesn't inherit parent's active refs (R10).

- [x] T.2.1 Wire post-completion hook in `processor.ts`:
  - After assistant message reaches `finish="stop"`, scan parent user message for image `attachment_ref` parts
  - Skip if part already `dehydrated === true` (DD-5)
  - Skip if mime not `image/*` (DD-3 v1 scope)
  - Skip if `finish !== "stop"` (DD-10)
  - **Skip if `repo_path` is undefined** (DD-15 — pre-repo-incoming legacy attachment, no binary location to point reread at)
  - For each remaining: `extractAnnotation` → `Session.updatePart` setting `dehydrated=true` + `annotation` (`repo_path` and `sha256` already populated by repo-incoming, leave them alone) → emit telemetry. **No binary movement; binary already at `<worktree>/<repo_path>`.**

- [x] T.2.2 (revised v3 2026-05-04) Branch wire-format conversion in `MessageV2.toModelMessages` for `attachment_ref` parts. **Three branches** (per DD-17):
  - **Inline image** (NEW default): mime starts with `image/` AND `repo_path` populated AND `dehydrated !== true` AND model supports image input → read bytes from `<worktree>/<repo_path>` → emit `{type: "file", url: "data:<mime>;base64,...", mediaType: <mime>, filename: ...}` content block. Main multimodal agent receives the actual image.
  - **Dehydrated stub**: `dehydrated === true` → emit `{type: "text", text: <dehydrated_attachment filename="..." sha256="..." repo_path="...">annotation</dehydrated_attachment>}` (existing DD-8).
  - **Legacy fallback**: any other case (no `repo_path`, non-multimodal main, non-image mime) → emit existing routing-hint text (with softened language per DD-18: "If you want a focused vision-subagent analysis ...").
  - 8 tests cover: inline happy / dehydrated / legacy text fallback / non-multimodal model / non-image mime / read-failure on missing file / idempotency / model-capability detection.

- [x] T.2.3 (revised v3) Integration test: synthesize session with 1 user message + 1 image attachment (with `repo_path` populated) + 1 finished assistant message; verify:
  - **Pre-dehydration** turn N: toModelMessages emits inline `type: "file"` image block (NEW behavior) → assistant inlines image
  - **Hook** runs after `finish="stop"` → attachment_ref now has `dehydrated=true` + annotation populated
  - `repo_path` and `sha256` unchanged
  - File at `<worktree>/<repo_path>` untouched
  - **Post-dehydration** turn N+1: toModelMessages emits `<dehydrated_attachment>` text block instead of inline image → token saving realized

- [x] T.2.4 (NEW v3) **Model-capability detection helper**: a small predicate `modelSupportsInlineImage(model: Provider.Model): boolean` that returns true when the model's capabilities indicate image input support. Used by T.2.2 inline branch. Defaults conservatively (when capability info missing, fall back to text-routing). 4 tests covering Anthropic / OpenAI / Codex GPT-5.5 / Lite providers.

## 3. Phase T.3 — v4 RereadAttachmentTool (voucher)

- [x] T.3.1 (v4) New file `packages/opencode/src/tool/reread-attachment.ts`:
  - Tool name: `reread_attachment`
  - Input schema: `{filename: string}`
  - Body: validate filename matches an attachment_ref in current session messages with valid `repo_path`; call `ActiveImageRefs.addOnReread(session, filename)`; return `{type:"text", text:"Image '<filename>' queued for vision in your next turn."}`.
  - Error path: filename not found → `{type:"text", text:"<error: no attachment named ...>"}`.
  - 5 tests: happy / unknown filename / repo_path file missing / activeImageRefs FIFO cap / telemetry.
  - Tool description tells the model: "Queue a previously-attached image for inline viewing on your NEXT response. Use when an image's text reference doesn't give you enough info to answer."

- [x] T.3.2 (v4) Register tool in `packages/opencode/src/tool/index.ts` core registry.

- [x] T.3.3 (v4) Integration test: full flow upload → AI sees image inline turn N → AI responds → drain → AI calls reread on turn N+1 → image inlines on turn N+2.

~~### v3 T.3.x (SUPERSEDED — tool returned binary in tool result, putting image in conversation history)~~
v4 returns a "voucher" text string and queues the actual binary inlining for the next turn's preface trailing.

## 3-old. Phase T.3 — v3 RereadAttachmentTool (SUPERSEDED)
  - Tool name: `reread_attachment`
  - Input schema: `{filename: string}`
  - Body: walk session messages, find a `attachment_ref` with matching filename + `dehydrated=true` + `repo_path` populated; resolve absolute path via `IncomingPaths.projectRoot()` + part.repo_path; read bytes via `fs.readFile`. If found → return `{type: "image", url: data URI, est_tokens, byte_size}`; if file missing → `{error: "attachment_not_found", message: ...}`; if no matching dehydrated part → `{error: "attachment_not_found", message: ...}`.
  - 5 tests: happy (post-dehydration reread) / file deleted from repo / no matching part / multi-attachment match-by-filename / telemetry emit.

- [x] T.3.2 Register tool in `packages/opencode/src/tool/index.ts` core registry. Description tells model when to use:
  ```
  Re-read a previously dehydrated image attachment. Use when the <dehydrated_attachment> annotation is insufficient and you need to look at the original image content. Filename matches the original attachment filename (visible in the dehydrated_attachment tag).
  ```

- [x] T.3.3 Integration test: dehydrate (with `repo_path` populated) → call `reread_attachment(filename)` → confirm fresh image content returned, sourced from `<worktree>/<repo_path>`.

~~## 4. Phase T.4 — GarbageCollector + cron~~

**Removed by v2 recalibration 2026-05-04**. Per DD-4', binaries persist in `<worktree>/incoming/<filename>` for the lifetime of the project repo; cleanup is the user's choice via `git clean` / `.gitignore` / manual `rm`.

## 4. Phase T.4 — Vision subagent → opt-in (v3 2026-05-04)

Vision subagent stays available but stops being the default route for images. Per DD-18.

- [x] T.4.1 In `MessageV2.toModelMessages` legacy-fallback branch (T.2.2 third branch), soften the routing-hint language: was "Use the attachment tool with mode=read and agent=\"vision\" to dispatch to a vision reader"; new "If you want a focused vision-subagent analysis instead of inline reading, call attachment(mode=read, agent=vision)".

- [x] T.4.2 Update `attachment` tool's description (in tool registration) to reflect the new dispatch frequency: emphasize that the tool is for **opt-in** deep-analysis cases, not the default image-reading path.

- [x] T.4.3 Update `templates/prompts/agents/vision.txt` if needed to reflect new opt-in framing — but only if the existing prompt assumes it's the always-on path. Likely no change needed.

- [x] T.4.4 Verify subagent dispatch path still works end-to-end via existing tests (no regression). 2 smoke checks: (a) main agent calls attachment(mode=read, agent=vision) explicitly → vision subagent runs → text result returns; (b) lite provider with image attachment → falls back to legacy routing hint → main agent uses attachment tool → vision subagent runs.

## 5. Phase T.5 — Validation + finalize

- [x] T.5.1 Full test sweep on beta worktree: `bun test packages/opencode/src/session/ packages/opencode/src/provider/ packages/opencode/src/tool/` — confirm zero new regressions vs main baseline.
- [x] T.5.2 `bun run typecheck` no new errors (excluding pre-existing share-next.ts noise).
- [x] T.5.3 Manual smoke: in dev daemon, upload an image, observe response, then send another turn — confirm `attachment.dehydrated` log + token count drops in second turn's input.
- [x] T.5.4 Manual reread test: in dev session post-dehydration, ask model "look at the previous screenshot again" — observe model calls `reread_attachment` and gets image back.
- [x] T.5.5 Phase summary `docs/events/event_<YYYYMMDD>_attachment-lifecycle-landed.md` with commit hashes + observed token reduction.
- [x] T.5.6 Rebase to latest main; merge clean.
- [x] T.5.7 STOP for user finalize approval.

## 7. Phase T.7 — v5 Pure AI-opt-in (extend, 2026-05-04)

> Architectural shift per DD-22 / R10. Upload no longer auto-queues into activeImageRefs; AI sees an `<attached_images>` inventory in preface trailing and explicitly calls reread_attachment for the images it actually wants to see.

- [x] T.7.1 (v5) Disable the addOnUpload call in [prompt.ts:2419-2438](../../packages/opencode/src/session/prompt.ts#L2419) (the post-persistUserMessage hook). Either gate behind a debug-only flag or comment out + leave a `// v5: opt-in only — addOnUpload kept for future re-enable` marker. activeImageRefs now only grows via reread_attachment.

- [x] T.7.2 (v5) New helper `packages/opencode/src/session/attached-images-inventory.ts`:
  - `buildInventoryText(messages, activeImageRefs): string` — walks all session messages, collects image attachment_refs (mime image/* AND (session_path OR repo_path) populated), emits the `<attached_images count="N">…</attached_images>` text block per DD-22.1.
  - Returns empty string when 0 images (so caller can omit cleanly).
  - Newest-first ordering. Annotates `Active in this preface: …` based on activeImageRefs intersection.
  - 6 unit tests: empty / 1 image / multiple / dimensions present / sort order / active subset annotation.

- [x] T.7.3 (v5) Wire inventory text into llm.ts preface trailing assembly: append the inventory string into `prefaceInput.trailingExtras` (before existing extras) so it lands BEFORE any image content blocks.

- [x] T.7.4 (v5) Bump `attachment_active_set_max` default to 8 (was 3); range 1-50 (was 1-20). Per DD-22.2 — repurposed to bound AI-driven reread accumulation, no longer relevant to upload count.

- [x] T.7.5 (v5) Update `reread_attachment` tool description per DD-22.3: drop "previously-attached" framing, lead with "Fetch a session-attached image into your next response so you can see its pixels."

- [x] T.7.6 (v5) Smoke test: upload 5 images in one user message. Verify (a) activeImageRefs stays empty after upload commit, (b) next turn preface contains inventory listing all 5, (c) ZERO `{type:"file"}` blocks emitted in preface trailing, (d) total preface trailing token cost ≪ even one image's worth.

- [x] T.7.7 (v5) Update event doc `docs/events/event_2026-05-04_attachment-lifecycle-v4-landed.md` with v5 amendment section, OR write a new `event_2026-05-04_attachment-lifecycle-v5-opt-in.md` covering the pivot.

## 8. Phase T.8 — Future polish (backlog, NOT v5 blockers)

> Carried as plain bullet items (no checkboxes) so spec lifecycle gates don't conflate them with v5 acceptance.

- T.8.1 Tool rename `reread_attachment` → `view_attachment` once a major prompt cache reset is acceptable. The `reread_` framing implies "you saw it before"; `view_` is accurate for both first-view and re-view.
- T.8.2 Inventory dimensions/byte_size population — currently the inventory shows mime only because dimensions/byte_size aren't on attachment_ref by default. Decide whether to start populating them at upload time and surface in the inventory text.

## 6. Phase T.6 — Finalize + cleanup

- [x] T.6.1 `git merge --no-ff beta/attachment-lifecycle` into main (in mainRepo).
- [x] T.6.2 `plan-promote --to verified` then `--to living`.
- [x] T.6.3 `git worktree remove` + `git branch -d beta/attachment-lifecycle`.
- [x] T.6.4 Daemon restart (per `feedback_restart_daemon_consent` — pause and ask first).

## Dependencies between phases

- T.0 done — unblocks all
- T.1 (schema + annotator + tweaks) → T.2 (behavior consumes new schema). T.1.1+T.1.2+T.1.3+T.2.1 already shipped on beta; T.2.2 + T.2.3 + T.2.4 follow.
- T.2 (dehydration hook + inline serializer) → T.3 (reread tool depends on dehydrated parts existing)
- T.4 (vision opt-in) parallel to T.3 — both touch routing hint language
- ~~T.4 (GC)~~ removed under v2 recalibration; T.4 slot reused for vision-opt-in v3
- T.5 (validation) gate after T.1-T.4 all green
- T.6 (finalize) after user approval

## Stop gates

- ~~T.0.1 fail~~ T.0 已完成 2026-05-04
- T.5.7 STOP for user finalize approval
- T.6.4 daemon restart needs explicit user "重啟嗎？" consent
- Any test red → stop, fix, no skip
- Pre-repo-incoming legacy attachment (`repo_path` undefined) detected during T.2.1 hook design — confirm DD-15 skip behavior is correct, no test regression
