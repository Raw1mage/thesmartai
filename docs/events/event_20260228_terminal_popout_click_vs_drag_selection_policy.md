# Event: terminal popout click-vs-drag selection policy

Date: 2026-02-28
Status: Completed

## Requirement

- Single mouse click should **not** trigger selection mode.
- Mouse click-and-drag should still allow text selection.

## Fix

- Removed hard blocking of selection (`selectstart` prevent + global user-select:none behavior).
- Implemented pointer gesture policy for popout terminal:
  - track pointer movement distance
  - if no drag movement (simple click), clear selection on pointerup
  - if dragged beyond threshold, keep normal text selection behavior

## Files

- `packages/app/src/components/terminal.tsx`
- `packages/app/src/pages/session/terminal-panel.tsx`
