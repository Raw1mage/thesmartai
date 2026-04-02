# Implementation Spec

## Goal

- Redefine the repository planner/spec artifact lifecycle so active planning and build-driving artifacts live under `/plans/`, while `/specs/` is reserved for long-lived architecture knowledge and post-merge, user-requested formalized specs.

## Scope

### IN

- Audit and update runtime planner path resolution to use dated roots under `/plans/` as the active planning workspace inside git repos.
- Update `plan_enter`, `plan_exit`, mission artifact metadata, template lookup, and builder contracts to treat `/plans` as the execution-driving artifact root.
- Update planner/runtime todo authority so plan mode is relaxed and build mode remains planner-derived and strict.
- Update system prompts, skills, templates, and AGENTS contracts that currently encode dated roots under `/specs/` as the active planner workspace.
- Define explicit lifecycle semantics that `/plans` artifacts remain authoritative through planning, execution, commit, and merge preparation; outside beta finalize they stay in `/plans` until explicit user instruction, but beta workflow closeout must consolidate completed plan knowledge into the related semantic `/specs/` family after the final test-branch merge.
- Preserve `specs/architecture.md` as the global architecture SSOT.

### OUT

- Bulk migration of all legacy historical dated plan folders currently stored under `/specs/`.
- Unscoped blanket post-merge promotion from `/plans` to `/specs` for every workflow regardless of execution mode or spec-family mapping.
- Redesign of unrelated workflow orchestration behavior beyond artifact-location semantics.

## Assumptions

- The user wants a strict semantic split: `/plans` means work-in-progress planning/build contract, `/specs` means formalized post-implementation spec artifacts.
- The build agent should continue reading and updating the same plan package during implementation rather than switching roots at `plan_exit`.
- Plan mode should support casual or exploratory todo usage without weakening build-mode execution authority.
- Promotion from `/plans` to `/specs` remains approval-gated for ordinary/non-beta workstreams, while beta-enabled finalize owns a required post-merge closeout that folds the completed plan into the related semantic spec family after the final test-branch merge.
- Legacy dated packages currently under `/specs/` should be triaged by implementation status: implemented ones move into formalized per-feature spec directories, non-implemented ones move into `/plans`.

## Stop Gates

- Stop if implementing the new lifecycle would require automatic plan promotion or any silent fallback between `/plans` and `/specs` without explicit user approval.
- Stop if backward-compatibility behavior for legacy dated plan packages under `/specs/` cannot be specified without product input.
- Stop if the repo lacks a reliable enough definition of "implemented" for triaging legacy dated packages.
- Stop if relaxed plan-mode todo behavior would blur or weaken strict build-mode execution authority.
- Stop if template/runtime path changes imply release-template migration work outside the agreed scope.

## Structured Execution Phases

- Phase 1: finalize lifecycle semantics for `/plans`, `/specs`, `plan_exit`, and the beta-specific post-merge promotion/closeout gate.
- Phase 2: update runtime path resolution, planner template lookup, and mission artifact storage to use `/plans` as the active planner root.
- Phase 3: define and implement plan-mode vs build-mode todo authority semantics.
- Phase 4: define and implement a legacy triage strategy for existing dated packages currently stored under `/specs/` based on implementation status.
- Phase 5: rewrite prompts, skills, AGENTS contracts, and architecture wording so all planning/build instructions align with the new lifecycle.
- Phase 6: verify builder/runtime behavior, todo authority behavior, template references, documentation consistency, and any deferred legacy-migration follow-up.

## Validation

- Search for active-plan assumptions under `/specs/` in runtime code, prompts, skills, templates, and AGENTS files; confirm active-planning references have moved to `/plans/`.
- Verify `specs/architecture.md` remains the only global architecture root contract and is no longer conflated with active plan package storage.
- Validate that `plan_enter` creates dated artifact roots under `/plans/` and `plan_exit` continues to reference the same `/plans` root for build mode.
- Validate that plan mode accepts relaxed todo updates while build mode preserves planner-derived execution authority.
- Validate that non-beta workflows still avoid silent `/plans` → `/specs` promotion, while beta finalize requires post-merge consolidation into the related semantic spec family.
- Validate that legacy dated packages under `/specs/` have an explicit triage rule.

## Handoff

- Build/implementation agent must read this spec first.
- Build/implementation agent must read `proposal.md`, `spec.md`, `design.md`, `tasks.md`, and `handoff.md` before coding.
- Build/implementation agent must treat the dated plan root under `/plans/` as the authoritative artifact root during planning and build execution.
- Runtime todo must be materialized from `tasks.md` in the same `/plans` root and keep planner task naming stable in build mode.
- If scope changes or a new slice appears, update the same `/plans` root unless a new plan is explicitly user-approved.
- Do not move artifacts into `/specs` automatically at `plan_exit`, commit time, or ordinary merge time; the only workflow-owned promotion path is beta finalize closeout after the final test-branch merge into the authoritative base branch.
