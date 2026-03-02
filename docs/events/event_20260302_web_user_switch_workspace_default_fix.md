# Event: fix cross-user stale workspace after web login switch

Date: 2026-03-02
Status: Done

## Symptom

- After logging in as Linux user `betaman`, webapp still auto-entered previous user (`pkcs12`) workspace.

## Root Cause

1. Frontend persisted workspace selection (`server.projects.last`) is keyed by server origin (`local`) only, not by authenticated username.
2. On login/user switch, autoselect logic could reuse stale `last` workspace before auth-aware healing completed.

## Changes

1. `packages/app/src/context/global-sdk.tsx`
   - Auto-heal effect now waits for authenticated state when web auth is enabled.
   - On authenticated refresh, opens/touches server canonical worktree and prunes stale entries.

2. `packages/app/src/pages/layout.tsx`
   - Autoselect fallback changed:
     - when workspace list is empty, prefer server canonical default (`globalSync.data.path.directory/worktree`) before persisted `last`.

3. Safety hardening for run-as-user bridge enablement
   - `packages/opencode/src/system/linux-user-exec.ts`
   - Bridge is now opt-in (`OPENCODE_RUN_AS_USER_ENABLED=1`) and requires wrapper file existence.
   - Prevents accidental sudo path failures in environments where wrapper is not installed.

## Expected Result

- After login as a different Linux user, default workspace resolves to that user’s server canonical directory/home.
- Stale prior-user workspace no longer wins during initial autoselect.
