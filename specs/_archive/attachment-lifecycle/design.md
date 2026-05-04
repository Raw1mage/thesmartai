# Design: attachment-lifecycle

## Context

[`MessageV2.AttachmentRefPart`](../../packages/opencode/src/session/message-v2.ts) currently keeps the binary inline in conversation history (via `payload_json.url` data URI or filesystem path). Every `LLM.stream` call resends the binary. The session sqlite `attachments` table holds the `(ref_id, content BLOB)` reverse lookup. Real-world cost: 188K image tokens accumulated over 9 turns in `ses_211c853fcfferC149YUFem6mN4`.

Phase B (`prompt-cache-and-compaction-hardening`) hardened the cache prefix architecture but leaves attachment lifecycle untouched — attachments live in the conversation tail (BP4 zone) where every change invalidates the per-turn cache anyway, so cache mechanism alone can't solve this.

This spec adds a "dehydrate after read, retain on disk" lifecycle: assistant turn completes → image attachments collapse to text annotation in conversation history → binary moves to filesystem incoming staging → model can `reread_attachment` if needed → GC after TTL.

## Goals / Non-Goals

- ≥ 90% image token reduction after first read (per session, dedupe across turns)
- Re-read latency < 100ms (filesystem read is local)
- Zero schema migration required (all schema additions optional)
- Backwards compatible: old sessions with hydrated attachments continue to work
- v1 scope strictly images; PDF / text deferred

### Non-Goals

- See [spec.md Out-of-scope](./spec.md#out-of-scope-explicit)

## Decisions

- **DD-1** **Annotation = assistant turn's response text (verbatim, no extra LLM call)**.
  - Reason: zero extra cost; response text is the highest-fidelity record of what the model extracted from the image. User explicitly chose this on 2026-05-04.
  - Consequence: if response text is sparse, annotation is sparse. Acceptable for v1; v2 can add dedicated LLM annotator if measurements justify.
  - Alternative considered: dedicated tiny LLM call (200-500 token output per image) — rejected for v1 scope.

- ~~**DD-2** **Storage path = `~/.local/state/opencode/incoming/<sessionID>/<filename>`**, an XDG state-home subtree.~~ **(v1, SUPERSEDED 2026-05-04 by DD-2'; conflicts with already-implementing `repo-incoming-attachments` spec)**

- **DD-2'** **(v2, ADDED 2026-05-04)** **Reuse the existing `repo-incoming-attachments` storage**: binaries already live at `<session.project.worktree>/incoming/<filename>` via `IncomingPaths.projectRoot()`, written by `routeOversizedAttachment` at upload time. The `attachment_ref.repo_path` field already records this absolute-or-relative path.
  - Reason: `repo-incoming-attachments` (state=`implementing`, 2 of 4 phases checked) already owns the binary lifecycle — per-project repo storage with sha256 dedup + history JSONL. Inventing a parallel XDG store would duplicate the work and contradict the user's chosen "binary belongs to repo" mental model.
  - Consequence: attachment-lifecycle does NOT move binaries. Dehydration is a pure conversation-history rewrite — flip `attachment_ref.dehydrated=true` + populate `annotation`. The `repo_path` and `sha256` fields are already present on the part (added by repo-incoming phase 2.5\*) and remain pointing at the binary.
  - Source-of-truth for path resolution: `IncomingPaths` namespace in `packages/opencode/src/incoming/paths.ts`. We never call `IncomingPaths.write()` ourselves; the `repo_path` field is populated upstream.

- **DD-3** **Always dehydrate every image attachment in the just-completed turn** (no per-image granularity).
  - Reason: simple + predictable. Binary preserved for 7 days post-`session.deleted`, so AI can reread anything within window. User explicitly chose this on 2026-05-04.
  - Consequence: 100% of image attachments get the rewrite once `finish="stop"` reached. Image tokens drop from accumulating to flat-after-first-turn.
  - Alternative considered: scan response text for image references and only dehydrate referenced ones — rejected; reference detection is brittle and the binary is recoverable anyway.

- ~~**DD-4** **TTL = 7 days after `session.deleted`** with two GC triggers: daemon startup + daily cron timer.~~ **(v1, SUPERSEDED 2026-05-04 by DD-4'; GC mechanism moot under DD-2' reuse)**

- **DD-4' (v2, ADDED 2026-05-04)** **No GC needed**. Binaries persist in `<worktree>/incoming/<filename>` for the lifetime of the project repo. Cleanup is the user's choice (e.g. `git clean`, manual `rm`, or `.gitignore` decisions per `repo-incoming-attachments` spec §IN/OUT). Reread is bounded by repo presence, not by a TTL.
  - Reason: per repo-incoming spec, "incoming 檔案是否進 git 由使用者自決" — the binary lifecycle belongs to the project, not to attachment-lifecycle.
  - Consequence: model `reread_attachment` errors with `attachment_not_found` if the user has manually deleted the file from `<worktree>/incoming/`; no `attachment_expired` time-based error class.

- **DD-5** **Dehydration is idempotent**: a part with `dehydrated: true` is skipped on re-evaluation.
  - Reason: post-completion hook may fire on retry / replay; must not double-rewrite or overwrite annotation.
  - Consequence: marker field check at the top of the hook.

- **DD-6** **Subagent has its own `incoming/<sessionID>/`** — parent attachments do NOT leak in.
  - Reason: subagent is a separate session; its attachment lifecycle is independent. Parent's attachments come in via `parentMessagePrefix` text rendering, not as live `attachment_ref` parts.
  - Consequence: subagent dehydration writes to subagent's own session dir; if subagent needs the original, it must be explicitly re-attached by the user / parent.

- **DD-7** **Schema extension on `MessageV2.AttachmentRefPart`** — optional fields:
  - `dehydrated?: boolean`
  - `annotation?: string`
  - `sha256?: string`
  - `incoming_path?: string`
  - All optional + backwards compatible. Old `attachment_ref` parts (no `dehydrated` field) parse as `dehydrated === undefined`, equivalent to false.

- **DD-8** **Wire serialization**: when `dehydrated === true`, the part renders to a text content block:
  ```
  <dehydrated_attachment filename="image (3).png" sha256="abc...">
  Annotation: <verbatim assistant response text or extracted slice>
  Note: original binary staged at <incoming_path>; call reread_attachment("image (3).png") if you need to look again.
  </dehydrated_attachment>
  ```
  - Reason: model receives the annotation + a clear hint about how to recover.
  - Consequence: replaces the original `image_url` content block in the model-message conversion path.

- **DD-9** **`reread_attachment` tool**:
  ```
  reread_attachment({ filename: string }): Promise<{ type: "image", url: string, est_tokens: number, byte_size: number } | { error: "attachment_expired" | "attachment_not_found" }>
  ```
  - Reason: model self-service for re-fetch; opt-in based on the model's judgment.
  - Consequence: tool registered globally (always available); description tells model when to use it.

- **DD-10** **Failed turns (`finish="error" | "abort"`) skip dehydration**.
  - Reason: model didn't successfully process the image; annotation would be unreliable.
  - Consequence: incoming binary stays in sqlite `attachments` table for that turn; next successful turn that re-reads it can dehydrate.

- ~~**DD-11** **GC mechanism**: a single `garbage-collect-incoming.ts` module wired into daemon startup + daily cron timer + skip immediate-on-delete for grace period.~~ **(v1, SUPERSEDED 2026-05-04 by DD-4'; no GC implemented in this spec)**

- **DD-12** **Annotation extraction**: `annotation` value = trimmed assistant response text, capped at 4000 chars (one large-paragraph worth). If response > 4000 chars, take first 2000 + last 1500 with `… [truncated] …` marker.
  - Reason: short enough to be cheap, long enough to capture a useful summary.
  - Consequence: rare cases where assistant emitted a 10K-token response and the trimmed annotation loses fidelity; user can call `reread_attachment` to recover.

- **DD-13** **Telemetry**:
  - `attachment.dehydrated { sessionID, filename, sha256, originalEstTokens, annotationChars }`
  - `attachment.dehydrate.skipped { sessionID, filename, reason }` (non-image, failed turn, already dehydrated)
  - `attachment.rereaded { sessionID, filename }`
  - `attachment.gc.swept { sessionsScanned, sessionsDeleted, bytesFreed, durationMs }`

- **DD-14** **No feature flag** (matches Phase B v2 direct-ship discipline). New behavior is the default; old sessions are not migrated; only newly-uploaded attachments enter the dehydration path. Rollback via git revert.

- **DD-15 (NEW 2026-05-04 — repo-incoming-attachments dependency)** This spec depends on `repo-incoming-attachments` having populated `attachment_ref.repo_path` for every uploaded image (already done in main, phase 2.5\*\* commit). For pre-repo-incoming legacy attachments (those with no `repo_path` field), dehydration is **skipped** (telemetry: `attachment.dehydrate.skipped { reason: "no-repo-path" }`); they keep their legacy hydrated path with binary in sqlite blob.
  - Reason: dehydration without a binary location to hand the model in `reread_attachment` is a dead end.
  - Consequence: extends DD-3's skip rules. Dehydration coverage = "post-repo-incoming uploads only", which matches the realistic scope (any session created after the repo-incoming rollout).

- **DD-16 (NEW 2026-05-04)** **Annotation field on `attachment_ref`** is added by attachment-lifecycle (this spec). `dehydrated` boolean is also added. The existing `repo_path` and `sha256` fields are reused as-is (no change). All four are optional.
  - Reason: clean separation of concerns: repo-incoming owns `repo_path` / `sha256` / upload mechanics; attachment-lifecycle owns `dehydrated` / `annotation` / lifecycle-after-read.
  - Consequence: schema delta in T.1.1 is just `dehydrated?: boolean` + `annotation?: string`.

- **DD-19 (NEW 2026-05-04 v4 — second architectural pivot)** **Image binary inlines via preface trailing tier, NEVER conversation history**. Conversation history's `attachment_ref` parts stay as compact text routing-refs (~470 bytes), byte-stable forever.
  - When LLM request is assembled, the system computes an "active image set" for this turn (DD-20) and appends each image as a `{type:"file"}` content block to the **preface message's trailing tier** (Phase B context-preface.ts trailingExtras).
  - `MessageV2.toModelMessages` for `attachment_ref` parts in conversation history continues to emit the existing routing-hint text (with softened language per DD-18). NO branching on `dehydrated` — there's no `dehydrated` flag in v4. NO inline image emission from this conversion site.
  - Reason: Phase B's cache discipline says big-delta content rides BP4 (preface trailing zone, per-turn dynamic). Image binary fits this pattern exactly. v3's user-message inlining + dehydrate-by-mutation violated this discipline; mutating turn N's user message bytes invalidated cache prefix from that point onwards (anti-pattern).
  - Consequence: schema delta from v3 (`dehydrated`, `annotation` fields) is REVERTED — those fields are unnecessary in v4. The 4 v3 implementation commits (`f39d70e71`..`8039fcf65`) were reset.

- **DD-20 (NEW 2026-05-04 v4)** **Active image set state**: `session.execution.activeImageRefs?: string[]` (filenames or ref_ids; pick at impl time). Lifecycle:
  - **Add on user upload**: when a user message lands with new image `attachment_ref` parts (mime starts with `image/` AND `repo_path` populated), each ref's identifier is appended.
  - **Add on AI reread**: when AI calls `reread_attachment(filename)`, the filename is appended.
  - **Drain after assistant response**: when the assistant turn that consumed the image reaches `finish="stop"`, the active set is cleared.
  - Effect: image is inlined in preface trailing for exactly one assistant turn, then stops appearing. AI's response text (in assistant message) carries forward as the durable understanding.
  - Schema: `ExecutionIdentity` extension, optional array. Backwards compatible; old sessions default to undefined → empty.

- **DD-21 (NEW 2026-05-04 v4)** **Reread tool returns voucher, not binary**: `reread_attachment(filename)` returns `{type:"text", text:"Image '<filename>' queued for vision in your next turn."}` and pushes the filename onto `session.execution.activeImageRefs`. The image inlines into preface trailing on the NEXT turn. Latency cost: 1 extra turn. Benefit: image binary never enters conversation history (would otherwise live in tool result forever).
  - Reason: tool result content lives in conversation history. If we returned binary directly, it'd accumulate as cache-prefix-mutation source — same anti-pattern as v3.
  - Consequence: model needs to plan one turn ahead to reread. Tool description tells it: "After this returns, your next response can examine the image."

- **DD-22 (NEW 2026-05-04 v5 — third architectural pivot)** **Pure AI-driven opt-in: upload announces, never auto-queues**. The upload-commit hook (`addOnUpload` site in prompt.ts) becomes a no-op for activeImageRefs. Inline only happens via explicit `reread_attachment` voucher call.
  - Reason: v4's auto-queue created a new force-feed risk — a user dropping 10+ debug screenshots in one message would either silently lose images past the FIFO cap (= bad UX) or blow per-turn token budget if cap raised (= context bloat returns). Pure opt-in delegates the budget decision to the AI, which can read the inventory and decide which 1-2 images actually matter.
  - Cost: 1 extra round-trip on first read of any image. Even the canonical "look at this" + 1 image case becomes 2 turns: turn N (AI sees inventory + calls reread, ends), turn N+1 (image inlines, AI responds substantively).
  - Trade-off: latency UP by 1 turn for trivial cases; context-bloat risk → 0 regardless of upload count. User accepted this trade-off explicitly: "塞多少圖都不怕".
  - `addOnUpload` helper kept (now unused) for future re-enablement; deletion deferred until v5 has bake time.
  - Replaces DD-20's "Add on upload" lifecycle hook semantics. Drain-after-assistant (DD-20's other hook) is unchanged.

- **DD-22.1 (NEW v5)** **Inventory text block in preface trailing**. New text content placed in trailing tier (BP4 zone, before any image blocks):
  ```
  <attached_images count="N">
  - filename1 (mime, optional dimensions)
  - filename2 (mime)
  ...
  Active in this preface: filename_a, filename_b   (or "(none)")
  Use reread_attachment(filename) to bring an image into your next response.
  </attached_images>
  ```
  - Source: walk session messages, collect every `attachment_ref` part where mime is `image/*` AND (`session_path` OR `repo_path` populated). Newest-first ordering.
  - Sort: most-recent-upload first (debug-flow priority).
  - Token cost: ~30-60 chars per entry → 50 images ≈ 3KB ≈ 750 tokens. Bounded by inventory text, not image bytes.
  - Empty case: when 0 images in session, omit the entire block (zero overhead).
  - Cache: per-turn churn (each new upload changes the list, drain changes the "Active in this preface" line) → BP4 zone where churn is expected.

- **DD-22.2 (NEW v5)** **FIFO cap repurposed**: `attachment_active_set_max` no longer bounds upload (irrelevant — uploads don't auto-queue). It now bounds AI-driven reread accumulation: defensive ceiling so a buggy/looping AI can't `reread_attachment` 100 different filenames in one turn and queue them all. Default raised to 8 (was 3); range 1-50.

- **DD-22.3 (NEW v5)** **Voucher tool description rewrite**. The reread tool's description loses the "previously-attached" framing (which implied "you already saw it"); becomes "fetch a session-attached image into your next response so you can see its pixels." Tool name kept as `reread_attachment` for now to avoid breaking existing prompt cache; rename to `view_attachment` deferred as a follow-up.

- ~~**DD-17 (NEW 2026-05-04 v3 — architectural pivot)** **Main agent reads images inline by default**.~~ **(v3, SUPERSEDED 2026-05-04 by DD-19)** Inlining at user-message position in conversation history put big delta in cache-stable zone, violating Phase B discipline. `MessageV2.toModelMessages` branches as follows when emitting an `attachment_ref` for image mimes:
  - `dehydrated !== true` AND `repo_path` populated AND mime starts with `image/` → emit `{type: "file", url: "data:image/png;base64,...", mediaType: ..., filename: ...}` content block (read bytes from `<worktree>/<repo_path>` at conversion time). The main agent (multimodal) sees the actual image.
  - `dehydrated === true` → emit `<dehydrated_attachment ...>annotation</dehydrated_attachment>` text block (per existing DD-8). Image collapsed to text post-read.
  - `repo_path` undefined → fall back to existing legacy text routing hint (pre-repo-incoming sessions, no binary location to inline from).
  - Non-image mimes → unchanged (existing routing-hint path).
  - Reason: opencode's main agents are multimodal (GPT-5.5 / Claude Sonnet 4.6 / Gemini etc.). Routing every image through a vision subagent for ≤1500-token text summary throws away the model's native vision capability and creates a 100:1+ lossy compression. The original text-routing path was a vestigial pre-multimodal design.
  - Consequence: main agent's input_token cost rises per turn for hydrated images (image binary inline). Mitigated by Phase A.5 cache (image binary is stable bytes, caches well across turns) AND by post-read dehydration: after one assistant response, the image collapses to annotation, never re-sent inline again.
  - Trade-off: first-turn cost (image inlined) > current architecture (only routing hint). Subsequent-turns cost (annotation only) ≪ current architecture (subagent task result text accumulating in main conversation). Net: comparable or better, with hugely better fidelity.

- **DD-18 (NEW 2026-05-04 v3)** **Vision subagent becomes opt-in fallback**, not the default route. The `attachment` tool with `mode=read agent=vision` continues to work — main agent can still call it explicitly for:
  - Deeper analysis the main agent feels its own first-pass missed
  - Non-multimodal main agents (lite providers per DD-14, plus any future provider that lacks vision)
  - Cases where main agent wants a focused-question answer rather than its own free-form interpretation
  - Reason: the vision subagent prompt (templates/prompts/agents/vision.txt) is still useful; we just stop forcing it as the only path.
  - Consequence: the routing-hint text in `MessageV2.toModelMessages` (for the `repo_path` undefined fallback case AND non-image mimes) keeps mentioning the `attachment` tool, but the recommendation language softens: from "Use the attachment tool with agent=vision" to "If you want a focused vision-subagent analysis instead of inline reading, call attachment(mode=read, agent=vision)".
  - Vision subagent's existing test suite + prompt template stays as-is; only the dispatch frequency drops.

## Risks / Trade-offs

- **R1 Annotation insufficient for image content** — DD-12's 4000-char cap may lose detail for visually rich screenshots. Mitigation: model can `reread_attachment`; v2 spec can add dedicated LLM annotator.
- ~~**R2 Disk growth** — incoming staging accumulates ~50-200KB per image × N sessions. With 7-day TTL, worst case is ~10MB-100MB depending on usage pattern. Mitigation: TTL configurable; GC telemetry visible.~~ **(v1, SUPERSEDED 2026-05-04 — under DD-2', binary lives in repo and is user-managed; disk growth is not this spec's concern)**
- **R3 Re-read miss** — model calls `reread_attachment` but the file at `<worktree>/<repo_path>` has been removed (user `git clean`, `rm`, or never landed because pre-repo-incoming session). Mitigation: tool returns clear `attachment_not_found` error; model can ask user to re-upload.

- ~~**R6 (NEW v3)**~~ **(v3, SUPERSEDED 2026-05-04 by R6')** First-turn cost framing was tied to user-message inlining; under v4 image lives in preface trailing.

- **R6' (v4 NEW)** First-turn cost rises but is bounded to one turn's BP4: image binary in preface trailing makes BP4 fresh on the turn the image appears. BP4 is per-turn fresh anyway, so the marginal cost is just the image bytes vs no-image. On the next turn (no reread), the image is gone from preface trailing → BP4 again fresh (no image), conversation history BP1/BP2/BP3 still cached. Net effect: image bytes paid once, never accumulate.

- **R9 (NEW v4) Active set leak / stale entries**: if assistant turn errors or aborts, the activeImageRefs may not drain → image keeps appearing in trailing across turns. Mitigation: drain on ANY assistant turn completion (not just finish="stop"); secondary safety net — cap activeImageRefs to N (e.g. 3) with FIFO eviction.

- **R10 (NEW v4) Subagent inheritance**: parent session's activeImageRefs should NOT bleed into subagent's preface trailing. Subagent has its own ExecutionIdentity → its own activeImageRefs (defaults empty). If subagent needs the parent's image, parent must explicitly pass it through the dispatch context.

- **R7 (NEW v3) Lite provider broken** — non-multimodal lite providers (per Phase B DD-14 they keep a single concise system prompt) cannot consume `type: "file"` image content blocks. Mitigation: DD-17 conversion checks if the model supports image input (via `Provider.Model.capabilities` or similar); if not, fall back to vision-subagent routing hint as today. Lite path unaffected.

- **R8 (NEW v3) Plugin / hook breakage** — anything that previously inspected `attachment_ref` text routing hints in user message text content may need to recheck. Mitigation: `MessageV2.toModelMessages` is the only conversion site; its tests + manual smoke catch most regressions. Plugins listening on `experimental.chat.messages.transform` see the new shape and can adapt.
- **R4 Subagent attachment confusion** — model thinks subagent inherits parent's reread access. Mitigation: subagent gets its own incoming; tool errors with clear message.
- **R5 Dehydration during compaction race** — Phase A compaction may run concurrently with post-completion hook. Mitigation: dehydration is part-level edit on a SPECIFIC part id; compaction reads via Session.messages and won't touch parts mid-edit. Sqlite WAL handles isolation.

## Critical Files

- [packages/opencode/src/session/message-v2.ts](../../packages/opencode/src/session/message-v2.ts) — extend `AttachmentRefPart` schema with **two** new optional fields (`dehydrated`, `annotation`); reuse existing `repo_path` / `sha256` per DD-16
- [packages/opencode/src/session/processor.ts](../../packages/opencode/src/session/processor.ts) — post-completion hook scans parent user message for image `attachment_ref` parts with `repo_path` populated → flips `dehydrated=true` + extracts annotation. **Does not move binaries.**
- [packages/opencode/src/tool/reread-attachment.ts](../../packages/opencode/src/tool/reread-attachment.ts) **(NEW)** — the re-read tool. Reads bytes from `<worktree>/<repo_path>` directly via existing fs helpers.
- [packages/opencode/src/tool/index.ts](../../packages/opencode/src/tool/index.ts) — register `reread_attachment` in core tool registry
- [packages/opencode/src/incoming/paths.ts](../../packages/opencode/src/incoming/paths.ts) **(EXISTING)** — read-only consumer; `IncomingPaths.projectRoot()` to resolve absolute paths from `repo_path`
- Wire format conversion (where `attachment_ref` → AI SDK content block happens) — branch on `dehydrated` flag to emit text instead of image
- [packages/opencode/src/config/tweaks.ts](../../packages/opencode/src/config/tweaks.ts) — add `attachment_dehydrate_enabled` + `attachment_annotation_max_chars` knobs (no GC-related knobs needed under DD-4')

## Validation Strategy

- **Unit**: schema roundtrip with new fields; dehydration hook with synthetic finish="stop" message; reread tool happy + missing file paths; GC with synthetic old-session timestamps; idempotency check.
- **Integration**: end-to-end smoke — upload image, observe dehydration on next turn, see token count drop; reread flow.
- **Manual smoke**: replay a session like `ses_211c853fcffer...` (with multiple image attachments) and observe per-turn token reduction.

## Migration / Rollout

- **Dependency**: `repo-incoming-attachments` (state=`implementing`) must have populated `repo_path` on uploaded `attachment_ref` parts. As of 2026-05-03 (its phase 2.5\*\* commit), all NEW uploads do. Pre-2026-05-03 legacy sessions skip dehydration (DD-15).
- **Schema additions**: `dehydrated?` + `annotation?` — both `z.optional()`. `repo_path` / `sha256` already in schema.
- **Behavior**: new dehydration applies immediately on next assistant turn after deploy. Old hydrated attachments (no `repo_path`) stay hydrated.
- **Rollback**: git revert. Already-dehydrated parts have `dehydrated=true` field that zod will silently strip on next read; wire-format conversion reverts to the existing repo-incoming dual-read path (read binary from `<worktree>/<repo_path>` via `tool/attachment.ts` lookup). Risk is essentially zero because the binary was never moved by attachment-lifecycle — it's still at the same `repo_path` it always was.

## Open Questions

無 — 6 個 OQ 已於 2026-05-04 解決，記錄於 [proposal.md Open Questions section](./proposal.md#open-questions-resolved-2026-05-04)。

## Cross-References

- [proposal.md](./proposal.md) — Why / Scope
- [spec.md](./spec.md) — GIVEN/WHEN/THEN
- [prompt-cache-and-compaction-hardening](../prompt-cache-and-compaction-hardening/) — Phase B context
