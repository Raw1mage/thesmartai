# Spec: agent_framework

## Purpose

- Define the canonical agent framework root that unifies runner authority, continuous orchestration, subagent visibility, and OpenClaw-derived control-plane taxonomy.

## Requirements

### Requirement: Canonical agent authority

The repository SHALL treat `specs/agent_framework/` as the semantic entry root for agent runtime taxonomy.

#### Scenario: reader needs agent framework authority

- **GIVEN** multiple agent-related source slices exist
- **WHEN** a reader needs the canonical starting point
- **THEN** they start at `specs/agent_framework/`
- **AND** inspect `sources/` for supporting detail

### Requirement: Source provenance remains preserved

The framework SHALL preserve useful source roots and supporting artifacts under the canonical root.

#### Scenario: canonical taxonomy is audited

- **GIVEN** the merge has completed
- **WHEN** source provenance is reviewed
- **THEN** all merged roots remain available under `specs/agent_framework/sources/`

### Requirement: Framework spans runner, orchestration, visibility, and benchmarked control-plane slices

The framework SHALL keep those domains co-located without inventing a new fallback taxonomy.

#### Scenario: a reader traces agent-runtime concerns

- **GIVEN** they need runner contracts, subagent orchestration behavior, UI visibility, or OpenClaw-derived substrate context
- **WHEN** they inspect the canonical root
- **THEN** each concern is reachable from one semantic root with explicit preserved source provenance
