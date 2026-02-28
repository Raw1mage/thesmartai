# Event: terminal popout blank-text RCA (cursor replay policy)

Date: 2026-02-28
Status: Completed

## Problem

- Popout terminal could open with dark background but no visible text content.

## RCA

- `skipRestore` path disabled local buffer restore and also requested websocket cursor `-1` (tail),
  which can produce an effectively empty viewport until new output arrives.

## Fix

- Keep `skipRestore` for stale-frame prevention, but change websocket cursor strategy to `0`
  so popout can replay server-side terminal content instead of starting at tail.

## File

- `packages/app/src/components/terminal.tsx`
