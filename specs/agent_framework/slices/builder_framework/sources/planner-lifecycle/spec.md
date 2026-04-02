# Spec: Planner Lifecycle

## Purpose

- Define the behavioral contract for separating active planner artifacts under `/plans` from formalized specs under `/specs`, while preserving same-workstream continuity and mode-aware todo authority.

## Requirements

### Requirement: Planner and spec roots are semantically separated

The system SHALL keep active plan packages, formalized specs, and the global architecture root as distinct repository concepts.

#### Scenario: repository structure is interpreted by a planner or builder

- **GIVEN** the repository contains `/plans`, `/specs`, and `specs/architecture.md`
- **WHEN** an agent determines where to read or write planning versus formalized documentation artifacts
- **THEN** it must treat a dated root under `/plans/` as the active plan root, a semantic per-feature root such as `specs/plans-specs-lifecycle` as the formalized spec root, and `specs/architecture.md` as the global architecture SSOT

### Requirement: Runtime todo derives from planner tasks

The system SHALL treat planner `tasks.md` unchecked checklist items as the runtime todo seed for build execution.

#### Scenario: plan is approved for execution

- **GIVEN** planner artifacts are execution-ready
- **WHEN** the plan is materialized into runtime execution
- **THEN** runtime todo must be derived from `tasks.md`, not from ad hoc conversational checklists

### Requirement: Plan mode todo acts as a working ledger

The system SHALL allow todo to operate as a relaxed working ledger while the session remains in plan mode.

#### Scenario: exploratory work happens in plan mode

- **GIVEN** the session is in plan mode
- **WHEN** the agent needs temporary todo tracking for exploration, debugging, or small fixes
- **THEN** runtime may accept those todo updates without requiring planner-derived task lineage first

### Requirement: Build mode todo remains a strict execution ledger

The system SHALL preserve planner-derived execution authority once the session enters build mode.

#### Scenario: execution continues after `plan_exit`

- **GIVEN** `plan_exit` succeeded and the session is in build mode
- **WHEN** runtime todo is used for execution
- **THEN** todo naming and status transitions must stay aligned with planner-derived task names and approved handoff semantics

### Requirement: Mode transition explicitly switches todo authority

The system SHALL use `plan_exit` as the boundary where relaxed plan-mode todo semantics switch to strict build-mode execution semantics.

#### Scenario: plan mode hands off to build mode

- **GIVEN** casual or exploratory plan-mode todos may already exist
- **WHEN** `plan_exit` succeeds
- **THEN** runtime must explicitly re-materialize, adopt, or replace todo from planner artifacts under build-mode authority
- **AND** must not continue using freeform plan-mode todo semantics by default

### Requirement: Active planner artifacts live under /plans

The system SHALL create and use dated planner packages under `/plans/` as the active planning and build workspace.

#### Scenario: planner initializes a new workstream

- **GIVEN** a repo-local planning session starts for a non-trivial change
- **WHEN** the planner creates the artifact package
- **THEN** the package must be created under a dated root in `/plans/`, not under a dated root in `/specs/`

### Requirement: Build mode continues using the same /plans root

The system SHALL keep build execution bound to the same dated `/plans/` package after `plan_exit`.

#### Scenario: plan is approved for build execution

- **GIVEN** a dated plan package under `/plans/` is execution-ready
- **WHEN** `plan_exit` transitions the session into build mode
- **THEN** mission artifact paths and runtime task materialization must continue to reference that same `/plans` root

### Requirement: Specs promotion stays post-merge, with beta finalize closeout

The system SHALL keep ordinary workstreams in `/plans` unless separately promoted, but SHALL treat beta-workflow finalize as a required post-merge closeout that consolidates completed plan knowledge into the related semantic `/specs/` family.

#### Scenario: ordinary non-beta workstream finishes

- **GIVEN** the plan has been fully executed, committed, and merged outside the beta finalize workflow
- **WHEN** no separate formalization request or promotion step has been given
- **THEN** the system must leave the artifacts under `/plans` and must not move them into `/specs`

#### Scenario: beta workflow reaches final mainline merge

- **GIVEN** a beta-enabled workflow has completed the final `test/*` branch merge into the authoritative `baseBranch`
- **WHEN** finalize cleanup runs in the authoritative docs repo/worktree
- **THEN** the system SHALL close out the completed dated `/plans/` package by merging its durable planning/spec content into the related semantic `/specs/` family
- **AND** the dated `/plans/` root must no longer remain the long-term canonical spec record for that completed workflow

#### Scenario: beta finalize cannot resolve a target semantic spec family

- **GIVEN** a beta-enabled workflow has completed final merge, but no unambiguous related semantic `/specs/` family is identifiable
- **WHEN** post-merge plan closeout would begin
- **THEN** the system SHALL fail fast and require an explicit user decision for the destination spec family
- **AND** it must not create an isolated fallback spec root silently

### Requirement: Legacy dated packages are triaged by implementation status

The system SHALL classify existing legacy dated packages under `/specs/` based on whether the plan was actually implemented.

#### Scenario: legacy dated package has implementation evidence

- **GIVEN** a dated package already exists under `/specs/`
- **WHEN** repo evidence shows the plan was implemented
- **THEN** that package must be treated as formalized-spec material and moved into a semantic per-feature spec root such as `specs/plans-specs-lifecycle` rather than migrated to `/plans`

#### Scenario: legacy dated package lacks implementation evidence

- **GIVEN** a dated package already exists under `/specs/`
- **WHEN** repo evidence does not show the plan was implemented
- **THEN** that package must be treated as a legacy plan and moved under `/plans`

### Requirement: Same workstream extends the same plan

The system SHALL extend the existing plan root for the same workstream instead of creating a new sibling plan by default.

#### Scenario: a new idea or bug appears within the same workstream

- **GIVEN** an existing plan already captures the active workstream
- **WHEN** follow-up scope, fixes, or design slices are added
- **THEN** the planner must update the same plan root unless the user explicitly requests or approves a new plan

### Requirement: New plans require user-approved branching

The system SHALL only create a new plan root when the user explicitly requests one, or explicitly approves the assistant's proposal to branch.

#### Scenario: assistant detects a possible branch

- **GIVEN** the assistant sees adjacent but potentially separable work
- **WHEN** user approval has not been given
- **THEN** the assistant must not create a new plan root on its own

## Acceptance Checks

- `plan_enter` creates dated planner packages under `/plans/` in git repos.
- `plan_exit` and mission artifact metadata continue to reference the same `/plans` root during build execution.
- Plan mode allows working-ledger todo usage.
- Build mode preserves planner-derived execution-ledger semantics.
- Prompt/skill/AGENTS wording no longer instructs agents to use dated plan roots under `/specs/` as the active planning workspace.
- `specs/architecture.md` remains the documented architecture SSOT.
- Non-beta workflows do not silently introduce a generic automatic `/plans` → `/specs` promotion path.
- Beta finalize performs the required post-merge consolidation into the related semantic `/specs/` family.
- Legacy dated packages under `/specs/` have an explicit implementation-status triage rule rather than silent fallback handling.
