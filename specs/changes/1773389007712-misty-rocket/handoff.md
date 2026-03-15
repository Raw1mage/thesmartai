# Handoff

## Execution Contract

- Build agent must read `implementation-spec.md` first.
- Build agent must read `tasks.md` before coding.
- Build agent must materialize runtime todo from `tasks.md` before continuing implementation.
- Build agent must not resume from discussion memory alone when the planner artifact is available.
- Build agent must ask for user decisions against the same planner-derived runtime todo names shown in sidebar/status, not a private alternate checklist.

## Required Reads

- `implementation-spec.md`
- `design.md`
- `tasks.md`
- `../20260315-web-monitor-restart-control/plan-build-target-model.md`
- `../20260315-web-monitor-restart-control/autorunner-compat-analysis.md`
- `../20260315-web-monitor-restart-control/runner-contract.md`

## Stop Gates In Force

- Preserve approval, decision, and blocker gates from `implementation-spec.md`.
- Return to plan mode before coding if a new implementation slice is not yet represented in planner artifacts.
- Stop for privileged environment changes such as `/etc/opencode` host install unless the required permissions are available.
- Stop and replan if planner/build/runner ownership boundaries materially change during deeper runtime convergence.

## Current Execution Ordering

1. Phase 4 — observability alignment (`runner-contract.md`)
2. host-side restart validation (`tasks.md` section 5)

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo has been materialized from `tasks.md`
- [x] Build-mode continuation has resumed from the documented plan rather than conversation memory alone

## Naming alignment note

- When referring to runner work, use the same names as `tasks.md` section 4 and `runner-contract.md`:
  - Phase 1 — contract asset
  - Phase 2 — mode binding
  - Phase 3 — planner boundary hardening
  - Phase 4 — observability alignment
- Do not report vague “phase2/phase3” progress unless it is mapped back to these exact task entries.
