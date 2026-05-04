# Spec: Provider Hotfix

## Purpose

Bring our codex + claude provider surface back in line with upstream (2026-04 HEADs) and close the `disabled_providers` loophole that silently blocked explicit provider selection on the operator's machine.

## Requirements

### Requirement: Codex logout revokes upstream OAuth tokens

The system SHALL call `https://auth.openai.com/oauth/revoke` with the account's refresh token before clearing local credentials, and fail-closed when the revoke request errors.

#### Scenario: normal logout
- **GIVEN** an operator-initiated logout of a `codex-subscription-*` account whose refresh token is valid
- **WHEN** the logout flow runs
- **THEN** the daemon posts the refresh token to `https://auth.openai.com/oauth/revoke` with `token_type_hint=refresh_token`
- **AND** only after a 2xx response clears the local account entry

#### Scenario: upstream revoke fails
- **GIVEN** a logout where the revoke HTTP call returns non-2xx or the network is down
- **WHEN** the flow errors
- **THEN** local credentials remain in place
- **AND** the operator sees the error with enough detail to retry (no silent swallow — AGENTS.md 第一條)

### Requirement: Codex /responses requests carry the 2026-04 context-window headers

The system SHALL include `x-codex-window-id`, `x-codex-parent-thread-id`, and `x-openai-subagent` on every `/responses` request routed through the codex provider.

#### Scenario: first session request
- **GIVEN** a fresh conversation with no parent thread
- **WHEN** the first request goes to the Codex Responses API
- **THEN** the request carries a stable `x-codex-window-id` (e.g. UUID per conversation) and an empty / null `x-codex-parent-thread-id`
- **AND** carries `x-openai-subagent` set from the session's subagent lineage (empty for top-level)

#### Scenario: subagent-spawned request
- **GIVEN** a subagent session with a known parent thread ID
- **WHEN** a request goes out
- **THEN** `x-codex-parent-thread-id` contains the parent thread ID
- **AND** `x-openai-subagent` contains the subagent lineage label

### Requirement: Anthropic xhigh effort for Opus 4.7+

The system SHALL surface `xhigh` as a valid effort level for Opus 4.7 and later Anthropic models, with a thinking budget calibrated to the upstream semantics.

#### Scenario: Opus 4.7 variant enumeration
- **GIVEN** a model whose id matches `claude-opus-4-7*` (or `release_date` ≥ the Opus 4.7 launch date)
- **WHEN** the effort-variant mapping runs
- **THEN** the returned variants contain `low`, `medium`, `high`, **and `xhigh`**
- **AND** `xhigh` carries a thinking budget higher than `high` for that model

#### Scenario: non-Opus-4.7 Claude model
- **GIVEN** any Anthropic model predating Opus 4.7 (Opus 4.0/4.1/4.6, Sonnet 4.x, Haiku 4.x)
- **WHEN** the effort-variant mapping runs
- **THEN** variants remain `low`, `medium`, `high` (unchanged)

### Requirement: disabled_providers does not block explicit provider selection

The system SHALL treat `disabled_providers` as an auto-gate that hides a provider from automatic catalog filtering and default-model selection, but SHALL NOT remove the provider entry from `providers[providerId]`. Explicit `Provider.getModel(providerId, modelId)` calls and session-pinned account flows for such providers MUST continue to resolve.

#### Scenario: operator disables openai but explicitly selects it
- **GIVEN** `disabled_providers` contains `"openai"` and the operator has one or more `openai-subscription-*` accounts
- **AND** the operator explicitly selects `providerId=openai, modelID=gpt-5.4-mini` in the session
- **WHEN** `Provider.getModel("openai", "gpt-5.4-mini")` is called
- **THEN** it resolves to the openai provider
- **AND** the request proceeds using the pinned account

#### Scenario: auto path still honors disabled_providers
- **GIVEN** the same config
- **WHEN** auto selection (e.g. default-model picker, rotation subscription selector) iterates providers
- **THEN** `openai` is skipped in that iteration
- **AND** `log.info` records "openai skipped: auto-disabled via disabled_providers"

#### Scenario: observability
- **GIVEN** an explicit path resolves a provider marked in `disabled_providers`
- **WHEN** the provider is used
- **THEN** daemon log emits `log.info` noting "explicit use of auto-disabled provider {id}" so operators can see what is happening (AGENTS.md 第一條)

### Requirement: Refs submodule pointers track the analysis baseline

The system SHALL bump `refs/claude-code` to `2b53fac` and `refs/codex` to `d0eff70383` so the super-repo records the exact upstream baseline this sync covers.

#### Scenario: super-repo bump committed
- **GIVEN** the submodule working trees are at the documented HEADs
- **WHEN** the super-repo commit lands on `main`
- **THEN** `git -C refs/claude-code rev-parse HEAD` equals `2b53fac*`
- **AND** `git -C refs/codex rev-parse HEAD` equals `d0eff70383*`

### Requirement: All new paths are observable (AGENTS.md 第一條)

The system SHALL NOT silently fall back on any of the new paths. Each new branch emits at least one `log.info` / `log.warn` line identifying the branch chosen.

#### Scenario: logout revoke branch
- **WHEN** the revoke call succeeds OR fails
- **THEN** a single log line records which branch ran and the outcome

#### Scenario: explicit-use-of-disabled branch
- **WHEN** the catalog post-processing encounters a disabled-but-explicitly-retained provider
- **THEN** it logs the decision

## Acceptance Checks

- Unit test: revoke helper posts to the correct URL with `token_type_hint=refresh_token`; on non-2xx it throws and the account entry survives.
- Unit test: header builder returns all three new headers on a nominal Responses API request.
- Unit test: Anthropic transform returns `{ low, medium, high, xhigh }` for a synthetic Opus 4.7 model input; returns `{ low, medium, high }` for a synthetic Opus 4.6 model input.
- Unit test: `getModel("openai", ...)` resolves when `openai` is in `disabled_providers` AND the operator has accounts for it.
- Unit test: auto-selection (`selectSubscriptionModel` or equivalent) still skips `openai` when disabled.
- Integration: super-repo shows the correct submodule SHAs after commit.
- `bun test packages/opencode/test/provider/` matches or beats the pre-hotfix baseline failure count (i.e. no new regressions).
