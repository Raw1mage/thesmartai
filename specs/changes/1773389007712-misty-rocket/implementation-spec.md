# Implementation Spec

## Goal

- Re-establish planner-first discipline for the active session by writing the converged discussion into this plan package, deriving explicit execution tasks from it, and only then allowing further implementation to continue.

## Scope

### IN

- document the already-converged session direction in this new plan package
- define the contract between `implementation-spec.md`, `tasks.md`, runtime todo, and `handoff.md`
- restate the remaining execution backlog in ordered phases
- require future build-mode work to begin from this documented plan rather than freeform conversational continuation

### OUT

- new runtime feature implementation during this planning step
- privileged host install under `/etc/opencode`
- declaring planner/runtime hardening complete before `runner.txt` or equivalent runtime binding exists
- replacing the historical `20260315-web-monitor-restart-control` artifact set

## Assumptions

- `specs/changes/20260315-web-monitor-restart-control/` remains the main historical execution record for the work already completed.
- The conversation already converged on the near-term ordering:
  1. runner contract
  2. `/plan` + `@planner` convergence
  3. host install
- The first two items above are now at least partially completed:
  - runner contract draft exists
  - first-slice `/plan` + `@planner` convergence is implemented and validated
- Remaining planned work is now narrowed to:
  - Phase 4 — observability alignment
  - operational closure verification (`5.1` ~ `5.3` in `tasks.md`)

## Stop Gates

- Do not continue implementation until this plan package is no longer template-only.
- If a new implementation slice is not reflected in planner artifacts first, return to plan mode before proceeding.
- If the remaining task ordering changes materially, update this plan before resuming build-mode work.
- Stop for approval on destructive, privileged, or environment-writing actions (notably `/etc/opencode` host install).
- Stop and re-enter planning if deeper runtime convergence reveals a change in planner/build/runner ownership boundaries.

## Critical Files

- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/proposal.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/spec.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/design.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/tasks.md`
- `/home/pkcs12/projects/opencode/specs/changes/1773389007712-misty-rocket/handoff.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/tasks.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/handoff.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/plan-build-target-model.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/autorunner-compat-analysis.md`
- `/home/pkcs12/projects/opencode/specs/changes/20260315-web-monitor-restart-control/runner-contract.md`

## Structured Execution Phases

- Phase 1 — planner package completion ✅
- Phase 2 — task lineage hardening ✅
- Phase 3 — runner/planner convergence slices already landed ✅
  - `/plan` + `@planner` first-slice convergence
  - planner root reuse / todo lineage hardening
  - `spec_dirty` / `replan_required` stop boundaries
- Phase 4 — observability alignment
  - align `[R]` card semantics, transcript narration, workflow vocabulary, and visible todo language with the runner contract
- Phase 5 — operational closure verification
  - verify host-side restart prerequisites and end-to-end `Restart Web` behavior

## Validation

- planner validation
  - confirm this plan package contains concrete content and no remaining placeholders
  - confirm tasks reflect the current real backlog rather than generic template steps
- execution validation for later phases
  - run targeted planner/build/runner tests after any runtime changes
  - run `bun run typecheck` in `packages/opencode`
  - run `bun --filter @opencode-ai/app typecheck`
- operational validation for final phase
  - verify `/etc/opencode/webctl.sh` install and `OPENCODE_WEBCTL_PATH` config
  - verify end-to-end `Restart Web` behavior only after host install completes

## Handoff

- Build agent must read this spec first.
- Build agent must read `tasks.md` and materialize runtime todo from it before coding.
- Build agent must treat conversation memory as supporting context only, not as the execution source of truth.
- If an implementation slice is not already written into planner artifacts, return to plan mode and update the plan before continuing.
- After runtime todo is materialized, user-visible progress and decision requests must align with those same todo/task names.
