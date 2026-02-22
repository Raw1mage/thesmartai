# Event: origin/dev refactor round (feed customization + sound UX)

Date: 2026-02-23
Status: Done

## 1. Scope

- Source commits (origin/dev):
  - `aaf8317c8` feat(app): feed customization options
  - `ce2763720` fix(app): better sound effect disabling ux
- Target: `HEAD` (cms working branch)

## 2. Refactor Decisions

1. Feed customization port (cms-compatible subset):
   - Added settings for default expansion behavior of tool parts:
     - `general.shellToolPartsExpanded`
     - `general.editToolPartsExpanded`
   - Added `Feed` section in Settings UI for these toggles.
   - Wired settings through session timeline -> session turn -> message part rendering so tool parts can open by default based on tool type.

2. Sound UX port:
   - Added `None` option in sound selects.
   - Selecting `None` now disables the corresponding sound channel and stops preview playback.
   - Sound selects now drive enabled state directly (instead of separate switch + select pairing).

3. i18n:
   - Added required new English keys for feed section/rows and `sound.option.none`.
   - Other locales remain partial dictionaries and fall back behavior remains unchanged.

## 3. Changed Files

- `packages/app/src/context/settings.tsx`
- `packages/app/src/components/settings-general.tsx`
- `packages/app/src/pages/session/message-timeline.tsx`
- `packages/app/src/i18n/en.ts`
- `packages/ui/src/components/session-turn.tsx`
- `packages/ui/src/components/message-part.tsx`

## 4. Validation

- `bun run --cwd /home/pkcs12/projects/opencode/packages/ui typecheck` ✅
- `bun run --cwd /home/pkcs12/projects/opencode/packages/app typecheck` ⚠️
  - Fails on pre-existing app issue outside this change:
    - `src/context/local.tsx(94,62): Property 'split' does not exist on type 'Model'`
