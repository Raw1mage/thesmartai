# Design: Provider Hotfix

## Context

- Our provider surface today: `packages/opencode/src/plugin/codex-auth.ts` (codex OAuth/refresh), `packages/opencode/src/provider/codex-compaction.ts` (codex-specific compaction), `packages/opencode/src/provider/provider.ts` (shared lifecycle, rotation integration, post-processing filter), `packages/opencode/src/provider/transform.ts` (effort/variant mapping per SDK), `packages/opencode/src/account/quota/openai.ts` (per-request header injection for ChatGPT accounts).
- `refs/claude-code` is the vendored claude-cli repo; `refs/codex` is vendored codex-rs. Both advanced significantly since 2026-03-21.
- The `disabled_providers` operator list has three consumers today: (a) env-var / auth loop at `provider.ts:1432-1443`, (b) account iteration loop at `provider.ts:1463`, (c) post-processing filter at `provider.ts:1859-1865`, plus the subscription selector at `provider.ts:2621` and default-model picker.
- Earlier today (2026-04-17) we already shipped the sibling principle via `plans/manual-pin-bypass-preflight/`: pre-flight cooldown rotation only fires when the account was auto-resolved (`!sessionPinnedAccountId`). Phase 4 below extends that principle to `disabled_providers`.

## Goals / Non-Goals

**Goals:**
- Close the four concrete gaps identified by the 2026-04-18 upstream-drift analysis + `openai`-unusable report.
- Keep changes additive where possible; every new path has observable logging.
- Align `disabled_providers` runtime scope with the already-shipped manual-pin-bypass philosophy.

**Non-Goals:**
- Full codex-rs parity (FedRAMP, Azure compaction, tool-call resource_uri, internal module layout).
- Changing `disabled_providers` file format or semantics in user docs — only the runtime interpretation narrows.
- Refactoring the codex header pipeline beyond the three new headers.

## Decisions

- **DD-1 Logout revoke is fail-closed.** If the POST to `https://auth.openai.com/oauth/revoke` errors, do NOT clear local state. Operator sees the error and can retry. Rationale: silent swallow violates AGENTS.md 第一條; a clean local state with an orphaned upstream token is worse than a re-runable error.

- **DD-2 Revoke helper lives in `codex-auth.ts`; logout orchestration lives at the Account layer.** The Account module already owns account lifecycle; `Account.remove(providerId, accountId)` will call `CodexAuth.logout(accountId)` when `providerId === "codex"`, which internally calls `revoke(refreshToken)` then returns success. Rationale: mirrors existing separation where codex-auth owns token mechanics and Account owns storage teardown.

- **DD-3 Context-window headers emitted via the existing openai-family request fetch interceptor.** The place `ChatGPT-Account-Id` is set ([`account/quota/openai.ts:372`](../../packages/opencode/src/account/quota/openai.ts#L372)) is our natural extension point. We extend that helper (or add a sibling) to also emit `x-codex-window-id`, `x-codex-parent-thread-id`, `x-openai-subagent`. Rationale: avoids a second parallel codex-specific transport; keeps all ChatGPT-account-aware header work in one file.

- **DD-4 `x-codex-window-id` is UUID-per-conversation, generated on first request and cached on the session.** Upstream uses it for server-side cache keying. We keep a stable value per `sessionID` in-memory (no disk persistence needed — on daemon restart a fresh id is fine; cache miss is acceptable). Rationale: matches upstream semantics; no persistence overhead.

- **DD-5 `x-codex-parent-thread-id` sourced from `Session.parentID` when the session has one, else empty.** Our session model already tracks parent sessions for sub-agent dispatch. Direct mapping.

- **DD-6 `x-openai-subagent` sourced from the session's agent name or a workflow-provided lineage tag.** Minimal implementation: empty for top-level sessions, set to `agent.name` (e.g. `coding`, `cron`) for subagent sessions. Upstream accepts arbitrary strings for lineage tracking.

- **DD-7 Anthropic `xhigh` budget is calibrated to ~32 000 tokens for Opus 4.7+, capped by `model.limit.output - 1`.** Rationale: upstream docs for `xhigh` suggest a step above `high`'s 16 000 budget; Opus 4.7 output limit is large enough to support this. If operator-reported upstream semantics differ, adjust.

- **DD-8 `xhigh` gate is on `release_date >= opus-4.7-launch` or model id matching `claude-opus-4-7*`.** Mirrors the existing OpenAI guard at [`transform.ts:533`](../../packages/opencode/src/provider/transform.ts#L533) (`release_date >= "2025-12-04"`). Rationale: consistent pattern across provider branches.

- **DD-9 `disabled_providers` scope narrowing is done by keeping `providers[providerId]` populated and instead filtering at the AUTO call sites.** Concretely: the post-processing delete at `provider.ts:1859-1865` becomes a "mark as auto-hidden" (e.g. an extra `autoHidden: true` flag on the Provider.Info, or a sidecar `Set-of-provider-ids` exported alongside `providers`). `getModel(providerId, modelId)` continues to look up `providers[providerId]` unchanged. Auto pickers (`selectSubscriptionModel`, `default-model.ts`, catalog list for UI) consult the `autoHidden` flag and skip. Rationale: smallest-blast-radius change; avoids rewriting the env/auth/account loops.

- **DD-10 Refs submodule pointer commit bundled with the code changes.** Rationale: keep baseline + code change atomic; if we need to roll back, the pointer reverts with the code.

## Data / State / Control Flow

### Codex logout

```
operator triggers Account.remove(codex, ACCOUNTID)
  → CodexAuth.logout(ACCOUNTID)
      → resolve refreshToken from account entry
      → POST https://auth.openai.com/oauth/revoke
            body: { token: refreshToken, token_type_hint: "refresh_token" }
      → if non-2xx / network error: log.warn + throw RevokeError (local state NOT cleared)
      → if 2xx: log.info "codex token revoked upstream"
  → Account.remove continues local teardown
```

### Codex Responses API headers

```
LLM.stream → openai provider fetch()
  → interceptor (existing): set ChatGPT-Account-Id (account/quota/openai.ts:372)
  → interceptor (new): set
       x-codex-window-id        = stableWindowIdFor(sessionID)
       x-codex-parent-thread-id = session.parentID ?? ""
       x-openai-subagent        = session.agent.name if subagent, else ""
  → outbound /responses request
```

### Anthropic xhigh

```
Provider.list → model registration (database)
  → for each Anthropic model, variants = transform.anthropic(model)
      → if model.id starts with "claude-opus-4-7" OR
           model.release_date >= OPUS_4_7_LAUNCH_DATE:
           variants += { xhigh: { thinking: { type: "enabled", budgetTokens: 32000 capped } } }
```

### disabled_providers auto-only

```
initState():
  ... database seeded from models.dev
  ... env / auth / account loops populate providers[...]
  post-processing loop (provider.ts:1859):
    for each providerId in providers:
      if disabled.has(providerId):
        mark providers[providerId].autoHidden = true
        log.info "auto-disabled: hidden from catalog/auto-pickers but callable via explicit getModel"
      ... rest of post-processing continues

Provider.getModel(providerId, modelID):
  s.providers[providerId]  // still populated even if autoHidden
  if present → resolve model normally
  if absent → existing ModelNotFoundError path unchanged

default-model / subscription selector / catalog UI:
  iterate providers, skip where autoHidden === true
```

## Risks / Trade-offs

- **Risk: revoke POST slows logout by a round-trip.** → Mitigation: acceptable UX — logout is rare and correctness matters; 2-3 s worst case.
- **Risk: revoke endpoint URL changes upstream.** → Mitigation: URL lives in one constant in `codex-auth.ts`; trivially swappable.
- **Risk: `x-codex-window-id` collisions across processes.** → Mitigation: UUID v4 per session is sufficient; no global uniqueness requirement.
- **Risk: `xhigh` budget miscalibration for Opus 4.7.** → Mitigation: DD-7 ties the budget to `model.limit.output` with an upper cap; operators can tune via config provider override.
- **Trade-off: narrowing `disabled_providers` changes operator intuition slightly.** → Justification: it matches the manual-pin-bypass philosophy we just shipped and what the operator expects ("I disable from UI noise, not from my own explicit use"). Log messages make the semantic change visible.
- **Risk: adding `autoHidden` flag breaks external consumers that iterate `providers` and assume disabled = absent.** → Mitigation: audit known consumers (TUI provider list, rotation selectors, admin dialog); update to check `autoHidden`. Tests guard the key consumers.

## Critical Files

- `packages/opencode/src/plugin/codex-auth.ts` (revoke + logout)
- `packages/opencode/src/account/index.ts` (hook logout into `Account.remove` for codex family)
- `packages/opencode/src/account/quota/openai.ts` (context-window headers)
- `packages/opencode/src/provider/transform.ts` (anthropic xhigh)
- `packages/opencode/src/provider/provider.ts` (disabled_providers auto-only; DD-9 implementation)
- `packages/opencode/src/provider/default-model.ts` + subscription-selector callers (autoHidden filter)
- `refs/claude-code` + `refs/codex` (pointer bump)
- `docs/events/event_2026-04-18_provider_hotfix.md` (incident record)

## Supporting Docs (Optional)

- `plans/manual-pin-bypass-preflight/plan.md` — sibling philosophy (auto-gate not manual-gate).
- `specs/codex/` — canonical codex spec family, for cross-check.
- `specs/account-management/` — adjacent ownership for account lifecycle.
