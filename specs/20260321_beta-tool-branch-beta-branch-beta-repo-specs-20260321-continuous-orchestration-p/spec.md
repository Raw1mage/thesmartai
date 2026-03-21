# Spec: Continuous Orchestration

## Purpose

- Define the planning contract for a non-blocking subagent orchestration flow and the beta-tool branch prerequisite.

## Requirements

### Requirement: Plan-only workstream
The system SHALL keep this session focused on planning and exclude code implementation.

#### Scenario: user requests plan only
- **GIVEN** the user asks for continuous orchestration development planning
- **WHEN** the plan is prepared
- **THEN** the output SHALL remain at the spec / design / task level and not modify runtime code

### Requirement: Beta-tool branch creation is gated by a clean worktree
The system SHALL refuse beta-tool worktree creation while the main worktree is dirty.

#### Scenario: dirty worktree detected
- **GIVEN** the repository has untracked or modified files in the main worktree
- **WHEN** beta-tool is invoked to create a beta branch
- **THEN** the branch creation SHALL stop with a blocker rather than guessing or auto-cleaning

### Requirement: Runtime todo derives from planner tasks
The system SHALL treat planner `tasks.md` unchecked checklist items as the runtime todo seed.

#### Scenario: plan is approved for execution
- **GIVEN** planner artifacts are execution-ready
- **WHEN** the plan is materialized into runtime execution
- **THEN** runtime todo must be derived from `tasks.md`, not from ad hoc conversational checklists

### Requirement: Same workstream extends the same plan
The system SHALL extend the existing plan root for the same workstream instead of creating a new sibling plan by default.

#### Scenario: a new idea or bug appears within the same workstream
- **GIVEN** an existing plan already captures the active workstream
- **WHEN** follow-up scope, fixes, or design slices are added
- **THEN** the planner must update the same plan root unless the user explicitly requests or approves a new plan

### Requirement: Completion includes retrospective review
The system SHALL produce a post-implementation review that compares implementation results against the effective requirement description.

#### Scenario: implementation is declared complete
- **GIVEN** execution work has been finished
- **WHEN** the assistant prepares completion reporting
- **THEN** it must provide concise requirement coverage, remaining gaps, and validation evidence without exposing raw internal chain-of-thought

## Acceptance Checks

- The plan artifacts contain a stable, non-placeholder execution contract.
- The dirty-tree blocker is explicitly recorded in the plan and event log.
- The plan can be handed off to an implementation agent without further clarification on scope.
