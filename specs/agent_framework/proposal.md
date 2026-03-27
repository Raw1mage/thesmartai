# Proposal: agent_framework

> Canonical Root Notice: `agent_framework/` is the canonical root for agent runtime semantics. Related implementation slices now live under `agent_framework/slices/`.

## Why

- Agent-related authority was fragmented across autorunner, continuous orchestration, subagent visibility, and the OpenClaw reproduction workstream.
- A single canonical semantic root is needed for agent runtime/control-plane taxonomy while preserving each source slice intact.

## Merged Sources

- `/home/pkcs12/projects/opencode/specs/agent_framework/sources/autorunner/`
- `/home/pkcs12/projects/opencode/specs/agent_framework/sources/continuous-orchestration/`
- `/home/pkcs12/projects/opencode/specs/agent_framework/sources/subagents/`
- `/home/pkcs12/projects/opencode/specs/agent_framework/sources/20260315_openclaw_reproduction/`

## Effective Requirement Description

1. Treat agent execution as approved-plan-driven, delegation-aware, and fail-fast.
2. Keep non-blocking orchestration, active-child visibility, and runner substrate evolution under one framework taxonomy.
3. Preserve OpenClaw-derived control-plane research and runtime slices as supporting authority within the same root.
4. Retain all useful source artifacts under `sources/` rather than discarding detail.

## Preservation Note

- Canonical summary files live at `specs/agent_framework/`.
- Detailed slice materials remain preserved under `specs/agent_framework/sources/`.
