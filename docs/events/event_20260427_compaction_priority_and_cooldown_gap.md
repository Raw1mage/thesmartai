## Event: /compact priority-0 snapshot + compaction-request cooldown gap

Follow-up to `event_20260427_runloop_rebind_loop.md`. Same triage session
surfaced a second behaviour: a manual `/compact` call sometimes
immediately triggered an account rotation, after which a rebind
compaction ran on top of the just-completed manual one — the user saw
two compactions back to back even after the rebind infinite-loop fix
landed.

## Triage

Two independent gaps converged:

1. `SessionCompaction.process()` always took the plugin path first
   (`tryPluginCompaction`, e.g. Codex `/responses/compact`). Plugin
   compaction is a real API request and counts toward the account's
   5-hour subscription quota. A manual `/compact` near the burst limit
   could itself push the account over and trigger rotation3d mid-call.

2. The `compaction-request` task branch in
   `packages/opencode/src/session/prompt.ts:1492` did not call
   `SessionCompaction.recordCompaction()`. The sibling overflow
   (line 1592) and rebind (line 1519) paths both record the cooldown
   round, but the manual / API-driven path was the gap. With
   `cooldownState` empty, a rotation that fired during plugin
   compaction would set the rebind flag, and the next loop iteration's
   `consumeRebindCompaction(step)` would clear it without the 4-round
   cooldown ever applying — producing the observed second compaction.

## Fix

### Layer 1 — Priority 0 snapshot (`compaction.ts`)

`process()` now tries `SharedContext.snapshot()` before
`tryPluginCompaction`. The snapshot is in-memory scratchpad state, free
of any API call. If the snapshot fits within 30% of the user's active
model context (mirroring the budget check in `prompt.ts:1605` for the
overflow path), we hand it to `compactWithSharedContext` and return
"continue" immediately. Plugin / LLM agent paths only run when the
snapshot is missing, empty, or too large.

This eliminates the quota burn for the common case and removes the
trigger that was producing rotations during manual `/compact`.

### Layer 2 — Cooldown record on compaction-request (`prompt.ts`)

The compaction-request task branch now calls
`SessionCompaction.recordCompaction(sessionID, step)` on success.
Every compaction trigger source (overflow, rebind, manual) now records
the same cooldown state, so a rotation that does still happen during a
larger-than-budget compaction can no longer be doubled by an
immediately-following rebind compaction.

## Files changed

- `packages/opencode/src/session/compaction.ts` — priority-0 snapshot
  branch added at the top of `process()`.
- `packages/opencode/src/session/prompt.ts` — `recordCompaction(...)`
  added in the compaction-request task handler.

## Tests

Existing `compaction.test.ts` (9 cases) still passes. The cooldown
mechanic itself is already covered by
`rebind compaction respects cooldown when fired repeatedly`; the new
caller in `prompt.ts` simply feeds that mechanic from a previously
unguarded path.

## Out of scope

- `tryPluginCompaction` and the LLM agent path are unchanged.
- The codex /responses/compact endpoint's quota-counting behaviour is
  unchanged — we just stop calling it when a free local snapshot would
  do.
- Belt-and-suspenders option to clear `pendingRebindCompaction` from
  inside `compactWithSharedContext` is intentionally NOT added; the
  cooldown record is sufficient and keeps the rebind anchor as an
  optional safety net for true mid-stream divergence.
