# Spec: builder_framework

## Purpose

- Define the canonical builder framework contract that combines planner lifecycle semantics, beta/worktree orchestration, and builder-native build execution.

## Requirements

### Requirement: Canonical builder authority

The repository SHALL treat `specs/builder_framework/` as the semantic entry root for builder workflow taxonomy.

#### Scenario: reader needs builder workflow authority

- **GIVEN** builder-related material exists across preserved source slices
- **WHEN** a reader needs the canonical starting point
- **THEN** they start at `specs/builder_framework/`
- **AND** use `sources/` only for detailed supporting context

### Requirement: Source provenance remains preserved

The framework SHALL preserve useful source roots without discarding their artifacts.

#### Scenario: merged taxonomy is inspected

- **GIVEN** builder framework consolidation has completed
- **WHEN** a reader inspects the canonical root
- **THEN** the merged source roots remain available under `specs/builder_framework/sources/`

### Requirement: Planner lifecycle remains part of builder framework

The framework SHALL keep active planning under `/plans` and treat `/specs` as formalized semantic documentation.

#### Scenario: planner/build lifecycle behavior is referenced from builder framework

- **GIVEN** builder execution depends on planner artifacts
- **WHEN** lifecycle rules are consulted
- **THEN** active plan packages are understood to live under `/plans`
- **AND** builder-native workflow guidance remains aligned with that lifecycle

### Requirement: Beta-enabled builder execution must enforce implementation surface

The framework SHALL treat beta-enabled build execution as an execution-surface routing problem, not only as metadata availability.

#### Scenario: beta-enabled mission enters build execution

- **GIVEN** `mission.beta.enabled === true`
- **WHEN** build continuations and delegated implementation work begin after `plan_exit`
- **THEN** the system resolves a single authoritative implementation surface in the beta worktree
- **AND** coding execution defaults to the beta branch/worktree rather than the main repo
- **AND** docs/specs/events continue to write to the authoritative main repo/worktree

#### Scenario: beta-enabled implementation tries to use main repo as coding surface

- **GIVEN** a beta-enabled builder run
- **WHEN** implementation work is about to execute outside the resolved beta worktree
- **THEN** the runtime fails fast instead of relying on model interpretation or prompt compliance

#### Scenario: validating builder enforcement behavior

- **GIVEN** builder-native beta workflow support exists
- **WHEN** end-to-end behavior is validated
- **THEN** validation must prove not only bootstrap/syncback/finalize helpers, but also that implementation work after `plan_exit` actually routes to the beta worktree by default
