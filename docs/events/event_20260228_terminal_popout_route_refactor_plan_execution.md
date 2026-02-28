# Event: terminal popout refactor to dedicated route/window

Date: 2026-02-28
Status: In Progress

## Decision

- Stop using `about:blank + Portal` for terminal popout rendering.
- Switch to a dedicated same-origin route rendered in an independent browser window.

## Why

- Current cross-document portal approach mixes browser-native selection, renderer interaction, and app-level event patches.
- This caused persistent click-selection latch and copy inconsistency issues.

## Changes in this round

1. Added new route page: `pages/session/terminal-popout.tsx`.
2. Added router entry: `/:dir/session/:id?/terminal-popout`.
3. Terminal panel popout now opens the route URL directly via `window.open(url)`.
4. Removed portal-based popout mount path from `terminal-panel.tsx`.
5. Reverted terminal component to generic behavior (removed popout-only selection/restore special handling).
