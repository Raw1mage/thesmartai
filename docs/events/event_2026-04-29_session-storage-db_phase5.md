# Event: session-storage-db Phase 5 kickoff

## Scope

- Spec: `specs/_archive/session-storage-db`
- Phase: 5 — Dreaming mode; idle-time legacy migration
- In scope: 5.1–5.7 from `specs/_archive/session-storage-db/tasks.md`
- Out of scope: live daemon restart, production legacy directory deletion, and Phase 4 deferred benchmarks unless separately approved.

## Task List

- 5.1 Add `DreamingWorker` timer, idle detector, and legacy inventory scanner.
- 5.2 Implement atomic legacy → SQLite migration through `<sid>.db.tmp`.
- 5.3 Implement DR-4 startup cleanup for orphaned tmp databases.
- 5.4 Emit migration Bus events with stage markers.
- 5.5 Wire tunables for idle and connection thresholds.
- 5.6 Add focused migration/recovery tests.
- 5.7 Verify legacy session reads do not preemptively migrate.

## Checkpoints

- Baseline: Phase 4.1–4.3 completed; 4.4/4.5 deferred by explicit user decision.
- Instrumentation plan: test via fixture storage roots only; do not touch live `~/.local/share/opencode/`.
- Stop gates: production deletion and daemon restart remain approval-gated.

## Changes

- Added `packages/opencode/src/session/storage/dreaming.ts` with `DreamingWorker` timer, idle detection, legacy inventory scanning, one-session-per-tick migration, DR-4 tmp cleanup, integrity/row-count verification, and migration Bus events.
- Added `packages/opencode/src/session/storage/dreaming.test.ts` covering happy path, crash-before-rename, post-rename debris cleanup, row-count mismatch, integrity failure, no-preempt legacy reads, and oldest-session tick selection.
- Added `Tweaks.sessionStorageSync()` configuration path for `session_storage_idle_threshold_ms` and `session_storage_connection_idle_ms` defaults.
- Wired session writes to update the DreamingWorker idle detector.

## Validation

- `bun test "packages/opencode/src/session/storage/dreaming.test.ts"` — 7 pass, 0 fail.
- Live daemon restart/smoke test: not run; remains approval-gated.
- Production legacy deletion: not run; tests use fixture session IDs only.
- Architecture Sync: Verified (No doc changes). Basis: Phase 5 implements the already-documented DreamingWorker boundary in `specs/_archive/session-storage-db/design.md` and `specs/architecture.md` does not yet need a new cross-system boundary beyond the active spec package.

## Issues

- Child coding session transcript read failed from the parent with `Canonical transcript storage missing .../messages`, which is relevant evidence for session-storage-db compatibility/context replay diagnostics but did not block code/test validation.
- Existing user-added context replay diagnostics in `packages/opencode/src/session/prompt.ts` and `packages/opencode-codex-provider/src/transport-ws.ts` are present in the working tree and were not modified by this Phase 5 closeout.
