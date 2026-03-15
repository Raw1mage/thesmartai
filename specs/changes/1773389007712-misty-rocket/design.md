# Design

## Context

- The session already produced real design conclusions under `specs/changes/20260315-web-monitor-restart-control/`, including:
  - plan/build target semantics
  - autorunner compatibility analysis
  - runner contract draft
  - first-slice convergence of builtin `/plan` and `@planner`
- However, the newly entered plan-mode change set was created from templates and does not yet reflect those conclusions.
- The user explicitly called out the failure mode: if implementation resumes before plan/spec is written, code and docs drift.

## Goals / Non-Goals

**Goals:**

- Make this new planner package a faithful summary of the session's converged direction.
- Define the exact lineage from spec -> tasks -> runtime todo -> build execution.
- Re-state the ordered backlog so future execution can continue autonomously without reverting to discussion-only memory.

**Non-Goals:**

- Introduce new runtime behavior in this planning step.
- Perform host install or privileged environment changes.
- Claim that planner/runtime hardening is complete before runtime binding lands.

## Decisions

- This plan package is documentation-first and must be completed before further implementation resumes.
- Existing work under `20260315-web-monitor-restart-control` remains the primary execution-history artifact set; this new change set serves as the explicit plan-mode package for continuing work from here.
- `implementation-spec.md` is the top-level execution contract for the current continuation.
- `tasks.md` is the authoritative work breakdown for this continuation.
- Runtime todo must be derived from `tasks.md`, not independently authored from scratch.
- `handoff.md` must explicitly preserve stop gates and planner re-entry conditions.

## Risks / Trade-offs

- duplicate-planning-surface risk -> mitigate by explicitly cross-referencing the existing `20260315-web-monitor-restart-control` artifacts as the historical source set.
- stale-runtime-todo risk -> mitigate by requiring build-mode to materialize runtime todo from the updated `tasks.md` before continuing.
- false-readiness risk -> mitigate by making spec completeness and stop-gate review a pre-execution requirement.

## Critical Files

- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/tasks.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/handoff.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/tasks.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/handoff.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/plan-build-target-model.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/autorunner-compat-analysis.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/runner-contract.md`
