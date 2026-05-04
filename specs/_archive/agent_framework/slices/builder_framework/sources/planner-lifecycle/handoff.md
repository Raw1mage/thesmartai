# Handoff

## Execution Contract

- Build/implementation agent must read `implementation-spec.md` first.
- Build/implementation agent must read `proposal.md`, `spec.md`, `design.md`, and `tasks.md` before coding.
- Runtime todo must be materialized from `tasks.md` before execution continues.
- Build/implementation agent must treat the dated plan root under `/plans/` as the authoritative planner root during implementation.
- Build/implementation agent must not resume from discussion memory alone when this plan package is available.
- User-visible progress and decision prompts must reuse the same planner-derived todo naming.
- Plan mode may use todo as a working ledger, but build mode must return to planner-derived execution authority.
- Do not move artifacts into `/specs` during planning, build, commit, or merge.

## Required Reads

- `proposal.md`
- `spec.md`
- `design.md`
- `implementation-spec.md`
- `tasks.md`

## Stop Gates In Force

- Preserve approval, decision, and blocker gates from `implementation-spec.md`.
- Return to plan mode before coding if a new implementation slice is not represented in planner artifacts.
- Do not create a brand-new sibling plan unless the user explicitly requests it, or explicitly approves an assistant proposal to branch.
- Do not promote `/plans` artifacts into `/specs` unless the user explicitly requests that promotion after execution, commit, and merge are complete.
- For legacy dated packages currently under `/specs/`, require explicit status-based triage rather than silent dual-root behavior.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in `tasks.md`
- [x] `/plans` vs `/specs` lifecycle wording is consistent across runtime, prompts, skills, and docs
- [x] Plan-mode vs build-mode todo authority wording is explicit
- [x] Legacy dated-package triage rules are explicit and validated

## Completion / Retrospective Contract

- Review implementation against the proposal's effective requirement description.
- Generate a validation checklist derived from `tasks.md`, runtime todo outcomes, implementation results, and executed validations.
- Report requirement coverage, partial fulfillment, deferred items, and remaining gaps as concise review output.
