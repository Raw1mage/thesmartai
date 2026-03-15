# Implementation Spec

## Goal

- Re-establish planner-first discipline by converging the fragmented planner artifacts into one canonical extensible plan package, deriving explicit execution tasks from it, and only then continuing implementation from that single root.

## Scope

### IN

- document the already-converged session direction in this canonical plan package
- define the contract between `implementation-spec.md`, `tasks.md`, runtime todo, and `handoff.md`
- restate the remaining execution backlog in ordered phases under one expandable root
- require future build-mode work to begin from this documented plan rather than freeform conversational continuation
- preserve deeper slice analyses as supporting docs in the same root

### OUT

- new runtime feature implementation during this planning step
- privileged host install under `/etc/opencode`
- declaring planner/runtime hardening complete before `runner.txt` or equivalent runtime binding exists
- scattering the same workstream across additional sibling planner roots

## Assumptions

- `specs/20260315_openspec-like-planner/` is now the canonical planner root for this workstream.
- Earlier sibling planner roots are migration sources only and should not remain active after consolidation.
- This plan is now considered implemented/completed for the current cycle.
- Its remaining value is:
  1. source material for `docs/ARCHITECTURE.md` updates
  2. historical design reference for future refactors
  3. re-activation substrate if this workstream is reopened later with explicit user intent

## Stop Gates

- Do not treat this historical plan as an automatically active backlog unless the workstream is explicitly re-opened.
- If this workstream is revived later, update this plan before resuming build-mode work.
- Stop for approval on destructive, privileged, or environment-writing actions (notably `/etc/opencode` host install).
- Stop and re-enter planning if deeper runtime convergence reveals a change in planner/build/runner ownership boundaries.
- Do not reopen a sibling plan root for the same workstream; extend this package instead.

## Critical Files

- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/handoff.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/plan-build-target-model.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/autorunner-compat-analysis.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/runner-contract.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/planner-hardening-roadmap.md`

## Structured Execution Phases

- Phase 1 — canonical planner package consolidation ✅
- Phase 2 — planner/todo lineage hardening ✅
- Phase 3 — `plan/build` semantics and entry convergence ✅
- Phase 4 — runner contract and stop-boundary hardening ✅
- Phase 5 — controlled restart and operational closure ✅
- Phase 6 — historical preservation / future re-activation substrate ✅

## Validation

- planner validation
  - confirm this canonical plan package contains concrete content and no remaining placeholders
  - confirm tasks now reflect completed historical status rather than an active leftover backlog
  - confirm workstream slices now collocate under one root instead of sibling plan folders
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
- Future related slices should be added as supporting docs or updates inside this same root, not by spawning a sibling plan for every new discussion thread.
