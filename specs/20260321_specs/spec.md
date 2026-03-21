# Spec: Plans vs Specs Lifecycle Refactor

## Purpose

- Define the behavioral contract for separating active planner artifacts under `/plans` from formalized specs under `/specs`.

## Requirements

### Requirement: Planner and spec roots are semantically separated

The system SHALL keep active plan packages, formalized specs, and the global architecture root as distinct repository concepts.

#### Scenario: repository structure is interpreted by a planner or builder

- **GIVEN** the repository contains `/plans`, `/specs`, and `specs/architecture.md`
- **WHEN** an agent determines where to read or write planning versus formalized documentation artifacts
- **THEN** it must treat a dated root under `/plans/` as the active plan root, a semantic per-feature root such as `specs/plans-specs-lifecycle` as the formalized spec root, and `specs/architecture.md` as the global architecture SSOT

### Requirement: Runtime todo derives from planner tasks

The system SHALL treat planner `tasks.md` unchecked checklist items as the runtime todo seed.

#### Scenario: plan is approved for execution

- **GIVEN** planner artifacts are execution-ready
- **WHEN** the plan is materialized into runtime execution
- **THEN** runtime todo must be derived from `tasks.md`, not from ad hoc conversational checklists

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

### Requirement: Specs promotion is explicit and post-merge

The system SHALL NOT automatically promote planner artifacts from `/plans` into `/specs` during planning, build, commit, or merge.

#### Scenario: implementation has been completed and merged

- **GIVEN** the plan has been fully executed, committed, and merged
- **WHEN** no explicit user request to formalize/move artifacts has been given
- **THEN** the system must leave the artifacts under `/plans` and must not move them into `/specs`

#### Scenario: user explicitly requests plans-to-specs promotion

- **GIVEN** the plan has been fully executed, committed, and merged
- **WHEN** the user explicitly instructs the assistant to move or formalize the plan into `/specs`
- **THEN** the assistant may execute the promotion workflow defined by project rules

### Requirement: Legacy dated packages are triaged by implementation status

The system SHALL classify existing legacy dated packages under `/specs/` based on whether the plan was actually implemented.

#### Scenario: legacy dated package has implementation evidence

- **GIVEN** a dated package already exists under `/specs/`
- **WHEN** repo evidence shows the plan was implemented
- **THEN** that package must be treated as formalized-spec material and moved into a semantic per-feature spec root such as `specs/plans-specs-lifecycle` rather than migrated to `/plans`

### Requirement: Formalized specs use semantic feature roots

The system SHALL store formalized post-implementation specs under semantic feature roots such as `specs/plans-specs-lifecycle`.

#### Scenario: a completed plan is promoted into specs

- **GIVEN** a plan has been fully executed, committed, merged, and explicitly approved for formalization
- **WHEN** the assistant promotes the artifacts into `/specs`
- **THEN** the destination must be a semantic per-feature root such as `specs/plans-specs-lifecycle` instead of a dated planner root

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

### Requirement: Completion includes retrospective review

The system SHALL produce a post-implementation review that compares implementation results against the effective requirement description.

#### Scenario: implementation is declared complete

- **GIVEN** execution work has been finished
- **WHEN** the assistant prepares completion reporting
- **THEN** it must provide concise requirement coverage, remaining gaps, and validation evidence without exposing raw internal chain-of-thought

## Acceptance Checks

- `plan_enter` creates dated planner packages under `/plans/` in git repos.
- `plan_exit` and mission artifact metadata continue to reference the same `/plans` root during build execution.
- Prompt/skill/AGENTS wording no longer instructs agents to use dated plan roots under `/specs/` as the active planning workspace.
- `specs/architecture.md` remains the documented architecture SSOT.
- No automatic `/plans` → `/specs` promotion path is introduced.
- Legacy dated packages under `/specs/` have an explicit implementation-status triage rule rather than silent fallback handling.
- Formalized specs use semantic per-feature roots such as `specs/plans-specs-lifecycle`.
