# Event: model manager dialog density, layout, and scrollbar consistency

Date: 2026-02-28
Status: Completed

## Changes

1. Header density + title

- Reduced dialog header visual thickness for model selector dialog.
- Updated zh-TW title from `選擇模型` to `模型管理員`.

2. Three-column consistency

- Switched model selector content area to equal-width 3-column grid.
- Unified column scroll behavior with visible scrollbars when content overflows.

## Files

- `packages/app/src/components/dialog-select-model.tsx`
- `packages/app/src/components/dialog-select-model.css`
- `packages/app/src/i18n/zht.ts`
