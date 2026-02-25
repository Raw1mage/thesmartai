# Event: origin/dev refactor round14 (plugin auth providers in login picker)

Date: 2026-02-25
Status: Done

## Source behavior

- Upstream reference: `4ccb82e81ab664f53a9ab0d84ea99c18c50dc5c3`
- Intent: include plugin-provided auth providers in `auth login` provider picker.

## Rewrite-only port in cms

- `packages/opencode/src/cli/cmd/auth.ts`
  - Added `resolvePluginProviders(...)` pure helper to compute plugin auth providers that should appear in picker.
  - Integrated helper into `AuthLoginCommand` provider options, with `hint: "plugin"` labels.
  - Rules preserved:
    - dedupe provider IDs across hooks
    - skip providers already present in models list
    - respect `disabled_providers`
    - respect `enabled_providers` when set
    - use configured provider display name when available

- `packages/opencode/test/cli/plugin-auth-picker.test.ts`
  - Added unit tests for helper behavior (inclusion, dedupe, enabled/disabled filtering, naming, hooks without auth).

## Additional analysis decision

- `693127d382abed14113f3b7a347851b7a44d74cd`: integrated.
  - `run` command already supports `--dir` and forwards directory on attach path in current cms.

## Validation

- `bun test packages/opencode/test/cli/plugin-auth-picker.test.ts` ✅
- `bun run packages/opencode/src/index.ts auth login --help` ✅
