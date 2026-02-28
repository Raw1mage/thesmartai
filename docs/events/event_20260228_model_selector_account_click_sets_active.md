# Event: model selector account click now switches active account

Date: 2026-02-28
Status: Completed

## Problem

- In model selector account column, clicking another account only changed local selection highlight.
- Active-account checkmark remained on old account because `account.setActive` was only called on model selection.

## Decision

- Make account-row click perform active account switch immediately via `sdk.client.account.setActive`.
- After successful switch, refetch account list so active-account checkmark updates in-place.

## Changed File

- `packages/app/src/components/dialog-select-model.tsx`
