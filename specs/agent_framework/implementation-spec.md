# Implementation Spec: agent_framework

## Goal

- Canonicalize agent-related taxonomy into one semantic root while preserving detailed source materials from autorunner, continuous-orchestration, subagents, and openclaw reproduction.

## Scope

### IN

- Create the canonical `specs/agent_framework/` root.
- Preserve merged sources under `specs/agent_framework/sources/`.
- Record canonical entry guidance and provenance.

### OUT

- Rewriting the preserved source artifacts into a newly invented unified runtime design.
- Discarding supporting diagrams or subordinate slice documents.

## Validation

- `specs/agent_framework/` exists with canonical entry files.
- Merged source roots exist under `specs/agent_framework/sources/`.
- The old top-level roots `specs/autorunner/`, `specs/continuous-orchestration/`, `specs/subagents/`, and `specs/20260315_openclaw_reproduction/` no longer exist as parallel authorities.
