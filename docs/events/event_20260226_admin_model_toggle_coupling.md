# Event: admin model toggle coupling and feedback

Date: 2026-02-26
Status: Done

## Goal

Improve Admin/Model toggle UX so favorite/hidden states remain consistent and every toggle state change has immediate toast feedback.

## Decisions

- Coupling rule moved to local model state actions (`local.model.toggleFavorite`, `local.model.toggleHidden`) as single behavior source:
  1. Add favorite => auto-unhide if model is hidden.
  2. Hide model => auto-remove from favorites if model is favorited.
- Toggle feedback is emitted at state mutation points to keep behavior consistent across both `DialogAdmin` and `DialogModel`.

## Changes

- `packages/opencode/src/cli/cmd/tui/context/local.tsx`
  - Added coupled state transitions between `favorite` and `hidden`.
  - Added toast messages for model favorite/hide/unhide toggles.
  - Removed duplicate `save()` call in favorite toggle path.
- `packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx`
  - Added toast for `Show All` toggle.
  - Changed model delete action in model-select to use hide toggle path (so hide removes favorite by contract).
  - Tightened `Unhide` action: only unhide if currently hidden; warns if already visible.
- `packages/opencode/src/cli/cmd/tui/component/dialog-model.tsx`
  - Removed duplicated local coupling logic (now delegated to `local` model toggles).
  - Added toasts for provider hide/unhide and show-hidden mode toggles.

## Validation

- `bun run typecheck` (in `packages/opencode`) ⚠️ baseline known noise only:
  - `src/plugin/antigravity/plugin/storage.legacy.ts` (`vitest` module / implicit any)
  - Not touched in this change; treated as non-blocking per current project baseline rule.

## Notes

- This is a behavior/UX consistency fix; architecture document update is not required.
