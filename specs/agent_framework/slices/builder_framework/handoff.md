# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding.
- Materialize tasks.md into runtime todos before coding.
- Preserve the split between `plan_exit` beta authority collection and workflow-runner quiz evaluation before deleting or shrinking old prompt wording.
- Treat prompt/skill/MCP surfaces as advisory only.
- Defer broad hard-guard expansion unless validation produces a concrete uncovered failure that justifies a narrow follow-up guard.

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md
- specs/architecture.md
- docs/events/event_20260323_beta_workflow_skill.md

## Current State

- The active plan root existed only as template placeholders before the recent planning pass.
- A beta-workflow skill and related builder wiring already landed, but guidance surfaces are not a reliable enforcement strategy.
- Runtime has since drifted from the original spec: `plan_exit` now compiles mission metadata and sets pending admission, while workflow-runner performs the actual admission evaluation.
- The retry policy is fixed: one reflection-based retry is allowed; repeated failure must stop with `product_decision_needed`.
- `implementationBranch` correction is now a pre-admission mutation path in `plan_exit`, especially for stale slug-derived branch values from older failed sessions.

## Stop Gates In Force

- Stop if quiz evaluation cannot be made deterministic from current mission/mainline metadata.
- Stop if `implementationBranch` cannot be collected/corrected before beta handoff.
- Stop if implementation requires heuristic judging of open-ended answers.
- Stop if the implementation starts drifting toward a broad rule-engine instead of the agreed admission slice.
- Stop and ask the user if the model still fails the quiz after the allowed retry.

## Build Entry Recommendation

- Start with the staged admission contract: confirm `plan_exit` mission setup/branch correction and workflow-runner evaluation stay aligned before editing any further runtime wording.

## Execution-Ready Checklist

- [ ] Implementation spec is complete
- [ ] Companion artifacts are aligned
- [ ] Validation plan is explicit
- [ ] Runtime todo seed is present in tasks.md
