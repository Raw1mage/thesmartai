# Tasks: attachment-lifecycle

> Execution surface: `/home/pkcs12/projects/opencode-worktrees/attachment-lifecycle` on branch `beta/attachment-lifecycle`.
> Spec writes (this file, design.md, etc.): mainRepo at `/home/pkcs12/projects/opencode`.
> Always `source .beta-env/activate.sh` before any `bun test` / `bun run` in beta worktree.

User-framed as a "small hotfix" — 5 implementation phases, no feature flag, direct-ship architecture.

## 0. Prerequisites

- [ ] T.0.1 Create beta worktree:
  ```
  git worktree add -b beta/attachment-lifecycle \
    /home/pkcs12/projects/opencode-worktrees/attachment-lifecycle main
  ```
- [ ] T.0.2 Bootstrap `.beta-env/activate.sh` (XDG isolation pointed at the new worktree path); copy `theme/opencode.json` if needed for `bun install` postinstall.
- [ ] T.0.3 `bun install` in beta worktree; baseline test sweep on `packages/opencode/src/session/` matches main.

## 1. Phase T.1 — Foundation: schema + IncomingStore + AnnotationExtractor

- [ ] T.1.1 Extend `MessageV2.AttachmentRefPart` schema with optional fields (DD-7):
  - `dehydrated?: z.boolean()`
  - `annotation?: z.string().max(4000)`
  - `sha256?: z.string().regex(/^[a-f0-9]{64}$/)`
  - `incoming_path?: z.string()`
  - Roundtrip test: old part with no fields parses; new part with all fields parses; tampering with sha256 length rejects.

- [ ] T.1.2 New file `packages/opencode/src/session/storage/incoming-store.ts`:
  - `put(sessionID, filename, bytes): Promise<{absolutePath, sha256}>`
  - `get(sessionID, filename): Promise<Uint8Array | null>`
  - `list(sessionID): Promise<string[]>`
  - `deleteSession(sessionID): Promise<{bytesFreed: number}>`
  - `listAllSessions(): Promise<string[]>` (for GC walker)
  - Path resolution: `path.join(Global.Path.state, "incoming", sessionID, filename)`
  - Sanitization: refuse `..` in filename; absolute path containment check.
  - 12-15 unit tests covering happy / missing / sanitization / list-all.

- [ ] T.1.3 New helper in `packages/opencode/src/session/processor.ts` (or extracted to `attachment-annotator.ts`):
  - `extractAnnotation(responseText: string): string` — trim + 4000 char cap + head/tail truncation marker (DD-12).
  - 6 unit tests: under cap / at cap / over cap (head+tail) / empty / whitespace-only / multi-line preservation.

- [ ] T.1.4 Tweaks knobs in `packages/opencode/src/config/tweaks.ts`:
  - `attachment_dehydrate_enabled: boolean` (default true)
  - `attachment_incoming_ttl_days: number` (default 7)
  - `attachment_annotation_max_chars: number` (default 4000)

## 2. Phase T.2 — Behavior: DehydrationHook + WireFormatTransformer

- [ ] T.2.1 Wire post-completion hook in `processor.ts`:
  - After assistant message reaches `finish="stop"`, scan parent user message for image `attachment_ref` parts
  - Skip if part already `dehydrated === true` (DD-5)
  - Skip if mime not `image/*` (DD-3 v1 scope)
  - Skip if `finish !== "stop"` (DD-10)
  - For each: extractAnnotation → IncomingStore.put → Session.updatePart with new fields → delete sqlite attachments row → emit telemetry

- [ ] T.2.2 Branch wire-format conversion in `MessageV2.toModelMessages` (or equivalent serializer):
  - When `attachment_ref.dehydrated === true`: emit `{type: "text", text: <dehydrated_attachment ...>annotation</dehydrated_attachment>}`
  - When `dehydrated !== true`: existing image_url block path (DD-8)
  - 6 tests cover both branches + idempotency (re-serialize same part → same bytes).

- [ ] T.2.3 Integration test (lightweight): synthesize a session with 1 user message + 1 image attachment + 1 finished assistant message; run dehydration hook; confirm:
  - sqlite attachments row gone
  - file at `~/.local/state/opencode/incoming/<sid>/image.png` exists with correct bytes
  - attachment_ref part has `dehydrated=true` + annotation populated
  - subsequent toModelMessages emits text block

## 3. Phase T.3 — RereadAttachmentTool

- [ ] T.3.1 New file `packages/opencode/src/tool/reread-attachment.ts`:
  - Tool name: `reread_attachment`
  - Input schema: `{filename: string}`
  - Body: lookup `IncomingStore.get(sessionID, filename)` → if found, return `{type: "image", url: data URI, est_tokens, byte_size}`; if missing, return `{error: "attachment_expired", message: ...}`
  - 5 tests: happy / missing / non-existent filename / sanitization / telemetry emit.

- [ ] T.3.2 Register tool in `packages/opencode/src/tool/index.ts` core registry. Description tells model when to use:
  ```
  Re-read a previously dehydrated image attachment. Use when the dehydrated_attachment annotation is insufficient and you need the original image content. Filename matches the original attachment filename.
  ```

- [ ] T.3.3 Integration test: dehydrate → call reread → confirm fresh image content returned.

## 4. Phase T.4 — GarbageCollector + cron

- [ ] T.4.1 New file `packages/opencode/src/session/storage/garbage-collect-incoming.ts`:
  - `gcSweep(): Promise<{sessionsScanned, sessionsDeleted, bytesFreed, durationMs}>`
  - For each session dir: lookup Session.get(sid) → if missing or `time.deleted` > TTL days ago → IncomingStore.deleteSession
  - 5 tests with synthetic timestamps.

- [ ] T.4.2 Wire into `cli/cmd/serve.ts handler` post-migration-boot-guard, pre-listen.

- [ ] T.4.3 Register daily cron timer (use existing cron subsystem); trigger `attachment.gc.daily`.

## 5. Phase T.5 — Validation + finalize

- [ ] T.5.1 Full test sweep on beta worktree: `bun test packages/opencode/src/session/ packages/opencode/src/provider/ packages/opencode/src/tool/` — confirm zero new regressions vs main baseline.
- [ ] T.5.2 `bun run typecheck` no new errors (excluding pre-existing share-next.ts noise).
- [ ] T.5.3 Manual smoke: in dev daemon, upload an image, observe response, then send another turn — confirm `attachment.dehydrated` log + token count drops in second turn's input.
- [ ] T.5.4 Manual reread test: in dev session post-dehydration, ask model "look at the previous screenshot again" — observe model calls `reread_attachment` and gets image back.
- [ ] T.5.5 Phase summary `docs/events/event_<YYYYMMDD>_attachment-lifecycle-landed.md` with commit hashes + observed token reduction.
- [ ] T.5.6 Rebase to latest main; merge clean.
- [ ] T.5.7 STOP for user finalize approval.

## 6. Phase T.6 — Finalize + cleanup

- [ ] T.6.1 `git merge --no-ff beta/attachment-lifecycle` into main (in mainRepo).
- [ ] T.6.2 `plan-promote --to verified` then `--to living`.
- [ ] T.6.3 `git worktree remove` + `git branch -d beta/attachment-lifecycle`.
- [ ] T.6.4 Daemon restart (per `feedback_restart_daemon_consent` — pause and ask first).

## Dependencies between phases

- T.0 unblocks all
- T.1 (schema + foundation) → T.2 (behavior consumes new schema)
- T.2 (dehydration hook + serializer) → T.3 (reread tool depends on dehydrated parts existing)
- T.4 (GC) parallel to T.3 (no interdep)
- T.5 (validation) gate after T.1-T.4 all green
- T.6 (finalize) after user approval

## Stop gates

- T.0.1 fail (worktree creation) → stop and report
- T.5.7 STOP for user finalize approval
- T.6.4 daemon restart needs explicit user "重啟嗎？" consent
- Any test red → stop, fix, no skip
