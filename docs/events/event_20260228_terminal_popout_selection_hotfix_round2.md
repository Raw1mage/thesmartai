# Event: terminal popout selection/copy hotfix round 2

Date: 2026-02-28
Status: Completed

## User-reported issues

1. Drag-select only worked in a constrained center region.
2. Selection looked present but copy did not work reliably.

## Changes

- Added `ignoreStoredViewport` option to `Terminal` and enabled it for popout route.
  - Popout no longer reuses persisted inline viewport dimensions as initial render box.
  - Websocket cursor starts from `0` in this mode for deterministic replay.
- Added extra `fit()` kicks right after mount (`immediate`, `0ms`, `60ms`) to reduce stale viewport frame.
- Hardened selection copy hooks:
  - Auto-copy uses document-level `mouseup` capture + microtask to wait for finalized selection.
  - Right-click copy listens at document-level capture and only applies when event target is inside terminal container.

## Files

- `packages/app/src/components/terminal.tsx`
- `packages/app/src/pages/session/terminal-popout.tsx`
