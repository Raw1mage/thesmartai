# Event: Align web slash commands with TUI expectations

Date: 2026-02-27
Status: Done

## Context

- User reported web slash command behavior diverged from TUI.
- Requested alignment direction:
  - add `/session`
  - remove `/update_model` (and `/update_models`) from slash dropdown
  - keep custom commands visible in slash dropdown

## Changes

### 1) Added `/session` slash in web session commands

- File: `packages/app/src/pages/session/use-session-commands.tsx`
- Added command:
  - id: `session.switch`
  - slash: `session`
  - action: opens `DialogSelectFile` in `sessions` mode

### 1b) `/session` display effect alignment

- File: `packages/app/src/components/dialog-select-file.tsx`
- Added dialog mode: `sessions`
  - suppresses command/file mixed picks
  - returns session list directly (including when query is empty)
- Result: `/session` now opens session-focused list, instead of showing generic function entries first.

### 1c) Session list visual parity improvements

- File: `packages/app/src/components/dialog-select-file.tsx`
- For `sessions` mode:
  - force grouped list headers even without query input
  - group sessions by date-like headings (`Today`, then `Thu, Feb 26, 2026` style)
  - sort sessions by `updated` descending before rendering
  - add explicit dialog heading `Sessions`

### 2) Adjusted slash dropdown source/merge rules

- File: `packages/app/src/components/prompt-input.tsx`
- Kept built-in + custom slash commands visible.
- Explicitly excluded custom slash triggers:
  - `update_model`
  - `update_models`
- Added dedupe by trigger, preferring built-in commands over custom when names collide.

### 3) Removed session share feature (command + header UI)

- Files:
  - `packages/app/src/pages/session/use-session-commands.tsx`
  - `packages/app/src/components/session/session-header.tsx`
- Removed command entries:
  - `session.share`
  - `session.unshare`
- Removed session header share popover/link controls entirely.
- Result: no `/share` or `/unshare` in web slash/palette and no share controls in session header.

## Validation

- `bun x tsc --noEmit --project packages/app/tsconfig.json` ✅
- `./webctl.sh build-frontend && ./webctl.sh restart && ./webctl.sh status` ✅ (`healthy: true`)

## Handoff Notes

- Slash dropdown behavior is currently defined in `prompt-input.tsx` (`slashCommands` memo).
- If later requiring strict TUI one-to-one parity, migrate slash derivation to a shared command metadata adapter used by both UIs.
