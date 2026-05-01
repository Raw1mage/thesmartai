# Session Dialog DB Tool Refactor Spec

## Requirement: system-manager reads session dialog from DB

- GIVEN a valid session id whose dialog exists in the DB
- WHEN a system-manager session/dialog tool reads that session
- THEN it returns the DB-backed dialog in stable chronological order.

- GIVEN a missing or invalid session id
- WHEN the tool is invoked
- THEN it fails fast with an explicit not-found/error response rather than reading stale legacy files.

## Acceptance Checks

- `read_subsession` and any session-management transcript/dialog path no longer depend on removed legacy session files.
- Existing output-budget/chunking behavior is preserved.
- Tests/typecheck cover the changed code path or the narrowest runnable equivalent.
