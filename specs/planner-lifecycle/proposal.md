# Proposal: Plans vs Specs Lifecycle Refactor

## Why

- The repository currently conflates active planning workspaces with long-lived formal specs by storing dated planner packages directly under `/specs/`.
- That conflation makes `specs/` root noisy, weakens the literal meaning of `specs`, and obscures when a document is still a work-in-progress plan versus a finalized spec.

## Original Requirement Wording (Baseline)

- "我是想在repo下再開一個資料夾/plans"
- "planner規劃的檔案應該放/plans"
- "實作完成後就變成/specs"
- "這樣才是合乎字面意義的檔案整理方式。"
- "請盤點程式中所要需要改的地方，包含plan.ts, system prompts, skills"

## Requirement Revision History

- 2026-03-22 planning audit: identified runtime, prompt, skill, template, and AGENTS references that encode dated roots under `/specs/` as the active planner workspace.
- 2026-03-22 lifecycle decision: user clarified that plans should remain under `/plans` through execution, commit, and merge; movement to `/specs` only happens later by explicit spoken request.

## Effective Requirement Description

1. Introduce `/plans` as the authoritative repo-local location for active planner artifacts created by planner workflows.
2. Keep `/specs/architecture.md` as the long-lived architecture SSOT, but stop treating dated roots under `/specs/` as the default active planner workspace.
3. Ensure planner/build/runtime contracts continue to operate on the same dated package under `/plans/` throughout planning and implementation.
4. Do not auto-promote plan artifacts into `/specs`; only move or formalize them after execution is complete, committed, merged, and the user explicitly requests the move.
5. Update prompts, skills, templates, and project rules so the terminology and workflow match this lifecycle model.
6. Triage existing legacy dated packages under `/specs/` by implementation status: implemented ones belong in formalized per-feature specs, non-implemented ones belong in `/plans`.
7. Use semantic formalized-spec roots like `specs/plans-specs-lifecycle` rather than keeping dated planner package naming after promotion.

## Scope

### IN

- Runtime and prompt contract changes required for `/plans` to become the active planner root.
- Documentation and skill wording updates that currently assume dated plan roots under `/specs/` during planning/build.
- Architecture wording updates that explain the new repository information architecture.
- Legacy dated plan-package triage rules based on whether the plan was actually implemented.

### OUT

- Automatically reorganizing all historical plan folders.
- Defining every possible post-merge `/specs` taxonomy beyond this lifecycle contract.

## Non-Goals

- Solving unrelated runtime workflow issues.
- Introducing fallback mechanisms that silently read/write both roots without explicit compatibility rules.

## Constraints

- `specs/architecture.md` must remain stable as the architecture SSOT and should not be relocated.
- The new model must avoid silent fallback or automatic promotion between `/plans` and `/specs`.
- Existing prompts/templates/runtime code need a consistent single-source lifecycle definition.

## What Changes

- Planner artifact root construction, template lookup, and mission artifact metadata will be redirected from dated roots under `/specs/` to dated roots under `/plans/`.
- Builder/system prompt contracts and skills will be rewritten so build execution reads planner packages from `/plans`.
- Project documentation will explicitly distinguish planning artifacts, architecture SSOT, and post-merge formalized specs.
- Legacy dated packages already living under `/specs` will no longer be treated uniformly; they will be reclassified based on implementation status.
- Formalized feature specs will use semantic directory names under `/specs/` instead of dated planner roots.

## Capabilities

### New Capabilities

- Explicit planner artifact lifecycle: the repo can distinguish active plans from formalized specs without overloading `specs/`.
- Manual promotion gate: post-merge movement into `/specs` becomes an explicit user-driven action rather than an implicit lifecycle side effect.

### Modified Capabilities

- `plan_enter` / `plan_exit`: active planning/build packages live under `/plans` instead of `/specs`.
- Planner/build documentation workflow: `/specs` is no longer the default location for in-progress feature plan packages.

## Impact

- Runtime planner path resolution and plan tool behavior.
- Prompt templates, planner/agent workflow skills, AGENTS contracts, and template distribution paths.
- Repository organization rules and future plan/spec archival practices.
- Legacy plan cleanup and migration heuristics.
