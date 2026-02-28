# Event: terminal popout selection RCA (document-level fix)

Date: 2026-02-28
Status: Completed

## RCA

- Prior fixes focused mainly on terminal container handlers.
- In popout (`about:blank`) mode, native browser selection behavior can latch at document level,
  so container-local prevention was insufficient.
- Result: click-only still entered apparent selection mode and Ctrl+C copy flow was inconsistent.

## Fix

1. Add document-level mouse policy in popout window:
   - `mousedown` (left): temporarily allow text selection
   - `mousemove`: detect actual drag distance
   - `mouseup`: revert to non-select mode; clear selection on click-only
2. Keep drag selection usable (selection enabled while button is held).
3. In terminal key handling, treat browser selection text as valid selection for `Ctrl+C` copy path.

## Files

- `packages/app/src/pages/session/terminal-panel.tsx`
- `packages/app/src/components/terminal.tsx`
