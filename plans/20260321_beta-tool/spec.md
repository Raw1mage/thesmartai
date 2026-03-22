# Spec

## Purpose

- Define how the existing builder enters and executes beta-aware build mode without losing current capabilities, using deterministic shared beta primitives for routine orchestration and keeping AI focused on implementation and judgment-heavy work.

## Requirements

### Requirement: Existing builder SHALL preserve current non-beta behavior

The system SHALL optimize the current builder flow without regressing approved non-beta build behavior.

#### Scenario: ordinary build plan without beta workflow

- **GIVEN** an approved plan that does not declare beta-loop execution intent
- **WHEN** `plan_exit` is invoked and builder enters build mode
- **THEN** the existing builder lifecycle SHALL continue to work with compatible behavior and without requiring beta-specific actions

### Requirement: Builder SHALL bootstrap beta execution on approved build entry

The system SHALL allow the existing builder to enter build mode through beta-loop bootstrap metadata and shared orchestration logic.

#### Scenario: plan_exit approval with beta-loop-enabled plan

- **GIVEN** planner artifacts are complete and the approved plan declares beta-loop execution intent
- **WHEN** `plan_exit` is invoked and the operator answers Yes
- **THEN** the runtime SHALL resolve beta context, create or reuse the beta loop via shared deterministic orchestration, materialize build todos, and emit build-mode handoff metadata containing beta execution context

#### Scenario: beta bootstrap requires explicit decision

- **GIVEN** `plan_exit` is preparing beta bootstrap but branch name or runtime policy is ambiguous
- **WHEN** shared beta orchestration cannot resolve the required context safely
- **THEN** the system SHALL stop and require bounded clarification instead of entering build mode with guessed values

### Requirement: Builder SHALL validate through syncback semantics

The system SHALL support validation-phase syncback from beta execution into the main worktree using planner-approved runtime policy.

#### Scenario: validation step requests runtime refresh

- **GIVEN** build mode is executing a beta-loop-enabled plan and reaches a validation step
- **WHEN** validation requires the main runtime surface to reflect the feature branch
- **THEN** the runtime SHALL perform syncback-equivalent checkout behavior and invoke runtime start/refresh according to the resolved policy

#### Scenario: runtime policy is manual

- **GIVEN** the approved beta loop uses a manual runtime policy
- **WHEN** build mode reaches validation
- **THEN** the system SHALL expose syncback state and stop for operator validation rather than guessing runtime commands

### Requirement: Builder SHALL own finalize progression but stop at destructive approval

The system SHALL allow builder to continue from successful validation into merge preflight, but SHALL not execute destructive finalize steps without explicit approval.

#### Scenario: build execution completes successfully

- **GIVEN** implementation and validation have passed in a beta-loop-enabled plan
- **WHEN** build mode reaches completion
- **THEN** the system SHALL prepare merge / cleanup preflight inside builder and pause for explicit approval before executing merge, worktree removal, or branch deletion

## Acceptance Checks

- Existing non-beta build-mode behavior remains compatible after beta-aware flow is added.
- `plan_exit` can emit beta-loop-aware handoff metadata only when planner artifacts are complete and beta execution is explicitly represented.
- Ambiguous branch/runtime decisions stop with explicit clarification requirements instead of guessed defaults.
- Shared beta orchestration is reused by both internal builder runtime and public MCP handlers.
- Validation and finalize flow use deterministic shared tools/primitives instead of prompt-only AI git orchestration.
