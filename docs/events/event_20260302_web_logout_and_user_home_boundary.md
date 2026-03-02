# Event: add web logout entry and enforce authenticated user home boundary

Date: 2026-03-02
Status: Done

## Symptom

- Webapp had no obvious logout entry in the main navigation.
- After logging in as `betaman`, terminal/workspace could still resolve to prior user path (e.g. `~pkcs12`) when client sent a stale directory.

## Root Cause

1. Logout API existed (`/global/auth/logout`) but web sidebar had no trigger.
2. Server accepted directory overrides without constraining them to authenticated Linux user home.

## Changes

1. `packages/app/src/pages/layout/sidebar-shell.tsx`
   - Added a sidebar logout action (icon button) to trigger web session logout.

2. `packages/app/src/pages/layout.tsx`
   - Wired `useWebAuth().logout()` into sidebar action.
   - On logout, clear workspace terminal caches and close opened projects before navigating to `/`.

3. `packages/opencode/src/server/app.ts`
   - Added directory boundary enforcement for authenticated Linux users:
     - Resolve requested directory relative to user home.
     - Reject directories outside user home and fall back to the user home.
   - Keeps multi-user file scope separated for browser-facing usage.

## Expected Result

- User can explicitly logout from webapp UI.
- Authenticated user requests cannot force workspace outside their own Linux home.
- Logging in as `betaman` no longer lands terminal/workspace under `~pkcs12` via stale directory overrides.
