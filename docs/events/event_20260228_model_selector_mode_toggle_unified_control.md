# Event: model selector mode unified toggle control

Date: 2026-02-28
Status: Completed

## Decision

- Replace the two separate mode buttons (`curated`, `all`) in model selector with a single two-state toggle control.
- Keep compact labels (`選精` / `全部` in zh-TW) and make the active state visually explicit via a sliding highlight.

## Why

- Reduce header control noise and make mode switching feel like one binary choice.
- Match requested UX: one switch-like control instead of two independent buttons.

## Changed File

- `packages/app/src/components/dialog-select-model.tsx`
