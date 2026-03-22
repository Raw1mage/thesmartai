# Spec

## Purpose

- Define the behavioral contract for operator-visible control of continuous orchestration while exactly one subagent runs in the background.

## Requirements

### Requirement: Stop control persists during active background subagent work

The system SHALL keep a visible stop control while a background subagent dispatched by the current Orchestrator session is still active.

#### Scenario: parent task dispatch returns immediately but child is still running

- **GIVEN** the Orchestrator has dispatched one subagent successfully
- **WHEN** the parent foreground stream returns while the child session remains active
- **THEN** the stop control SHALL remain visible because the session still has an active background subagent

### Requirement: Stop control uses two-step escalation

The system SHALL interpret stop input as foreground interruption first and background-child termination second.

#### Scenario: operator presses stop once while parent stream is active and child is running

- **GIVEN** the parent Orchestrator is currently streaming and one background subagent is active
- **WHEN** the operator presses stop once
- **THEN** the system SHALL stop the foreground Orchestrator stream
- **AND** it SHALL keep the background subagent running
- **AND** it SHALL leave the stop control visible because background work still exists

#### Scenario: operator presses stop again while the same child is still active

- **GIVEN** the foreground Orchestrator stream has already been interrupted and the same background subagent remains active
- **WHEN** the operator presses stop again
- **THEN** the system SHALL terminate that active background subagent
- **AND** it SHALL surface the termination outcome through the same operator-visible status surfaces

### Requirement: Session-global subagent status surface is pinned while child work is active

The system SHALL render a bottom-pinned status surface in Web and TUI whenever one background subagent is active.

#### Scenario: active subagent status is available

- **GIVEN** the current session has exactly one active background subagent
- **WHEN** the session UI renders its global control surfaces
- **THEN** it SHALL display the subagent type, task title, progress or current step text, and a child-session entry affordance in a bottom-pinned status surface

### Requirement: Status surface remains until parent continuation takes over

The system SHALL keep the pinned subagent status surface mounted until the active child has been resolved and the parent continuation has actually resumed, or until the child is explicitly terminated.

#### Scenario: child completes and parent continuation starts

- **GIVEN** a background subagent completes successfully
- **WHEN** the runtime injects the parent continuation and the parent stream resumes
- **THEN** the pinned status surface SHALL remain visible through the handoff boundary
- **AND** it SHALL only disappear after the parent continuation has taken over or the active-child state is explicitly cleared

#### Scenario: child is killed or fails before parent continuation resumes

- **GIVEN** the active background subagent fails or is terminated
- **WHEN** the runtime clears the active-child state
- **THEN** the pinned status surface SHALL disappear only after that authoritative cleared state is published

### Requirement: User interaction remains available without second subagent dispatch

The system SHALL allow ongoing user conversation and non-task tool calls while one background subagent is active, but SHALL not allow dispatch of another subagent.

#### Scenario: operator keeps interacting while child runs

- **GIVEN** one background subagent is active for the current Orchestrator session
- **WHEN** the user sends another message or the Orchestrator performs a non-task tool call
- **THEN** the session may continue processing that interaction
- **BUT** any attempt to dispatch a second subagent SHALL fail fast with explicit feedback

### Requirement: No guessed progress or navigation fallback

The system SHALL fail fast when it cannot prove active-child identity, progress evidence, or child-session entry evidence.

#### Scenario: status surface cannot resolve child-session navigation target

- **GIVEN** the UI wants to render a pinned active-subagent status surface
- **WHEN** it cannot resolve the child-session identity or its required entry mechanism
- **THEN** it SHALL surface an explicit degraded/error state rather than inventing a guessed session target or placeholder progress

## Acceptance Checks

- Stop control remains visible while one child subagent is active, even if `task()` already returned.
- First stop interrupts foreground Orchestrator streaming without killing the child.
- Second stop kills the same active child subagent.
- Web and TUI both render a pinned bottom active-subagent surface with identity, title, progress, and child-session entry.
- The pinned surface disappears only after authoritative child-clear / parent-takeover evidence.
- User interaction remains possible during background child execution, but second subagent dispatch is still rejected.
