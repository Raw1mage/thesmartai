# Design: agent_framework

## Context

- `autorunner` defines approved-plan-driven runner behavior and supporting mission/delegation slices.
- `continuous-orchestration` defines dispatch-first subagent execution and active-child orchestration behavior.
- `subagents` preserves the visibility/UI slice for delegated work.
- `20260315_openclaw_reproduction` preserves the benchmarked long-range agent control-plane evolution.

## Decisions

1. Use `specs/agent_framework/` as the canonical semantic root.
2. Preserve each source root under `sources/` intact.
3. Keep canonical files concise and provenance-driven rather than rewriting every source artifact.

## Structure

- Canonical entry files at `specs/agent_framework/`.
- Preserved supporting roots under `specs/agent_framework/sources/`.
- Large supporting artifacts such as diagrams remain inside their preserved source subtree.
