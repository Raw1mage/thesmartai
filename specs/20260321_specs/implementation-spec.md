# Implementation Spec

## Goal

- Redefine the repository planner/spec artifact lifecycle so active planning and build-driving artifacts live under `/plans/`, while `/specs/` is reserved for long-lived architecture knowledge and post-merge, user-requested formalized specs.

## Scope

### IN

- Audit and update runtime planner path resolution to use dated roots under `/plans/` as the active planning workspace inside git repos.
- Update `plan_enter`, `plan_exit`, mission artifact metadata, template lookup, and builder contracts to treat `/plans` as the execution-driving artifact root.
- Update system prompts, skills, templates, and AGENTS contracts that currently encode dated roots under `/specs/` as the active planner workspace.
- Define explicit lifecycle semantics that `/plans` artifacts remain authoritative through planning, execution, commit, and merge, and only move to `/specs` after explicit user instruction.
- Preserve `specs/architecture.md` as the global architecture SSOT.

### OUT

- Bulk migration of all legacy historical dated plan folders currently stored under `/specs/`.
- Automatic post-merge promotion from `/plans` to `/specs` without explicit user instruction.
- Redesign of unrelated workflow orchestration behavior beyond artifact-location semantics.

## Assumptions

- The user wants a strict semantic split: `/plans` means work-in-progress planning/build contract, `/specs` means formalized post-implementation spec artifacts.
- The build agent should continue reading and updating the same plan package during implementation rather than switching roots at `plan_exit`.
- Promotion from `/plans` to `/specs` is approval-gated and manually triggered by explicit user wording after the plan has been executed, committed, and merged.
- Legacy dated packages currently under `/specs/` should be triaged by implementation status: implemented ones move into formalized per-feature spec directories, non-implemented ones move into `/plans`.
- Formalized per-feature specs should use semantic roots such as `specs/plans-specs-lifecycle` rather than dated plan-package naming.

## Stop Gates

- Stop if implementing the new lifecycle would require automatic plan promotion or any silent fallback between `/plans` and `/specs` without explicit user approval.
- Stop if backward-compatibility behavior for legacy dated plan packages under `/specs/` cannot be specified without product input.
- Stop if the repo lacks a reliable enough definition of "implemented" for triaging legacy dated packages.
- Stop if template/runtime path changes imply release-template migration work outside the agreed scope.
- Re-enter planning if execution uncovers a second lifecycle state (for example, archived specs vs shipped specs) not represented in this plan.

## Critical Files

- `packages/opencode/src/session/planner-layout.ts`
- `packages/opencode/src/tool/plan.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/server/routes/session.ts`
- `templates/prompts/SYSTEM.md`
- `templates/prompts/constitution.md`
- `templates/skills/planner/SKILL.md`
- `templates/skills/agent-workflow/SKILL.md`
- `templates/skills/doc-coauthoring/SKILL.md`
- `AGENTS.md`
- `templates/AGENTS.md`
- `templates/specs/*` (or replacement `templates/plans/*`)
- `specs/architecture.md`
- `docs/events/event_20260322_plans_specs_lifecycle.md`

## Structured Execution Phases

- Phase 1: finalize lifecycle semantics for `/plans`, `/specs`, `plan_exit`, and manual promotion gates.
- Phase 2: update runtime path resolution, planner template lookup, and mission artifact storage to use `/plans` as the active planner root.
- Phase 3: define and implement a legacy triage strategy for existing dated packages currently stored under `/specs/` based on implementation status.
- Phase 4: rewrite prompts, skills, AGENTS contracts, and architecture wording so all planning/build instructions align with the new lifecycle.
- Phase 5: verify builder/runtime behavior, template references, documentation consistency, and any deferred legacy-migration follow-up.

## Validation

- Search for active-plan assumptions under `/specs/` in runtime code, prompts, skills, templates, and AGENTS files; confirm active-planning references have moved to `/plans/`.
- Verify `specs/architecture.md` remains the only global architecture root contract and is no longer conflated with active plan package storage.
- Validate that `plan_enter` creates dated artifact roots under `/plans/` and `plan_exit` continues to reference the same `/plans` root for build mode.
- Validate that no automatic `/plans` → `/specs` promotion occurs without an explicit user-triggered follow-up action.
- Validate that legacy dated packages under `/specs/` have an explicit triage rule: implemented packages move to formalized per-feature spec roots, non-implemented packages move to `/plans`.
- Validate that formalized specs use semantic per-feature roots such as `specs/plans-specs-lifecycle` rather than dated plan roots.
- Record any remaining legacy dated-package compatibility behavior as explicit deferred work rather than hidden fallback.

## Handoff

- Build/implementation agent must read this spec first.
- Build/implementation agent must read `proposal.md`, `spec.md`, `design.md`, `tasks.md`, and `handoff.md` before coding.
- Build/implementation agent must treat the dated plan root under `/plans/` as the authoritative artifact root during planning and build execution.
- Runtime todo must be materialized from `tasks.md` in the same `/plans` root and keep planner task naming stable.
- Conversation memory is supporting context only, not the execution source of truth.
- If scope changes or a new slice appears, update the same `/plans` root unless a new plan is explicitly user-approved.
- Do not move artifacts into `/specs` automatically at `plan_exit`, commit time, or merge time.
- Only perform `/plans` → `/specs` promotion after the plan is fully executed, committed, merged, and the user explicitly instructs the assistant to move/formalize it.
- For legacy dated packages already under `/specs`, triage by implementation status before migration: implemented packages belong in formalized per-feature spec roots, non-implemented packages belong in `/plans`.
- Formalized destination paths should be semantic feature roots such as `specs/plans-specs-lifecycle`, while `specs/architecture.md` remains the global architecture root file.
- At completion time, review implementation against the proposal's effective requirement description.
