# Event: model manager resize behavior RCA and correction

Date: 2026-02-28
Status: Completed

## Problem

- Resizing from bottom-right felt counter-intuitive:
  - dialog appeared to resize in opposite direction
  - position shifted unexpectedly
  - size range felt over-constrained

## RCA

1. Dialog container is center-anchored by layout; changing width/height without compensating offset makes both sides move.
2. Previous min size constraints were too aggressive.
3. Utility `max-w/max-h` classes on dialog content introduced additional visual limits.

## Fix

- During resize, offset is adjusted by half delta (`dx/2`, `dy/2`) to keep top-left anchor stable relative to user drag expectation.
- Relaxed min size to `560x320`.
- Removed extra `max-w/max-h` constraints on the model manager dialog class.

## File

- `packages/app/src/components/dialog-select-model.tsx`
