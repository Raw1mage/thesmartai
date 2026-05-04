# Event: session-storage-db Phase 8 hardening

## Scope

- Spec: `specs/_archive/session-storage-db`
- Phase: 8 — Hardening, fault injection, rsync fixture, and performance fixture validation.
- In scope: fixture-only DR-1 through DR-5 tests, rsync/WAL snapshot outcome validation, and synthetic 2253-message read benchmark fixture.
- Out of scope: live daemon SIGKILL, production data mutation, and real captured runloop/reference benchmark execution.

## Changes

- Added `packages/opencode/src/session/storage/hardening.test.ts` covering DR-1 atomic rollback, DR-2 reopen/integrity after abrupt close, DR-3 corruption refusal + Bus event + `session-inspect check` non-ok verdict, DR-4 migration interruption cleanup, DR-5 synthetic forward/rollback contract, R-1 rsync/WAL snapshot outcome, and a synthetic 2253-message read benchmark fixture.
- Hardened `packages/opencode/src/session/storage/integrity.ts` so `PRAGMA integrity_check` execution errors are normalized into the same corruption verdict path used by non-`ok` results. This lets explicit diagnostics such as `session-inspect check` return a non-ok verdict instead of throwing an uncaught low-level SQLite error.
- Updated `specs/_archive/session-storage-db/tasks.md` for Phase 8 completion/defer status.

## Validation

- `bun test "./packages/opencode/src/session/storage/hardening.test.ts"` — 7 pass, 0 fail.
- `bun test "./packages/opencode/src/session/storage/hardening.test.ts" "./packages/opencode/src/session/storage/dreaming.test.ts" "./packages/opencode/src/session/storage/router.test.ts" "./packages/opencode/src/session/storage/sqlite.test.ts" "./packages/opencode/src/cli/cmd/session-inspect.test.ts"` — 44 pass, 0 fail.

## Issues

- 8.7 real ≥70% acceptance remains approval-gated because it requires the captured 2253-message reference session and runloop wall-time benchmark, not just storage fixture timing. The synthetic 2253-message fixture validates that the benchmark path can be exercised without live daemon or production data.
- No live daemon kill/restart, production migration, or production cleanup was performed.
- Initial patch tooling targeted the main worktree; the accidental main storage changes were removed before continuing. Main now retains only pre-existing user diagnostics/UI changes.
