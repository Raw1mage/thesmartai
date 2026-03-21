# Implementation Spec

## Goal

- Produce an execution-ready plan for continuous orchestration and document the beta-tool branch prerequisite.

## Scope

### IN

- Define the plan-only workstream for async orchestration.
- Capture the clean-tree requirement for beta-tool branch creation.
- Align proposal, spec, design, tasks, and handoff artifacts.

### OUT

- Code implementation.
- Tests, lint, or runtime execution.
- Worktree creation until the dirty-tree blocker is resolved.

## Assumptions

- The current cms branch remains the planning base.
- Beta-tool worktree creation can proceed once untracked files are resolved.
- The future implementation will follow the plan artifacts produced here.

## Stop Gates

- Stop if the plan scope expands into code implementation.
- Stop if beta-tool branch creation is attempted before the main worktree is clean.
- Stop if architecture or event documentation must be updated beyond the plan boundary.

## Critical Files

- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/design.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/handoff.md`

## Structured Execution Phases

- Phase 1: Refine the proposal and requirements into a stable plan baseline.
- Phase 2: Define the implementation contract, design decisions, and execution slices.
- Phase 3: Prepare the handoff artifacts and record branch/setup blockers.

## Validation

- Confirm every artifact has concrete, non-placeholder content.
- Confirm scope is plan-only and explicitly excludes implementation.
- Confirm the beta-tool dirty-tree blocker is recorded as a stop gate.

## Handoff

- Build/implementation agent must read this spec first.
- Build/implementation agent must read `tasks.md` and materialize runtime todo from it before coding.
- Conversation memory is supporting context only, not the execution source of truth.
- If scope changes or a new slice appears, update the same plan root unless a new plan is explicitly user-approved.
- At completion time, review implementation against the proposal's effective requirement description.
