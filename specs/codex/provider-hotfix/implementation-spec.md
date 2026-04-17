# Implementation Spec

## Goal

- Ship a bundled provider hotfix covering (1) codex logout OAuth revoke, (2) codex Responses-API context-window headers, (3) Anthropic Opus 4.7 `xhigh` effort variant, (4) `disabled_providers` auto-only runtime scope, plus (5) a submodule pointer bump to the analysis baseline — all observable per AGENTS.md 第一條.

## Scope

### IN

- New `revoke(refreshToken)` + `logout(accountId)` in `packages/opencode/src/plugin/codex-auth.ts`, wired from `Account.remove` for codex family.
- Context-window headers (`x-codex-window-id`, `x-codex-parent-thread-id`, `x-openai-subagent`) emitted alongside `ChatGPT-Account-Id`.
- Stable-per-session UUID generator for `x-codex-window-id`.
- Anthropic `xhigh` effort variant for Opus 4.7+ in `transform.ts`, gated by model id or release_date.
- Narrow `disabled_providers` runtime scope: keep `providers[id]` populated; mark auto-hidden via flag or sidecar set; update auto callers to consult the flag.
- Unit tests + trip-wire regressions for each item.
- Submodule pointer bumps in the same merge commit.
- `docs/events/event_2026-04-18_provider_hotfix.md`.

### OUT

- FedRAMP routing, Azure compaction, tool-call `resource_uri`, internal codex-rs module reorg.
- `models.dev` catalog patches for Opus 4.7 (dynamic catalog owns that).
- TUI grey-out of auto-disabled providers (separate UX task).
- Telemetry/metrics for new header delivery (future observability work).

## Assumptions

- `Account.remove(providerId, accountId)` is the single entry point for teardown of a codex account. Build agent MUST verify before coding; if there are multiple entry points they all route through a common helper where the revoke hook lives.
- The openai-family request-fetch interceptor at `account/quota/openai.ts` is the single point for per-request headers on ChatGPT accounts. Build agent MUST verify; if codex-auth carries its own interceptor, prefer extending that one.
- `Session` already exposes `parentID` and the active agent name. Build agent MUST verify before coding and adjust DD-5/DD-6 wiring if the shape differs.
- `models.dev` either already has Opus 4.7 metadata (then `xhigh` appears as soon as the transform gains the branch) or doesn't (then the branch is inert until catalog catches up). Either case is acceptable; no catalog patch in scope.
- AI-SDK anthropic provider accepts `thinking.budgetTokens` up to `model.limit.output - 1` without errors. Build agent MUST confirm by reading the provider's typings and existing `high` branch calibration.

## Stop Gates

- **Before any coding**: confirm assumptions above by reading the actual call sites. If the `Account.remove` path or the openai-family interceptor is not what this spec assumes, stop and re-plan.
- **Before touching `disabled_providers`**: inventory every consumer (`isProviderAllowed` at `provider.ts:1432,1443,1464,1609,1727,1861,2621`; default-model.ts; subscription selector). If any consumer is expected to keep the global-kill semantic, document the divergence before proceeding.
- **Before submodule pointer bump**: verify the working tree is clean and that the intended HEADs are still current; re-fetch if days passed.
- **If an upstream contract turns out different from the analysis** (e.g. revoke URL moved, header name changed): stop and escalate; do not ship with a stale URL/header.
- **If test regression appears in any area touched**: stop before commit; regressions cannot merge.

## Critical Files

- [packages/opencode/src/plugin/codex-auth.ts](../../packages/opencode/src/plugin/codex-auth.ts) — revoke + logout.
- [packages/opencode/src/account/index.ts](../../packages/opencode/src/account/index.ts) — wire logout from teardown.
- [packages/opencode/src/account/quota/openai.ts](../../packages/opencode/src/account/quota/openai.ts) — context-window headers.
- [packages/opencode/src/provider/transform.ts](../../packages/opencode/src/provider/transform.ts) — anthropic xhigh variant.
- [packages/opencode/src/provider/provider.ts](../../packages/opencode/src/provider/provider.ts) — disabled_providers auto-only (DD-9).
- [packages/opencode/src/provider/default-model.ts](../../packages/opencode/src/provider/default-model.ts) — consult auto-hidden in selection.
- Tests: `packages/opencode/test/plugin/` (codex-auth revoke), `packages/opencode/test/provider/transform.test.ts` (xhigh), `packages/opencode/test/provider/` (disabled_providers bypass).
- Docs: `docs/events/event_2026-04-18_provider_hotfix.md` (new).

## Structured Execution Phases

- **Phase 1 — codex-auth revoke + logout wiring** (HIGH, security). Add revoke helper, logout entrypoint, wire from Account.remove, fail-closed on error.
- **Phase 2 — codex Responses API context-window headers** (HIGH, protocol). Extend the openai-family interceptor (or add a sibling) to emit the three new headers. Generate stable-per-session window id.
- **Phase 3 — Anthropic `xhigh` variant for Opus 4.7+** (MEDIUM, feature). Extend `transform.ts` anthropic branch with the new variant; gate via model id / release_date.
- **Phase 4 — `disabled_providers` auto-only runtime scope** (HIGH, UX/correctness). Rework `provider.ts` post-processing + auto callers so explicit `getModel` still resolves.
- **Phase 5 — Submodule pointer bump + docs** (cleanup). Bump `refs/claude-code` → `2b53fac`, `refs/codex` → `d0eff70383`; write `docs/events/event_2026-04-18_provider_hotfix.md`.
- Phases 1–4 are independent on the code side; can be landed as separate commits on the beta branch but validated together before fetch-back.

## Validation

- **Phase 1**: unit test asserting POST to `https://auth.openai.com/oauth/revoke` with `token_type_hint=refresh_token`; on non-2xx the local account survives and the error propagates; on 2xx `log.info` fires.
- **Phase 2**: unit test against a mock fetch asserting all three headers present on a nominal `/responses` request; window-id stable across calls with the same sessionID; parent-thread-id matches `Session.parentID`.
- **Phase 3**: transform unit test: synthetic Opus 4.7 model → returned variants include `xhigh`; synthetic Opus 4.6 → do not.
- **Phase 4**: `getModel("openai", "gpt-5.4-mini")` resolves when `openai` in `disabled_providers` AND accounts exist; auto selector still skips `openai`. Observable log line fires once per post-processing sweep for each auto-hidden provider.
- **Phase 5**: `git -C refs/claude-code rev-parse HEAD` and `git -C refs/codex rev-parse HEAD` match the documented SHAs; super-repo `git status` clean after commit.
- **Regression**: `bun test packages/opencode/test/provider/` equal-or-better than current baseline (5 pre-existing failures); no new failures in `packages/opencode/test/session/`.

## Handoff

- Build agent reads this spec first, then `proposal.md`, `spec.md`, `design.md`, `tasks.md`, `handoff.md`, and `specs/architecture.md`.
- Materialize runtime todo from `tasks.md`.
- Respect Stop Gates above; escalate if an assumption is wrong.
- Phases are small and independent — each can land as its own commit on the beta branch. Validate at phase boundaries before moving on.
- At completion, compare implementation results against the five Effective Requirements in `proposal.md` and produce a validation checklist.
