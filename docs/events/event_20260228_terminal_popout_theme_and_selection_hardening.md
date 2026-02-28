# Event: terminal popout theme + selection hardening

Date: 2026-02-28
Status: Completed

## Problem

- Popout terminal could show wrong theme (white background / unreadable contrast).
- Text selection artifacts still appeared in popout.

## Fix

- Sync main window theme/class/style state to popout (`html` + `body`) on open and on subsequent mutations.
- Inject popout-local anti-selection CSS (`user-select: none !important`) for the terminal root subtree.

## File

- `packages/app/src/pages/session/terminal-panel.tsx`
