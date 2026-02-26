# Batch7 Phase E7A Refactor Port (rewrite-only)

Date: 2026-02-27
Source: `origin/dev`
Target: `cms`

## Scope

- Ported upstream commit intent: `6d58d899f` (`fix: e2e test outdated`).
- Policy followed: rewrite-only refactor-port (no cherry-pick/merge).

## Changes

1. Removed obsolete sound-enabled selector exports that no longer exist in app runtime:
   - `settingsSoundsAgentEnabledSelector`
   - `settingsSoundsPermissionsEnabledSelector`
   - `settingsSoundsErrorsEnabledSelector`
2. Updated e2e settings test behavior from legacy switch toggle to current UX:
   - Replaced "disable via switch" with selecting `none` in sound agent select.
   - Assertion now validates `stored?.sounds?.agent === "none"`.

## Validation

- Ran: `bun run test:e2e -- --list` (in `packages/app`)
- Result: **failed** due pre-existing e2e module export issues (`./utils` missing `promptSelector` / `terminalSelector` exports), unrelated to this batch diff.
- This batch remains a narrow e2e selector/spec parity update.

## Notes

- `92ab4217c` (`desktop: bring back -i in sidecar arguments`) remains deferred pending dedicated decision against cms desktop `-l` + shell-env merge hardening strategy.
