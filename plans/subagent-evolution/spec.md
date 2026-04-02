# Spec

## Purpose

- 定義四種 agent 類型的行為合約：Executor、Researcher、Cron、Daemon
- 定義 Codex fork dispatch 的可觀察行為
- 定義 Checkpoint-based dispatch 的 fallback 行為
- 定義 Daemon agent 的啟動、監控、通知行為

## Requirements

### Requirement: Codex Fork Dispatch

Codex subagent dispatch SHALL use parent's previousResponseId as the conversation fork base, avoiding full parent history resend.

#### Scenario: Dispatch subagent when parent has valid Codex responseId

- **GIVEN** a parent session using Codex provider with a captured `responseId = R_N`
- **WHEN** `task()` dispatches a subagent
- **THEN** child session's initial `codexSessionState` SHALL be seeded with `{ responseId: R_N }`
- **AND** child's first LLM call SHALL inject `previousResponseId = R_N`
- **AND** child's `parentMessagePrefix` injection SHALL be skipped for this first call

#### Scenario: Dispatch subagent when parent has no Codex responseId

- **GIVEN** a parent session using Codex provider with no captured responseId
- **WHEN** `task()` dispatches a subagent
- **THEN** child SHALL fall back to checkpoint-based dispatch or full history (existing behavior)

#### Scenario: Non-Codex provider dispatch is unaffected

- **GIVEN** a parent session using Anthropic or Gemini provider
- **WHEN** `task()` dispatches a subagent
- **THEN** dispatch behavior SHALL remain unchanged (stable prefix, content-based cache)

---

### Requirement: Checkpoint-Based Dispatch

When dispatching a subagent, the system SHALL use a rebind checkpoint as the context base if one exists, reducing first-round token cost.

#### Scenario: Checkpoint exists at dispatch time

- **GIVEN** a non-Codex parent session with a saved rebind checkpoint covering messages 1–N
- **WHEN** `task()` dispatches a subagent
- **THEN** child's parentMessagePrefix SHALL be assembled as `[checkpoint summary | messages after lastMessageId]`
- **AND** total parent prefix token count SHALL be measurably smaller than full history

#### Scenario: No checkpoint exists at dispatch time

- **GIVEN** a parent session with no checkpoint on disk
- **WHEN** `task()` dispatches a subagent
- **THEN** child SHALL fall back to full parent history (existing V2 behavior)

---

### Requirement: Subagent Taxonomy

The system SHALL formally distinguish four agent types with different lifecycle and dispatch contracts.

#### Scenario: Executor type dispatch

- **GIVEN** a task dispatched with type `executor` (or equivalent coding/plan-execution subagent)
- **WHEN** child session runs
- **THEN** child SHALL receive only the relevant spec/plan as context, NOT the full parent reasoning history
- **AND** child SHALL return a compact result summary on completion

#### Scenario: Researcher type dispatch

- **GIVEN** a task dispatched with type `researcher`
- **WHEN** child session runs
- **THEN** child SHALL explore, gather, and summarize findings
- **AND** parent MAY continue its own work while researcher runs (subject to parallel subagent evaluation)

#### Scenario: Daemon type dispatch

- **GIVEN** a task dispatched with type `daemon`
- **WHEN** child session is spawned
- **THEN** child SHALL remain alive indefinitely (not subject to completion handoff)
- **AND** child SHALL monitor the specified condition and emit Bus events on trigger
- **AND** parent receives an immediate acknowledgement, not a blocking wait

---

### Requirement: Daemon Agent Lifecycle

A Daemon agent SHALL run as a long-lived process with condition-based triggering and async notification.

#### Scenario: Natural language daemon spawn

- **GIVEN** a user instruction like "monitor auth.log for 5+ failed logins in 60 seconds"
- **WHEN** main agent invokes `task()` with type `daemon`
- **THEN** a daemon session SHALL be spawned and registered with ProcessSupervisor
- **AND** main agent SHALL receive immediate acknowledgement with daemon session ID
- **AND** daemon SHALL begin monitoring without blocking the main conversation

#### Scenario: Daemon condition triggered

- **GIVEN** a running daemon monitoring a condition
- **WHEN** the condition is met (e.g., threshold crossed, file changed, log pattern matched)
- **THEN** daemon SHALL publish a Bus event with condition detail
- **AND** the event SHALL be surfaced to the operator (TUI/Web notification or main session message)

#### Scenario: Daemon graceful termination

- **GIVEN** a running daemon
- **WHEN** user says "stop the auth monitor" or daemon receives SIGTERM
- **THEN** daemon session SHALL cleanly exit and ProcessSupervisor entry SHALL be removed
- **AND** no orphan processes SHALL remain

#### Scenario: Daemon survives daemon restart

- **GIVEN** a registered daemon session
- **WHEN** opencode daemon restarts (SIGUSR1 or crash recovery)
- **THEN** daemon agent SHALL be restored and resume monitoring

---

### Requirement: Parallel Subagent Feasibility

The system SHALL provide a documented evaluation of relaxing the single-child invariant for Researcher-type subagents.

#### Scenario: Parallel researcher dispatch evaluation

- **GIVEN** a plan to dispatch two concurrent researcher agents
- **WHEN** the feasibility evaluation is complete
- **THEN** the design.md SHALL document: race conditions, Bus event ordering risks, UI surface implications, and recommended invariant relaxation strategy (if any)

## Acceptance Checks

- Codex subagent first-round provider payload does NOT contain parent history messages when fork is active (`[WS-REQUEST]` log shows only separator + task).
- Checkpoint-based dispatch: child first-round token count < 10K when checkpoint exists vs ~100K without.
- Daemon session remains in ProcessSupervisor snapshot after main session continues.
- Bus event is published and surfaced to operator within 5 seconds of daemon condition trigger.
- Daemon session is restored after daemon restart without manual intervention.
- Non-Codex provider dispatch behavior is unchanged (regression test: stable prefix still prepended).
