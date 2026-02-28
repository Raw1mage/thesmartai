# Event: terminal unwanted selection-mode RCA fix

Date: 2026-02-28
Status: Completed

## Problem

- Clicking terminal once then moving mouse could create large browser text-highlight selection, which feels like "auto selection mode".

## RCA

- Terminal container had `select-text` class, enabling native browser text selection on wrapper layer.
- This conflicted with expected terminal interaction model (selection should only happen on intentional drag inside terminal renderer behavior).

## Fix

- Switched terminal wrapper from `select-text` to `select-none` to disable native page-level text selection bleed.

## File

- `packages/app/src/components/terminal.tsx`
