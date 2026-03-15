# Spec: easier_plan_mode

## Purpose

- 定義一個較寬鬆的 plan mode todo policy，同時保留 build mode 的 planner-derived execution discipline。

## Requirements

### Requirement: Plan mode supports casual todo usage

Plan mode SHALL allow todo to be used as a working ledger for exploration, debugging, and small fixes.

#### Scenario: casual debug in plan mode

- **GIVEN** the session is in plan mode
- **WHEN** the agent needs temporary working todos for debugging or small iterative work
- **THEN** it may use `todowrite` without requiring a fully materialized planner package first

### Requirement: Build mode remains strict

Build mode SHALL continue to treat planner artifacts and planned tasks as the source of truth for runtime todo.

#### Scenario: execution after approved handoff

- **GIVEN** the session has exited into build mode with an approved plan
- **WHEN** runtime todo is used for execution
- **THEN** it must align with planner-derived task names and execution slices

### Requirement: Mode transition is explicit

The plan/build transition SHALL explicitly switch todo authority semantics.

#### Scenario: plan_exit transfers authority

- **GIVEN** a session moves from plan mode to build mode
- **WHEN** `plan_exit` succeeds
- **THEN** runtime todo policy must switch from casual working ledger to strict execution ledger

### Requirement: Todo writes are mode-aware

`todowrite` SHALL apply different authority rules in plan mode and build mode.

#### Scenario: todowrite in plan mode

- **GIVEN** the session is in plan mode
- **WHEN** the assistant writes exploratory or casual todos
- **THEN** runtime should allow those todos without demanding planner-derived task lineage first

#### Scenario: todowrite in build mode

- **GIVEN** the session is in build mode with approved planner artifacts
- **WHEN** the assistant writes todo updates
- **THEN** runtime must preserve planned task alignment and reject or normalize drift away from execution authority

### Requirement: Sync behavior is explicit at plan/build boundaries

The system SHALL define how runtime todo is materialized, adopted, or replaced when crossing mode boundaries.

#### Scenario: plan_exit materializes execution ledger

- **GIVEN** casual plan-mode todos already exist
- **WHEN** `plan_exit` hands off to build mode
- **THEN** runtime must explicitly define whether planner-derived todo replaces, adopts, or merges those casual todos
