# Event: model manager resize cap RCA (content fixed height)

Date: 2026-02-28
Status: Completed

## Problem

- Dialog appeared to have a hard maximum height even after relaxing resize clamps.

## RCA

- Resize logic updates `dialog-container` size via inline style.
- But dialog content class still had fixed Tailwind dimensions (`w-[900px] h-[620px]`), visually capping the panel.

## Fix

- Switched dialog content sizing to fill container (`w-full h-full`) with min constraints.

## File

- `packages/app/src/components/dialog-select-model.tsx`
