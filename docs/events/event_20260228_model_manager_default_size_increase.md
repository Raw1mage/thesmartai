# Event: increase model manager default opening size

Date: 2026-02-28
Status: Completed

## Decision

- Increase model manager default open size to a larger, viewport-relative frame.

## Details

- Default size now initializes to about `78%` of viewport.
- Still respects minimum size (`900x620`) and avoids overflowing initial viewport (`window - 16px`).

## File

- `packages/app/src/components/dialog-select-model.tsx`
