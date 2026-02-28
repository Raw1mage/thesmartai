# Event: model manager dialog drag + resize support

Date: 2026-02-28
Status: Completed

## Changes

- Added drag support for model manager dialog via toolbar/header area.
- Added bottom-right resize handle for manual dialog resizing.
- Added viewport clamping for both position and size to keep dialog in visible bounds.

## Notes

- Drag is ignored when pointer starts on interactive controls (buttons/switches/inputs).
- Dialog frame is applied on window resize to avoid off-screen placement.

## Files

- `packages/app/src/components/dialog-select-model.tsx`
- `packages/app/src/components/dialog-select-model.css`
