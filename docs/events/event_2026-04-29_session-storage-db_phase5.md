# Event: session-storage-db Phase 5 kickoff

## Scope

- Spec: `specs/session-storage-db`
- Phase: 5 — Dreaming mode; idle-time legacy migration
- In scope: 5.1–5.7 from `specs/session-storage-db/tasks.md`
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
