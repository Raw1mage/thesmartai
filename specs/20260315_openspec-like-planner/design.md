# Design

## Context

- The original goal was planner-first execution, with `tasks.md` driving runtime todo and runner/build continuation.
- During implementation, multiple planner roots were created for adjacent slices in the same workstream:
  - web monitor + controlled restart
  - planner/todo/runner lineage hardening
- The user clarified the desired behavior: a repo may host multiple plans, but the same workstream should extend its existing plan instead of reopening a new top-level folder every time the conversation branches.

## Goals / Non-Goals

**Goals:**

- Re-converge fragmented plan roots for this workstream into one canonical package.
- Preserve one primary planner contract (`proposal/spec/design/implementation-spec/tasks/handoff`).
- Keep supporting docs for deeper slices without reopening new sibling roots for the same workstream.
- Preserve planner-first, runtime-todo-lineage, runner-boundary, and restart-contract knowledge in one expandable plan.

**Non-Goals:**

- Rewriting implemented runtime logic in this consolidation step.
- Deleting useful supporting analysis just because it does not fit into the primary six files.
- Pretending unrelated future work must always share the same plan root.

## Decisions

- The canonical root for this workstream is `specs/20260315_openspec-like-planner/`.
- The main six files are the authoritative planner contract.
- Additional documents such as `runner-contract.md`, `plan-build-target-model.md`, `autorunner-compat-analysis.md`, and `planner-hardening-roadmap.md` remain in the same root as supporting docs.
- Older sibling plan roots for this same workstream are treated as migration sources and should be eliminated after consolidation.
- Template-only residual roots are not worth preserving as separate plans.
- A separate workstream may still keep its own distinct plan root.

## Risks / Trade-offs

- large-merge risk -> mitigate by preserving one canonical six-file contract and carrying unique analysis into supporting docs instead of flattening everything blindly into one markdown blob.
- path-drift risk -> mitigate by updating repo references and validating planner tests/typecheck after consolidation.
- over-consolidation risk -> mitigate by keeping the rule at the workstream level; a truly different workstream may still justify a separate plan root later.

## Canonical Files

- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/handoff.md`

## Supporting Docs

- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/plan-build-target-model.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/autorunner-compat-analysis.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/runner-contract.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/planner-hardening-roadmap.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/web-monitor-restart-control.proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/web-monitor-restart-control.spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/web-monitor-restart-control.design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/web-monitor-restart-control.handoff.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/web-monitor-restart-control.tasks.md`
