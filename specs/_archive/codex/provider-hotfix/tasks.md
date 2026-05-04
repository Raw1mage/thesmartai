# Tasks

## 1. Phase 1 — Codex logout + OAuth revoke

- [ ] 1.1 audit `Account.remove` (and any sibling teardown entry points) in `packages/opencode/src/account/index.ts` — confirm the single hook location for codex logout.
- [ ] 1.2 integrate `revoke(refreshToken)` helper in `packages/opencode/src/plugin/codex-auth.ts` (POST `https://auth.openai.com/oauth/revoke` with `token_type_hint=refresh_token`).
- [ ] 1.3 integrate `logout(accountId)` entrypoint in `codex-auth.ts` — resolves refreshToken, calls revoke, throws on non-2xx / network error.
- [ ] 1.4 wire `logout()` from `Account.remove` when `providerId === "codex"`.
- [ ] 1.5 validate: unit test asserts POST URL + body shape; non-2xx preserves local state + propagates error; 2xx logs `log.info "codex token revoked upstream"`.

## 2. Phase 2 — Codex context-window headers

- [ ] 2.1 audit `packages/opencode/src/account/quota/openai.ts:372` + its callers — confirm it is the single interceptor for ChatGPT-account-aware headers, or identify the alternative.
- [ ] 2.2 integrate a stable-per-session `x-codex-window-id` helper (UUID v4 cached by `sessionID` in memory).
- [ ] 2.3 extend the interceptor to emit `x-codex-window-id`, `x-codex-parent-thread-id` (from `Session.parentID`), `x-openai-subagent` (from agent name if subagent, else empty).
- [ ] 2.4 validate: unit test against mocked fetch asserts all three headers present on `/responses` request; window-id stable across repeated calls with the same sessionID; parent-thread-id matches `Session.parentID`.

## 3. Phase 3 — Anthropic `xhigh` effort for Opus 4.7+

- [ ] 3.1 audit `packages/opencode/src/provider/transform.ts:549-573` anthropic branch + the OpenAI gating pattern at `:533` (`release_date >= "2025-12-04"`).
- [ ] 3.2 integrate `xhigh` variant: `thinking.budgetTokens` ≈ 32000 capped at `model.limit.output - 1`; gate on model id matching `claude-opus-4-7*` OR `release_date >= OPUS_4_7_LAUNCH_DATE`.
- [ ] 3.3 validate: transform unit test — synthetic Opus 4.7 model returns `{ low, medium, high, xhigh }`; synthetic Opus 4.6 model returns `{ low, medium, high }` (unchanged).

## 4. Phase 4 — disabled_providers auto-only runtime

- [ ] 4.1 audit every reference to `disabled` / `isProviderAllowed` / `disabled_providers` in `packages/opencode/src/provider/` (known sites: `provider.ts:1432,1443,1464,1609,1727,1861,2621`; `default-model.ts`; subscription selector; state-utils / custom-loader dead helpers).
- [ ] 4.2 delegate: pick the cleanest signal for "auto-hidden" — either add an `autoHidden: boolean` property on `Provider.Info` or export a sidecar `Set-of-provider-ids` from the provider state object.
- [ ] 4.3 rework `provider.ts:1859-1865` post-processing to mark (not delete); preserve `providers[providerId]` so `getModel` resolves.
- [ ] 4.4 update auto callers (`selectSubscriptionModel`, default-model.ts, catalog list for UI) to skip based on the new flag.
- [ ] 4.5 emit `log.info` once per post-processing sweep listing providers kept but auto-hidden; emit `log.info` when an explicit path resolves an auto-hidden provider (AGENTS.md 第一條).
- [ ] 4.6 validate: `getModel("openai", "gpt-5.4-mini")` resolves when `openai` in `disabled_providers` AND accounts exist; auto selector still skips `openai`.

## 5. Phase 5 — Submodule pointer bump + docs

- [ ] 5.1 delegate: confirm `refs/claude-code` HEAD = `2b53fac*`, `refs/codex` HEAD = `d0eff70383*`; re-fetch if stale.
- [ ] 5.2 delegate: bundle submodule pointer update into the beta branch commits.
- [ ] 5.3 write `docs/events/event_2026-04-18_provider_hotfix.md` referencing incident + every phase.
- [ ] 5.4 sync `specs/architecture.md` if the disabled_providers semantic narrowing deserves a note under the provider boundary section (likely a one-paragraph addition).

## 6. Validation & Regression

- [ ] 6.1 run `bun test packages/opencode/test/provider/` — confirm no new failures beyond main baseline (5 pre-existing).
- [ ] 6.2 run `bun test packages/opencode/test/session/` — confirm nothing regressed.
- [ ] 6.3 run `bun test packages/opencode/test/plugin/` — confirm codex-auth changes covered and existing anthropic tests still pass.
- [ ] 6.4 run the planner `plan-validate.ts` on this plan package — 10/10 pass.

## 7. Documentation / Retrospective

- [ ] 7.1 append `docs/events/` final status after merge.
- [ ] 7.2 compare final implementation vs `proposal.md` Effective Requirement Description (5 items).
- [ ] 7.3 produce validation checklist: requirement coverage, gap, deferred, evidence.
