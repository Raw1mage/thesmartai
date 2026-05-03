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

- **DD-2** **Storage path = `~/.local/state/opencode/incoming/<sessionID>/<filename>`**, an XDG state-home subtree.
  - Reason: matches `Global.Path.state` convention; clean session boundary; no project-directory pollution; `XDG_STATE_HOME` overridable for test isolation.
  - Consequence: incoming staging accumulates separately from session storage (which lives in `Global.Path.data/storage/session/`); GC operates on this dedicated subtree.
  - Source-of-truth: file path resolved via `path.join(Global.Path.state, "incoming", sessionID)`.

- **DD-3** **Always dehydrate every image attachment in the just-completed turn** (no per-image granularity).
  - Reason: simple + predictable. Binary preserved for 7 days post-`session.deleted`, so AI can reread anything within window. User explicitly chose this on 2026-05-04.
  - Consequence: 100% of image attachments get the rewrite once `finish="stop"` reached. Image tokens drop from accumulating to flat-after-first-turn.
  - Alternative considered: scan response text for image references and only dehydrate referenced ones — rejected; reference detection is brittle and the binary is recoverable anyway.

- **DD-4** **TTL = 7 days after `session.deleted`** with two GC triggers: daemon startup + daily cron timer.
  - Reason: 7 days handles "I deleted that session by accident, can I recover?" without unbounded disk growth. Daily cron + startup sweep covers typical operator patterns.
  - Consequence: `attachment.gc.swept` telemetry per sweep; new tweaks.cfg knob `attachment_incoming_ttl_days` (default 7).

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

- **DD-11** **GC mechanism**: a single `garbage-collect-incoming.ts` module wired into:
  1. Daemon startup (called from `cli/cmd/serve.ts` after migration boot guard)
  2. Daily timer (registered in cron subsystem; trigger `attachment.gc.daily`)
  3. NOT triggered immediately on `session.deleted` — grace period for recovery
  - Reason: separate the lifecycle event from the cleanup; GC is a sweep not a per-event handler.
  - Consequence: a session deleted on Monday might have its incoming GC'd on the following Monday at earliest.

- **DD-12** **Annotation extraction**: `annotation` value = trimmed assistant response text, capped at 4000 chars (one large-paragraph worth). If response > 4000 chars, take first 2000 + last 1500 with `… [truncated] …` marker.
  - Reason: short enough to be cheap, long enough to capture a useful summary.
  - Consequence: rare cases where assistant emitted a 10K-token response and the trimmed annotation loses fidelity; user can call `reread_attachment` to recover.

- **DD-13** **Telemetry**:
  - `attachment.dehydrated { sessionID, filename, sha256, originalEstTokens, annotationChars }`
  - `attachment.dehydrate.skipped { sessionID, filename, reason }` (non-image, failed turn, already dehydrated)
  - `attachment.rereaded { sessionID, filename }`
  - `attachment.gc.swept { sessionsScanned, sessionsDeleted, bytesFreed, durationMs }`

- **DD-14** **No feature flag** (matches Phase B v2 direct-ship discipline). New behavior is the default; old sessions are not migrated; only newly-uploaded attachments enter the dehydration path. Rollback via git revert.

## Risks / Trade-offs

- **R1 Annotation insufficient for image content** — DD-12's 4000-char cap may lose detail for visually rich screenshots. Mitigation: model can `reread_attachment`; v2 spec can add dedicated LLM annotator.
- **R2 Disk growth** — incoming staging accumulates ~50-200KB per image × N sessions. With 7-day TTL, worst case is ~10MB-100MB depending on usage pattern. Mitigation: TTL configurable; GC telemetry visible.
- **R3 Re-read race** — model calls `reread_attachment` after binary GC'd. Mitigation: tool returns clear `attachment_expired` error; model can ask user to re-upload.
- **R4 Subagent attachment confusion** — model thinks subagent inherits parent's reread access. Mitigation: subagent gets its own incoming; tool errors with clear message.
- **R5 Dehydration during compaction race** — Phase A compaction may run concurrently with post-completion hook. Mitigation: dehydration is part-level edit on a SPECIFIC part id; compaction reads via Session.messages and won't touch parts mid-edit. Sqlite WAL handles isolation.

## Critical Files

- [packages/opencode/src/session/message-v2.ts](../../packages/opencode/src/session/message-v2.ts) — extend `AttachmentRefPart` schema with optional dehydration fields
- [packages/opencode/src/session/processor.ts](../../packages/opencode/src/session/processor.ts) — post-completion hook scans parent user message for image attachment_ref parts → triggers dehydration
- [packages/opencode/src/session/storage/incoming-store.ts](../../packages/opencode/src/session/storage/incoming-store.ts) **(NEW)** — wraps `~/.local/state/opencode/incoming/<sid>/` filesystem ops (read / write / list / delete)
- [packages/opencode/src/tool/reread-attachment.ts](../../packages/opencode/src/tool/reread-attachment.ts) **(NEW)** — the re-read tool
- [packages/opencode/src/tool/index.ts](../../packages/opencode/src/tool/index.ts) — register `reread_attachment` in core tool registry
- [packages/opencode/src/session/storage/garbage-collect-incoming.ts](../../packages/opencode/src/session/storage/garbage-collect-incoming.ts) **(NEW)** — GC sweep
- [packages/opencode/src/cli/cmd/serve.ts](../../packages/opencode/src/cli/cmd/serve.ts) — wire GC into daemon startup
- [packages/opencode/src/cron/](../../packages/opencode/src/cron/) — register daily timer
- Wire format conversion (where `attachment_ref` → AI SDK content block happens) — likely in `MessageV2.toModelMessages` — branch on `dehydrated` flag to emit text instead of image
- [packages/opencode/src/config/tweaks.ts](../../packages/opencode/src/config/tweaks.ts) — add `attachment_incoming_ttl_days` knob

## Validation Strategy

- **Unit**: schema roundtrip with new fields; dehydration hook with synthetic finish="stop" message; reread tool happy + missing file paths; GC with synthetic old-session timestamps; idempotency check.
- **Integration**: end-to-end smoke — upload image, observe dehydration on next turn, see token count drop; reread flow.
- **Manual smoke**: replay a session like `ses_211c853fcffer...` (with multiple image attachments) and observe per-turn token reduction.

## Migration / Rollout

- **Schema additions**: all `z.optional()` so old sessions unaffected.
- **Behavior**: new uploads enter dehydration path immediately on land. Old hydrated attachments stay hydrated forever (no migration).
- **Rollback**: git revert. Existing dehydrated parts will have unrecognized fields after revert (zod strips them) but the wire-format change won't apply, so behavior reverts cleanly. Incoming dir survives — manual `rm -rf` if disk pressure.

## Open Questions

無 — 6 個 OQ 已於 2026-05-04 解決，記錄於 [proposal.md Open Questions section](./proposal.md#open-questions-resolved-2026-05-04)。

## Cross-References

- [proposal.md](./proposal.md) — Why / Scope
- [spec.md](./spec.md) — GIVEN/WHEN/THEN
- [prompt-cache-and-compaction-hardening](../prompt-cache-and-compaction-hardening/) — Phase B context
