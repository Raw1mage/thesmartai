# Event: terminal popout return render + selection fixes

Date: 2026-02-28
Status: Completed

## Problems

1. Returning from popout back to in-page terminal could render messy/ghosted frame state.
2. Popout terminal still showed click/move text selection artifacts.

## Fixes

- Added `skipRestore` support to `Terminal` component to bypass stale buffer restore when needed.
- In terminal panel, mark one inline mount after popout close as `skipRestore`.
- Popout terminal always mounts with `skipRestore`.
- Enforced `user-select: none` on terminal host and popout body/root to avoid browser-level selection bleed.

## Files

- `packages/app/src/components/terminal.tsx`
- `packages/app/src/pages/session/terminal-panel.tsx`
