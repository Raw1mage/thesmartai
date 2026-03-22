# Handoff

## Execution Contract

- Build/implementation agent must read `implementation-spec.md` first.
- Build/implementation agent must read `proposal.md`, `spec.md`, `design.md`, and `tasks.md` before coding.
- Runtime todo must be materialized from `tasks.md` before execution continues.
- Build/implementation agent must treat the dated plan root under `/plans/` as the authoritative planner root during implementation.
- Build/implementation agent must not resume from discussion memory alone when this plan package is available.
- User-visible progress and decision prompts must reuse the same planner-derived todo naming.
- Do not move artifacts into `/specs` during planning, build, commit, or merge.

## Required Reads

- `proposal.md` (including original requirement wording, revision history, and effective requirement description)
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
- When promotion is approved, target a semantic per-feature spec root such as `specs/plans-specs-lifecycle` rather than dated planner-root naming.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in `tasks.md`
- [x] `/plans` vs `/specs` lifecycle wording is consistent across runtime, prompts, skills, and docs
- [x] Legacy dated-package triage rules are explicit and validated
- [x] Formalized spec naming rules for semantic per-feature roots are explicit and validated

## Completion / Retrospective Contract

- Review implementation against the proposal's effective requirement description.
- Generate a validation checklist derived from `tasks.md`, runtime todo outcomes, implementation results, and executed validations.
- Report requirement coverage, partial fulfillment, deferred items, and remaining gaps as concise review output.
- Do not expose raw internal chain-of-thought; expose only auditable conclusions and evidence.
