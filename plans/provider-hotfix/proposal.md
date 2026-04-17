# Proposal: Provider Hotfix (Upstream Sync + disabled_providers Bypass)

## Why

- **openai provider silently unusable**: operator had historically added `openai` to `disabled_providers` to suppress auto-catalog noise, but the provider plugin treats `disabled_providers` as a *global* kill switch — `providers["openai"]` is deleted during post-processing ([`provider.ts:1859-1865`](../../packages/opencode/src/provider/provider.ts#L1859-L1865)). Explicit `getModel("openai", "gpt-5.4-mini")` then failed with `ModelNotFoundError` ([`provider.ts:2316`](../../packages/opencode/src/provider/provider.ts#L2316)) even though the user had an OAuth subscription account for it and was deliberately selecting it. Mirrors the manual-pin-bypass issue fixed earlier today (`plans/manual-pin-bypass-preflight/`): auto suppression leaking into explicit user intent.
- **Upstream drift on provider plugins**: `refs/claude-code` advanced 31 commits and `refs/codex` advanced 774 commits since our 2026-03-21 pointer bump. Filtering noise leaves three concrete gaps — codex logout does not revoke OAuth tokens upstream, codex `/responses` requests miss three new context-lineage headers, and our Anthropic `xhigh` effort variant does not cover Opus 4.7.
- **Silent pathologies accumulating if untreated**: orphaned backend tokens after logout; degraded server-side cache hit rates for codex; no higher-budget thinking variant for Opus 4.7 Max users; operator-discovered "why can't I pick a perfectly-healthy account" UX trap.

## Original Requirement Wording (Baseline)

- "請你 pull 最新的 codex-cli 和 claude-code，然後分析程式碼有什麼更新需要同步到我們的 claude provider 和 codex provider"
- "寫成 plan，再用 beta workflow 修"
- "這個 plan 是 provider-hotfix，連 openai 不能動的問題也一起看一下"

## Requirement Revision History

- 2026-04-18 v0 — initial scope: codex token revoke (HIGH), codex context-window headers (HIGH), Anthropic Opus 4.7 xhigh (MEDIUM). Excluded FedRAMP routing, Azure compaction, tool-call `resource_uri`.
- 2026-04-18 v1 — scope expanded and folder renamed `upstream-sync-202604/` → `provider-hotfix/` after operator reported that `disabled_providers` was also blocking explicit openai selection. Added Phase 4 to honor the manual-pin-bypass philosophy on the disabled_providers surface.

## Effective Requirement Description

1. **Codex logout MUST call upstream OAuth token revocation** before clearing local credentials, fail-closed (AGENTS.md 第一條: no silent fallback on logout failure).
2. **Codex `/responses` calls MUST carry** `x-codex-window-id`, `x-codex-parent-thread-id`, and `x-openai-subagent` headers, matching the 2026-04 upstream baseline.
3. **Our Anthropic effort transform MUST surface `xhigh`** for Opus 4.7+ models with a calibrated thinking budget.
4. **`disabled_providers` MUST NOT block explicit provider selection.** The semantics become "hide from auto-catalog and default-model selection" (UI / auto path), not "globally unload the provider". Explicit `getModel(providerId, modelId)` calls and pinned session accounts referencing the provider continue to resolve.
5. **Submodule pointers (`refs/claude-code`, `refs/codex`) are bumped** to the HEADs used for the analysis so future sync diffs start from a known baseline.

## Scope

### IN

- New `codex-auth.ts` logout flow that posts to `https://auth.openai.com/oauth/revoke` (refresh_token hint) and fails-closed if the call errors.
- Header builder that injects the three new context-window headers on every Codex Responses API request.
- Anthropic branch in `transform.ts` gains `xhigh` effort for Opus 4.7+ models, budget calibrated to match upstream semantics.
- Rescope `isProviderAllowed` in `provider.ts`: keep the auto/catalog gate, but preserve `providers[providerId]` so explicit `getModel` + session-pinned flows continue to work.
- Submodule pointer bump: `refs/claude-code` → `2b53fac`, `refs/codex` → `d0eff70383`.
- Unit tests / regression trip-wires per item. Plan + `docs/events/event_2026-04-18_provider_hotfix.md`.

### OUT

- FedRAMP routing (`chatgpt_account_is_fedramp`) — no current customer need.
- Azure remote compaction — no Azure deployment committed.
- Tool-call `mcp_app_resource_uri` metadata — app-server protocol we do not emit.
- Internal codex-rs module reorganization — public API unchanged.
- Model catalog additions (e.g. registering Opus 4.7 in `models.dev`) — dynamic catalog; separate concern.
- TUI-level UI changes to grey-out auto-disabled providers — follow-up UX work tracked separately.

## Non-Goals

- Full feature parity with upstream codex-rs beyond the documented surface.
- Refactoring the Codex header pipeline beyond the additive new headers.
- Changing how operators *declare* `disabled_providers` (file format unchanged); only the *runtime interpretation* is scoped.

## Constraints

- AGENTS.md 第零條 (plan-first): this document satisfies that gate.
- AGENTS.md 第一條 (no silent fallback): every new path (logout revoke, header build, provider-disabled-but-explicit-requested) must log explicitly on edge conditions.
- Existing consumers of `codex-auth.ts`, `transform.ts`, `provider.ts` must keep passing without behavior changes for operators who are already working happily.
- The `disabled_providers` semantic shift is behavior-preserving for the **auto** path (same as today) and strictly permissive for the **manual** path — no new block.

## What Changes

- `packages/opencode/src/plugin/codex-auth.ts` — add `revoke(refreshToken)` helper, wire a `logout(accountId)` entrypoint called from `Account.remove` (codex family).
- Codex request header builder (near `packages/opencode/src/account/quota/openai.ts:372` where `ChatGPT-Account-Id` already lives, or a new dedicated helper) — emit `x-codex-window-id`, `x-codex-parent-thread-id`, `x-openai-subagent`.
- `packages/opencode/src/provider/transform.ts` Anthropic branch — add `xhigh` variant for Opus 4.7+ models with calibrated budget.
- `packages/opencode/src/provider/provider.ts` — split the auto/manual paths for `disabled_providers`. The post-processing delete at line 1859-1865 becomes conditional on the auto path; explicit lookups via `getModel(providerId, modelId)` and pinned-session flows resolve normally.
- Submodule pointer bumps via the super-repo commit.

## Capabilities

### New Capabilities

- **Codex secure logout**: backend OAuth revoke before local teardown.
- **Codex context-window lineage**: upstream caching / abuse-detection headers.
- **Anthropic xhigh reasoning for Opus 4.7+**: exposes Anthropic's higher-budget variant.
- **Explicit provider override**: `disabled_providers` is an auto-gate, not a global kill.

### Modified Capabilities

- **Codex request headers**: existing callers automatically gain the three new headers.
- **Anthropic effort catalog**: one extra variant conditional on Opus 4.7+ model id or release date.
- **`disabled_providers` semantics**: same file format, narrower runtime scope.

## Impact

- Codex OAuth teardown is now network-dependent; failures surface to operator.
- Codex Responses API gains metadata headers; upstream may start honoring them for cache.
- Anthropic UI shows `xhigh` option for Opus 4.7+ models; other Claude models unchanged.
- Operators who put common providers in `disabled_providers` see those providers re-appear on explicit use (but stay suppressed in auto contexts).
- `refs/` submodule baseline advanced — future drift analysis starts clean.
- New docs/events entry + plan package per AGENTS.md.
