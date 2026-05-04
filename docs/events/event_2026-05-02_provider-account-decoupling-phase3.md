# 2026-05-02 — provider-account-decoupling phase 3 (Auth.get two-arg)

Spec: [specs/_archive/provider-account-decoupling/](../../specs/_archive/provider-account-decoupling/)
Branch: `beta/provider-account-decoupling`
Builds on: phase 2 (registry shape rewrite)

## Phase

3 — Auth lookup signature change (DD-2)

## Done

- 3.1 [auth/index.ts:82](../../packages/opencode/src/auth/index.ts#L82) `Auth.get` signature changed to `(family, accountId?)`. Legacy single-arg `Account.getById(providerId)` exact-match branch deleted (DD-2, DD-8). No string-shape inference, no `parseProvider` recovery.
- 3.2 Throws `UnknownFamilyError` when `family` is not in `Account.knownFamilies({ includeStorage: true })`.
- 3.3 Three-way semantics for the no-accountId case:
  - family has 0 accounts → returns `undefined` (probes still work)
  - family has accounts but no `activeAccount` → throws `NoActiveAccountError`
  - family has active → returns active account's auth
- 3.4 [provider.ts:1666-1700](../../packages/opencode/src/provider/provider.ts#L1666-L1700) — `loadAuth` closure rewritten to `(family, accountId?)`. The auth-existence probe (formerly `Auth.get(family) → if undefined → loop accounts`) is replaced with direct inspection of `allFamilies[family].accounts` and `activeAccount`, then a single `Auth.get(family)` call only when an active is set. Same logic for github-copilot enterprise probe at line 1697.
- 3.5 [agent.ts:381](../../packages/opencode/src/agent/agent.ts#L381) — single-arg call kept; `defaultModel.providerId` is family per phase 2 (DD-4).
- 3.6 [mcp/app-registry.ts:360](../../packages/opencode/src/mcp/app-registry.ts#L360) — `Auth.get(accountId)` → `Auth.get(providerKey, accountId)`. providerKey was already in scope two lines up.
- 3.7 [custom-loaders-def.ts](../../packages/opencode/src/provider/custom-loaders-def.ts) — `Auth.get(input.id)` callers (lines 35/276/313/357) all pass loader's `input.id` which is family-form per the loader contract; single-arg → active account is correct.
- 3.7 [llm.ts:445-450](../../packages/opencode/src/session/llm.ts#L445-L450) — `Auth.get(executionModel.providerId)` → `Auth.get(executionModel.providerId, currentAccountId ?? undefined)`. Dispatch carries account identity explicitly.
- 3.7 [cli/cmd/auth.ts:266](../../packages/opencode/src/cli/cmd/auth.ts#L266) — variable `providerId` was actually an `accountId` (returned from `Auth.listAccounts`). Renamed; passes `(args.provider, accountId)`.
- 3.8 grep audit complete. Remaining single-arg call sites all pass family-form values:
  - explicit literals: `"codex"`, `"amazon-bedrock"`, `"sap-ai-core"`, `"github-copilot-enterprise"`
  - bound family vars: `family`, `copilotID`, `enterpriseProviderID`, `defaultModel.providerId`, `input.id` (loader contract)

## Tests

- `bun test packages/opencode/test/account/` → **24/24 pass** in beta XDG-isolated env
- `bun test packages/opencode/test/auth/` → **25/26 pass**, 1 fail (`family-resolution.test.ts > maps models.dev provider instances to canonical family`)
  - Failure exists on `main` with the same isolated XDG (verified) — test relies on the global `~/.config/opencode/` models.dev cache, which is empty in `.beta-env/xdg-config/`. Not a regression.
  - Updated the test to use the new two-arg form for the second `Auth.get` call (was the only place that passed instance form `"nvidia-work"`); the first failure is upstream of that, in test-setup contract.
- Spec contract change: callers passing instance-form (e.g. `"nvidia-work"`) to `Auth.get` now throw `UnknownFamilyError` by design (DD-2, DD-8). This is the regression guard for the 2026-05-02 bug class.

## Key decisions

No new DDs added. One refinement: empty-family case (0 accounts) returns `undefined` rather than throwing, so probes (`if (await Auth.get(family))`) still work when a family exists in knownFamilies but no accounts have been added. Inconsistent state (accounts exist, no active) throws.

## Drift / sync

None. tasks.md updated in lockstep. New error contract documented in spec.md §Acceptance Checks already; observability.md `auth.lookup.failed` event will fire on the new throws.

## Remaining before next state

Phase 4 (`getSDK` signature change). After phase 4, `getSDK(model)` becomes `getSDK(family, accountId, modelId)` and the legacy `s.providers[model.providerId]` lookup that previously could land on a per-account entry is gone.
