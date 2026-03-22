# Spec

## Purpose

- Reorganize legacy spec artifacts so `/plans` contains active or shelved implementation plans and `/specs` contains only long-lived semantic specification roots backed by implementation evidence.

## Requirements

### Requirement: Commit-grounded legacy triage
The system SHALL classify each legacy dated spec root by commit/event/code evidence before deciding whether it belongs in `/plans` or `/specs`.

#### Scenario: Unimplemented dated root
- **GIVEN** a legacy dated root under `/specs`
- **WHEN** commit history shows only plan creation or shelved-spec commits and no corresponding implementation/code evidence
- **THEN** the root is moved to `/plans`

#### Scenario: Implemented dated root
- **GIVEN** a legacy dated root under `/specs`
- **WHEN** commit history, event closeout, or code blame confirm the feature was implemented
- **THEN** the root is merged into an appropriate semantic `/specs/<feature>/` root

### Requirement: Conservative semantic naming
The system SHALL use conservative, direct semantic names for new spec roots.

#### Scenario: Naming a consolidated root
- **GIVEN** an implemented dated package that needs normalization
- **WHEN** a semantic destination is created
- **THEN** the destination uses a direct name such as `account-management`, `planner-lifecycle`, or `beta-tool`

### Requirement: Telemetry consolidation
The system SHALL fold dated telemetry implementation/optimization provenance into the semantic telemetry root.

#### Scenario: Dated telemetry packages
- **GIVEN** dated telemetry roots with implementation evidence
- **WHEN** the repository is reorganized
- **THEN** those dated roots are absorbed into `specs/telemetry/` or its subordinate slices rather than left as standalone dated roots

## Acceptance Checks

- Unimplemented legacy roots identified by commit evidence are no longer under `/specs`.
- Implemented dated roots with clear semantic destinations are no longer standalone dated roots in `/specs`.
- `docs/events/event_20260322_specs_reorganization.md` records the evidence basis and migration decisions.
- `specs/architecture.md` reflects the resulting `/specs` and `/plans` organization or records verified-no-change evidence.
