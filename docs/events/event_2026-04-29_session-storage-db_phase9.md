# Event: session-storage-db Phase 9 cleanup gates

## Scope

- Spec: `specs/session-storage-db`
- Phase: 9 — cleanup gates and manual migration operator path.
- In scope: operator-visible legacy pending count milestone, single-session force migration CLI, and follow-up LegacyStore retirement gate documentation.
- Out of scope: production bulk migration, daemon restart, Grafana exporter provisioning, and deleting LegacyStore / Router legacy branches.

## Changes

- Added `packages/opencode/src/cli/cmd/storage.ts` and registered `opencode storage`.
- Added `opencode storage status` to report `legacy_sessions_pending_count`, update the existing ActivityBeacon-backed gauge, and print the `0 for >= 7 days` LegacyStore retirement milestone.
- Added `opencode storage migrate-now <sid>` to force-migrate exactly one named legacy session through `DreamingWorker.migrateSession`; already-SQLite and post-rename debris sessions return a clear no-op message.
- Added `packages/opencode/src/cli/cmd/storage.test.ts` covering status output, single-session migration without sweeping other legacy sessions, already-SQLite no-op behavior, and post-rename debris no-op behavior.
- Updated `specs/session-storage-db/observability.md` and `tasks.md` for Phase 9 completion.

## Validation

- `bun test "./packages/opencode/src/cli/cmd/storage.test.ts"` — 3 pass, 0 fail before debris hardening; expanded coverage is included in the full suite below.
- `bun test "./packages/opencode/src/cli/cmd/storage.test.ts" "./packages/opencode/src/session/storage/hardening.test.ts" "./packages/opencode/src/session/storage/dreaming.test.ts" "./packages/opencode/src/session/storage/router.test.ts" "./packages/opencode/src/cli/cmd/session-inspect.test.ts"` — 35 pass, 0 fail.

## Issues

- No Grafana/admin exporter implementation exists in the repo; Phase 9 exposes the retirement milestone through the existing ActivityBeacon metric path and operator CLI copy instead of inventing a parallel telemetry stack.
- LegacyStore retirement remains a separate lifecycle amend after `legacy_sessions_pending_count == 0` for at least 7 days; no production cleanup or code deletion was performed.
- A first patch attempt created `packages/opencode/src/cli/cmd/storage.ts` in the main worktree because `apply_patch` defaults to the parent cwd; that worker-created file was removed immediately. Main now retains only pre-existing user changes.
