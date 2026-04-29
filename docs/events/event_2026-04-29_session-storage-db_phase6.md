# Event: session-storage-db Phase 6 debug CLI

## Scope

- Spec: `specs/session-storage-db`
- Phase: 6 — `opencode session-inspect`
- In scope: read-only `list`, `show`, and `check` diagnostics for SQLite and legacy sessions.
- Out of scope: write/fix commands, live daemon smoke tests, production data mutation.

## Changes

- Added `packages/opencode/src/cli/cmd/session-inspect.ts` and registered it as top-level `opencode session-inspect`.
- Implemented `list <sid>` table output with message id, role, created time, finish, and token total.
- Implemented `show <sid> <mid>` JSON output with message info and ordered parts via `Router`.
- Implemented `check <sid>` using `runIntegrityCheckUncached` for SQLite sessions and a read-only legacy readability check for unmigrated sessions.
- Added `packages/opencode/src/cli/cmd/session-inspect.test.ts` covering SQLite list/show/check and legacy fallthrough without migration.

## Validation

- `bun test "./packages/opencode/src/cli/cmd/session-inspect.test.ts"` — 4 pass, 0 fail.
- `bun test "./packages/opencode/src/session/storage/router.test.ts"` — 13 pass, 0 fail.
- `bun install` was run in the beta worktree to restore dependency parity required for focused tests; it did not alter tracked dependency files.

## Issues

- Initial test attempt failed because beta worktree lacked `node_modules`; dependency parity was restored locally in `/home/pkcs12/projects/opencode-beta-session-storage-db-phase5`.
- A first patch attempt landed Phase 6 files in the main worktree because `apply_patch` defaults to the parent cwd. Those worker-created files/registration were removed from main before continuing; main now retains only the pre-existing diagnostics changes.
