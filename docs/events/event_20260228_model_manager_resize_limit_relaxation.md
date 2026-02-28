# Event: relax model manager resize limits

Date: 2026-02-28
Status: Completed

## Problem

- Resizing hit a hard upper bound quickly.
- Near the bound, dialog appeared to move in the opposite direction while dragging.

## RCA

- Viewport max-clamp + offset clamp created shrinking movement space during resize.
- As width/height approached cap, offset re-clamping produced reverse-motion sensation.

## Fix

- Keep only minimum size constraints (`560x320`).
- Remove viewport hard max clamp and offset clamp during frame calculation.

## File

- `packages/app/src/components/dialog-select-model.tsx`
