# Spec: Continuous Orchestration

## Purpose

- Define the behavior contract for non-blocking subagent dispatch, automatic Orchestrator continuation, and operator-visible active-child control surfaces.

## Requirements

### Requirement: Task dispatch returns immediately
The system SHALL return a successful `task()` tool result immediately after the child session / worker dispatch is established.

#### Scenario: dispatching a coding subagent
- **GIVEN** the Orchestrator invokes `task()` with a valid child-session payload
- **WHEN** the child session and worker process are created successfully
- **THEN** the tool result SHALL return dispatch metadata without waiting for the worker to finish

### Requirement: Parent Orchestrator resumes on task completion
The system SHALL resume the parent Orchestrator session when a subagent completes or fails.

#### Scenario: worker completes successfully
- **GIVEN** a subagent has been dispatched from a parent Orchestrator session
- **WHEN** the runtime receives the corresponding completion event
- **THEN** the system SHALL inject a synthetic continuation message into the parent session and enqueue the parent session for execution

#### Scenario: worker fails
- **GIVEN** a subagent has been dispatched from a parent Orchestrator session
- **WHEN** the runtime receives the corresponding failure event
- **THEN** the system SHALL inject an actionable failure summary into the parent session and enqueue the parent session for recovery handling

### Requirement: No silent fallback to blocking orchestration
The system SHALL fail fast if completion evidence or parent-session identity is missing instead of silently reverting to the old blocking behavior.

#### Scenario: completion event lacks required identity
- **GIVEN** the completion handler cannot prove the parent session or task identity
- **WHEN** it evaluates whether to resume the Orchestrator
- **THEN** it SHALL surface an explicit error path rather than block silently or guess a target session

### Requirement: Runtime todo derives from planner tasks
The system SHALL treat planner `tasks.md` unchecked checklist items as the runtime todo seed.

#### Scenario: build mode starts from this plan
- **GIVEN** planner artifacts are execution-ready
- **WHEN** implementation begins
- **THEN** runtime todo SHALL be derived from `tasks.md`, not from ad hoc conversational checklists

### Requirement: Active-child authority is single-session and fail-fast
The system SHALL maintain one authoritative active-child state per parent session and SHALL fail fast on second-child dispatch attempts unless stale running evidence is explicitly disproven.

#### Scenario: second child dispatch is attempted while a live child is running
- **GIVEN** the parent session already has an authoritative active child with matching live worker evidence
- **WHEN** another `task()` dispatch is attempted
- **THEN** the system SHALL reject the dispatch with an explicit active-child-blocked error

#### Scenario: recorded running child is stale after worker loss or restart
- **GIVEN** the parent session has an authoritative active child in `running` state
- **WHEN** dispatch-time liveness checks cannot find matching worker evidence
- **THEN** the system SHALL clear the stale running child and continue the new dispatch instead of blocking forever

### Requirement: Web and TUI must expose active-child status until takeover evidence
The system SHALL keep Web and TUI active-child status surfaces visible until authoritative parent-takeover or child-clear evidence is observed.

#### Scenario: child is running in background
- **GIVEN** a parent session has an active child
- **WHEN** the operator views the session in Web or TUI
- **THEN** the interface SHALL show a compact active-child status surface with agent label, title, current step, and elapsed time
- **AND** the displayed step SHALL prefer live child progress over the seeded parent todo summary
- **AND** the live-step priority order SHALL be: child text narration, then running tool description/title/command, then reasoning summary, then seeded todo fallback

#### Scenario: child session entry is opened from status surface
- **GIVEN** an active child is visible in the parent session status surface
- **WHEN** the operator triggers the child-entry affordance
- **THEN** Web SHALL open the child session route and TUI SHALL perform a native session-tree jump

### Requirement: Completion includes retrospective review
The system SHALL produce a completion review that compares implementation results against the effective requirement description.

#### Scenario: implementation is declared complete
- **GIVEN** execution work has been finished
- **WHEN** the assistant prepares completion reporting
- **THEN** it SHALL provide requirement coverage, remaining gaps, and validation evidence without exposing raw internal chain-of-thought

## Acceptance Checks

- Dispatch metadata is returned before the child worker finishes.
- Successful task completion resumes the parent Orchestrator without user input.
- Failure completion resumes the parent Orchestrator with actionable error context.
- No code path silently falls back to blocking orchestration semantics.
- Stale `running` active-child state no longer blocks dispatch forever when worker evidence is missing.
- Web and TUI both expose compact active-child status surfaces with the documented entry behavior.
- Web and TUI dynamic step display prefers live child progress over seeded todo fallback.
- Web and TUI dynamic step priority is narration text, then running tool description/title/command, then reasoning, then seeded todo fallback.
- Tasks, event log, and architecture sync evidence are aligned at completion.
