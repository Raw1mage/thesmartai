# Spec

## Purpose

- Convert the already-converged discussion in this session into an execution-ready planner package before any further implementation proceeds.

## Requirements

### Requirement: Planner artifacts must be completed before new execution resumes

The system SHALL require the active planner artifacts for this change to contain concrete session-derived content before additional implementation work continues.

#### Scenario: Planner template exists but is still blank

- **GIVEN** a new `specs/changes/<slug>/` directory was created from templates
- **WHEN** the planner artifact still contains placeholders
- **THEN** implementation must pause and the planner package must be completed first

### Requirement: Runtime todo must be derived from planner tasks

The system SHALL treat `tasks.md` as the execution backlog source for this change, with runtime todo represented as a projection of those tasks.

#### Scenario: Build work is about to continue

- **GIVEN** the planner package is complete
- **WHEN** execution resumes
- **THEN** build-mode work should materialize runtime todo from `tasks.md` instead of relying on conversation memory alone

### Requirement: Handoff must preserve stop gates

The system SHALL preserve approval, decision, blocker, and replan gates in the planner handoff.

#### Scenario: Implementation reaches unresolved design drift

- **GIVEN** build-mode execution is in progress
- **WHEN** the work no longer matches approved planner scope or requires a material replan
- **THEN** execution must stop and return to planner flow before further code changes continue

### Requirement: Existing converged work must be reflected in the new planner package

The system SHALL capture the current session's already-completed planning conclusions in the new planner package.

#### Scenario: Prior discussion already established direction

- **GIVEN** the session already defined runner contract direction, `/plan` + `@planner` convergence, and remaining backlog ordering
- **WHEN** the new plan package is written
- **THEN** those conclusions must be reflected accurately instead of resetting to generic templates

## Acceptance Checks

- `implementation-spec.md` contains concrete goal, scope, assumptions, stop gates, critical files, phases, and validation.
- `tasks.md` lists the actual remaining work in ordered execution groups.
- `handoff.md` explicitly states that build-mode execution must read the plan first and derive runtime todo from planner tasks.
- The planner package reflects current session reality rather than placeholder text.
