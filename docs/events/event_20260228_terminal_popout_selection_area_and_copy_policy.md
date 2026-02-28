# Event: terminal popout selection area + copy policy update

Date: 2026-02-28
Status: Completed

## User feedback addressed

1. Drag selection only worked in a constrained visible region.
2. Selected text had no practical copy path without Ctrl+C conflict.

## Changes

- Popout terminal now removes inner padding (`!px-0 !py-0`) to maximize usable selection area.
- Added popout-focused selection copy policies in `Terminal`:
  - Auto-copy on mouse selection (mouseup after selection)
  - Right-click copies current selection (`contextmenu`)

## Notes

- This avoids relying on `Ctrl+C` for copy in popout mode, preventing conflict with shell interrupt semantics.

## Files

- `packages/app/src/components/terminal.tsx`
- `packages/app/src/pages/session/terminal-popout.tsx`
