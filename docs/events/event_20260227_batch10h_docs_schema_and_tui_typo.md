# Batch10H Docs schema URL + TUI command typo fixes (rewrite-only)

Date: 2026-02-27
Source: `origin/dev` (`444178e07`, `b16f7b426`, `286992269`)
Target: `cms`

## Scope

- Port low-risk documentation correctness updates.

## Changes

1. Share docs schema URL normalization
   - Updated all localized `packages/web/src/content/docs/**/share.mdx` examples:
     - `https://opncd.ai/config.json` -> `https://opencode.ai/config.json`
2. TUI docs command typo fix
   - `packages/web/src/content/docs/tui.mdx`
   - Corrected command example from `/theme` to `/themes`.

## Assessment

- Upstream `286992269` (Copilot provider description in app i18n) is **integrated** in cms baseline (equivalent GitHub Copilot wording already present for affected locales), so no code change needed in this batch.

## Validation

- Verified no remaining `https://opncd.ai/config.json` in `docs/**/share.mdx`.
- Reviewed representative diffs for docs updates.
