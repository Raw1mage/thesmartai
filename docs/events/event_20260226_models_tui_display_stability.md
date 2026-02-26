# Event: Models TUI display and selection stability

Date: 2026-02-26
Status: Done

## Summary

- Removed the current-model leading dot indicator in the `/models` selector and kept highlight-based emphasis.
- Fixed favorite star rendering so model text alignment does not shift when toggling favorite.
- Preserved cursor position on the same model row when favorites are toggled and the options list reorders.

## Key Decisions

- Applied `hideCurrentIndicator` only for the models dialog to avoid changing other dialogs.
- Kept a fixed-width suffix (`★` / space) and fixed indentation for model rows.
- Updated dialog selection sync logic to prefer value-based row retention over index-based retention when option lists change.

## Validation

- `bun x eslint src/cli/cmd/tui/component/dialog-model.tsx src/cli/cmd/tui/ui/dialog-select.tsx` passed.
- `bun run typecheck` reports known baseline failures in `src/plugin/antigravity/plugin/storage.legacy.ts` (non-blocking; unrelated to this change).
