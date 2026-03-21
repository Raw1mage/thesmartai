# Design: Continuous Orchestration

## Context

- The Orchestrator currently blocks on `task()` completion, which prevents responsive user interaction and creates timeout pressure.
- The desired future state is fire-and-dispatch with event-driven continuation, but this session is limited to planning.
- Beta-tool branch creation is part of the execution path and is currently blocked by a dirty main worktree.

## Goals / Non-Goals

**Goals:**
- Define a clear non-blocking orchestration plan.
- Preserve clean handoff boundaries for later implementation.
- Record the beta-tool branch prerequisite.

**Non-Goals:**
- No runtime code changes.
- No test or build execution.
- No automatic cleanup or fallback around the dirty-tree blocker.

## Decisions

- Keep the workstream plan-only in this session.
- Treat the dirty-tree refusal as a hard stop gate, not a recoverable warning.
- Preserve the existing cms branch as the planning base until the repo is clean.

## Data / State / Control Flow

- User intent enters the plan root.
- Planner artifacts define the future async task flow and resume path.
- Beta-tool branch creation is a separate execution step that must observe repo cleanliness before mutating git state.

## Risks / Trade-offs

- Delaying beta-tool branch creation slows implementation start -> mitigated by capturing the blocker explicitly now.
- Keeping plan-only scope may require a later follow-up session -> mitigated by making the handoff execution-ready.
- Avoiding fallback means the workflow can stop on dirty tree -> chosen to preserve correctness and traceability.

## Critical Files

- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/handoff.md`

## Supporting Docs (Optional)

- `/home/pkcs12/projects/opencode/docs/events/event_20260322_continuous_orchestration.md`
