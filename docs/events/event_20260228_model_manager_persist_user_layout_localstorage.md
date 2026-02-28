# Event: persist model manager user layout in localStorage

Date: 2026-02-28
Status: Completed

## Decision

- Persist model manager dialog custom size/position in browser localStorage.

## Details

- Storage key: `opencode.web.modelManager.layout.v1`
- Saved fields: `width`, `height`, `x`, `y`
- On open, restore persisted values and normalize with existing minimum constraints.

## File

- `packages/app/src/components/dialog-select-model.tsx`
