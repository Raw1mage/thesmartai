# Event: explicit disable click-selection in popout terminal

Date: 2026-02-28
Status: Completed

## Problem

- Popout terminal still entered browser-like selection behavior on mouse click/move.

## Fix

- Added `disableMouseSelection` prop to `Terminal`.
- When enabled:
  - prevent default on pointerdown
  - clear document selection ranges
  - block `selectstart` in terminal container
- Enabled this mode for popout terminal mount only.

## Files

- `packages/app/src/components/terminal.tsx`
- `packages/app/src/pages/session/terminal-panel.tsx`
