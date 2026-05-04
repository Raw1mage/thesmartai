# Handoff

## Execution Contract

- Build agent MUST read `implementation-spec.md` first.
- Build agent MUST read `proposal.md` / `spec.md` / `design.md` / `tasks.md` before coding, plus `specs/architecture.md` (Config Resolution Boundary + Provider Universe Authority sections).
- Runtime todo MUST be materialized from `tasks.md` via `todowrite(mode=replan_adoption)` before coding begins; not a private parallel checklist.
- Build agent MUST NOT resume from discussion memory alone — this plan package is the execution authority.
- User-visible progress must reuse planner-derived todo naming.

## Required Reads

- `proposal.md` (full Effective Requirement Description + in/out scope)
- `spec.md` (GIVEN/WHEN/THEN per requirement)
- `design.md` (DD-1 through DD-10 — especially DD-9 for the `disabled_providers` narrowing)
- `implementation-spec.md` (assumptions, stop gates, phase contract)
- `tasks.md` (phase-by-phase checklist)
- `../../specs/architecture.md` (Config Resolution Boundary + Provider Universe Authority)
- `../manual-pin-bypass-preflight/plan.md` (sibling philosophy — auto-gate not manual-gate)

## Current State

- Plan validated per planner skill 10/10 artifacts (pending final run).
- Sibling hotfix `plans/manual-pin-bypass-preflight/` already merged on 2026-04-17 and establishes the auto-vs-manual gate pattern that Phase 4 extends.
- Refs submodules fetched to `refs/claude-code@2b53fac` and `refs/codex@d0eff70383` in the working tree but pointer NOT yet bumped in super-repo — the bump is part of Phase 5 deliverables.
- Main branch at `90689d9a2` (provider hotfix not yet started).
- Nothing implemented on the code side yet.

## Stop Gates In Force

- **Pre-coding audits (tasks 1.1, 2.1, 3.1, 4.1)**: if the actual call-site shape differs from assumptions in `implementation-spec.md`, stop and re-plan.
- **Phase boundary validations**: do not advance a phase until its validation item in `tasks.md` passes.
- **`disabled_providers` consumer inventory (4.1)**: do not modify `isProviderAllowed` / post-processing until every consumer is enumerated and the auto-vs-explicit split is explicit.
- **Submodule pointer bump (5.1)**: if days have passed since this plan, re-fetch and re-verify the target SHAs before committing the bump.
- **No new test failures on merge**: if any phase introduces regressions in provider / session / plugin suites, fix or stop.
- **AGENTS.md 第一條**: every new fallback / branch must log; silent swallow is never acceptable.
- **Scope creep into OUT items**: any temptation to add FedRAMP / Azure compaction / resource_uri / models.dev patch → stop, stay in scope.

## Build Entry Recommendation

- Start with Phase 1 (codex logout revoke) — smallest blast radius, clearest contract.
- Phases 1/2/3 are orthogonal; can be done in parallel by the same agent on separate commits.
- Phase 4 (`disabled_providers`) is the highest-risk phase — do it after 1/2/3 land and tests are green.
- Phase 5 (submodule bump + docs) at the end, right before fetch-back.

## Execution-Ready Checklist

- [ ] Implementation spec is complete
- [ ] Companion artifacts are aligned
- [ ] Validation plan is explicit
- [ ] Runtime todo seed is present in `tasks.md`

## Completion / Retrospective Contract

- After build+test pass, compare implementation against the five Effective Requirements in `proposal.md`.
- Produce a validation checklist: requirement coverage, gaps, deferred items, evidence.
- Do NOT expose raw internal chain-of-thought; only auditable conclusions and evidence.
- Each phase closes with an entry in `docs/events/event_2026-04-18_provider_hotfix.md` (updated as phases complete).
