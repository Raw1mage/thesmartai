# 2026-05-02 — provider-account-decoupling phase 4 (getSDK three-arg)

Spec: [specs/_archive/provider-account-decoupling/](../../specs/_archive/provider-account-decoupling/)
Branch: `beta/provider-account-decoupling`
Builds on: phase 3 (Auth.get two-arg)

## Phase

4 — getSDK signature change (DD-3)

## Done

- 4.1 [provider.ts:2099](../../packages/opencode/src/provider/provider.ts#L2099) — `getSDK(model)` → `getSDK(family, accountId | undefined, model)`. `family` is asserted-present in the registry; throws if not (no silent fallback). `model` retained because npm/api/headers metadata is per-model.
- 4.2 Inside `getSDK`: `s.providers[model.providerId]` → `s.providers[family]`. The "is this a managed account family" string-shape detection (`model.providerId.includes("subscription")`) replaced with explicit family allow-list (`codex` / `claude-cli` / `anthropic` / `github-copilot` / `github-copilot-enterprise` / `gemini-cli`).
- 4.3 Per-account auth/options merged via `provider.accounts?.[accountId].options` on top of family-level `provider.options`. accountId omitted → family options only (env/api-key providers).
- 4.4 SDK cache key now keys on `{ family, accountId, npm, options, hasCustomFetch }` so distinct accounts of the same family get distinct SDK instances. Was `model.providerId`-keyed which collapsed to a single bucket per family with the new family-only providerIds.
- 4.5 `getLanguage(model, accountId?)` carries the explicit account dimension through. New cache key shape: `${family}/${accountId ?? "_active_"}/${modelID}`. `peekCachedLanguage(family, modelID, accountId?)` updated to match.
- llm.ts dispatch caller passes `currentAccountId` to `getLanguage` so per-call dispatch uses the session-pinned account's auth/options (no more dependence on the family's "active account" mirror).
- `resolveExecutionModel` was a translation shim that rewrote `model.providerId` to per-account form so subsequent dispatch landed on a `providers[accountId]` entry. That conflation no longer exists; the function now returns input.model unchanged. Kept named for callers' readability; will be deleted in a later cleanup.

## Other touch-ups required for compile

- `Provider.AccountState`'s parent field on `Provider.Info` is `accounts: Record<accountId, AccountState> | undefined` (was `.default({})` which TS still typed as required — many internal `database[X] = {...}` literals missed the field). Switched to `.optional()` and use-site `if (!entry.accounts) entry.accounts = {}`.
- Renamed shadowed `familyData` in the auth-loader plugin loop (one binding above the auth probe + one below for the per-account loader was a TS2451 redeclare).
- `loader: CustomModelLoader | undefined = s.modelLoaders[family]` — explicit annotation to suppress TS2774 (Record indexer was being narrowed to non-undefined).

## Tests

- account: **24/24 pass** (XDG-isolated beta env).
- auth: **25/26 pass**. The same `family-resolution.test.ts > maps models.dev provider instances to canonical family` failure as phase 3 — pre-existing environmental issue (test depends on `~/.config/opencode/` models.dev cache, which is empty in `.beta-env/xdg-config/`). Verified again: same failure on `main` with the same isolated XDG.
- tsc on touched files: clean. The one remaining tsc error in this CLI tree (`auth.ts:93 spinner.stop`) is unrelated and pre-existing on `main`.

## Key decisions

No new DDs added.

## Drift / sync

None. tasks.md updated in lockstep.

## Remaining before next state

Phase 5 — delete `enforceCodexFamilyOnly` and the 2026-05-02 step 3b same-family hotfix in `rotation3d.ts`. Both are now structurally redundant: registry only contains family entries (DD-1), so the candidate pool naturally has `providerId === family` everywhere.
