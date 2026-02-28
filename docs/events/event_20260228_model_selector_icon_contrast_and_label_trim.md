# Event: model selector icon contrast and zh-TW label trim

Date: 2026-02-28
Status: Completed

## Decision

- Improve model selector visibility-state affordance by color-coding action icons.
  - eye (visible/enabled) -> green
  - ban (disabled/hidden) -> red
- Trim zh-TW mode labels to shorter wording for compact UI.
  - curated: `選精`
  - all: `全部`

## Changed Files

- `packages/app/src/components/dialog-select-model.tsx`
- `packages/app/src/i18n/zht.ts`
