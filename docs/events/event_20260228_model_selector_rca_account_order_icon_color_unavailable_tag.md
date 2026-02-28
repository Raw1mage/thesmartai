# Event: model selector RCA and UX fixes (account order / icon color / unavailable tag)

Date: 2026-02-28
Status: Completed

## RCA

1. Account row appears to "jump away" after click
   - Root cause: account rows were sorted with `active` first in `buildAccountRows`, so switching active account reorders the list immediately.

2. Eye/ban icons still looked monochrome
   - Root cause: `IconButton` ghost variant stylesheet sets icon color directly on `[data-slot="icon-svg"]`, which overrides button text color classes.

3. "Unavailable" tag noise in Show All mode
   - Root cause: model item always rendered unavailable tag whenever `unavailableReason` existed, regardless of mode.

## Fixes

- Keep account list order stable by sorting by label only (remove `active`-first sort).
- Apply icon color classes directly to icon SVG slot via selector class:
  - enabled eye -> success (green)
  - disabled ban -> danger (red)
- Hide unavailable tag in `all` mode (`showUnavailableTag={mode() !== "all"}`).

## Changed Files

- `packages/app/src/components/model-selector-state.ts`
- `packages/app/src/components/dialog-select-model.tsx`
