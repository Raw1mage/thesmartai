# Event: origin/dev refactor item - auto-scroll pinning

Date: 2026-02-23
Status: Done

## Source

- `0ce61c817` fix(app): stay pinned with auto-scroll on todos/questions/perms

## Refactor

- Updated prompt dock resize handling in `packages/app/src/pages/session.tsx`.
- Replaced static stick threshold with delta-aware threshold:
  - `10 + Math.max(0, delta)` where `delta = nextPromptHeight - prevPromptHeight`
- Replaced manual `el.scrollTo(...)` with existing `autoScroll.forceScrollToBottom()` path.

## Why

- When dock height grows due to todos/questions/permission sections, users near bottom should remain pinned.
- Reusing `autoScroll.forceScrollToBottom()` keeps behavior consistent with existing scroll manager.
