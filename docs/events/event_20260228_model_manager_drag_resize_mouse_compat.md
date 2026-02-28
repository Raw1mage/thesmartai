# Event: model manager drag/resize mouse compatibility fix

Date: 2026-02-28
Status: Completed

## Problem

- Drag/resize interactions did not trigger in runtime despite scroll and layout updates being effective.

## Fix

- Switched drag/resize handlers from pointer events to mouse events for broader runtime compatibility.
- Bound drag behavior to the dialog header (`[data-slot='dialog-header']`) so users can drag from the title bar as expected.
- Increased resize-handle visibility and hit area.

## Files

- `packages/app/src/components/dialog-select-model.tsx`
- `packages/app/src/components/dialog-select-model.css`
