# Proposal: Planner Lifecycle

## Why

- The repository previously conflated active planning workspaces with long-lived formal specs by storing dated planner packages directly under `/specs/`.
- Planner workflow also drifted into opening fragmented sibling plan roots for the same workstream and over-constraining todo usage during plan mode.
- A single canonical lifecycle spec should describe repository taxonomy, same-workstream continuity, and mode-aware planner execution semantics.

## Merged Sources

- `/home/pkcs12/projects/opencode/specs/planner-lifecycle/`
- `/home/pkcs12/projects/opencode/specs/20260315_openspec-like-planner/`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/`

## Effective Requirement Description

1. Use `/plans` as the authoritative repo-local location for active planner artifacts.
2. Keep `specs/architecture.md` as the long-lived architecture SSOT, while semantic per-feature roots under `/specs/` hold formalized post-implementation specs.
3. Keep planning and build execution bound to the same dated `/plans/` root unless the user explicitly approves a new plan root.
4. Same-workstream follow-up scope, bugfixes, or design slices must extend the existing plan root by default; a new plan root requires explicit user request or approval.
5. Plan mode todo acts as a working ledger; build mode todo acts as a strict execution ledger derived from planner artifacts.
6. `plan_exit` is the explicit authority switch from relaxed plan-mode todo semantics to strict build-mode execution semantics.
7. Do not auto-promote plan artifacts into `/specs`; promotion is explicit and post-merge.

## Scope

### IN

- Runtime and prompt contract changes required for `/plans` to become the active planner root.
- Documentation and skill wording updates that currently assume dated plan roots under `/specs/` during planning/build.
- Architecture wording updates that explain the new repository information architecture.
- Legacy dated plan-package triage rules based on whether the plan was actually implemented.
- Same-workstream plan-root continuity rules.
- Mode-aware todo authority rules for plan mode vs build mode.

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

- Planner artifact root construction, template lookup, and mission artifact metadata resolve to dated roots under `/plans/`.
- Planner continuation rules require same-workstream expansion on the existing root by default.
- Todo authority becomes mode-aware: relaxed working ledger in plan mode, strict planner-derived execution ledger in build mode.
- Project documentation explicitly distinguishes planning artifacts, architecture SSOT, and post-merge formalized specs.
- Legacy dated packages already living under `/specs/` are triaged by implementation status.

## Capabilities

### New Capabilities

- Explicit planner artifact lifecycle.
- Same-workstream canonical plan continuation.
- Mode-aware todo authority across plan/build boundaries.

### Modified Capabilities

- `plan_enter` / `plan_exit`: active planning/build packages live under `/plans/`, with `plan_exit` switching todo authority to strict execution mode.
- Planner/build documentation workflow: `/specs` is no longer the default location for in-progress feature plan packages.
- `todowrite`: now interpreted differently in plan mode vs build mode.

## Impact

- Runtime planner path resolution and plan tool behavior.
- Prompt templates, planner/agent workflow skills, AGENTS contracts, and template distribution paths.
- Repository organization rules and future plan/spec archival practices.
- Legacy plan cleanup and migration heuristics.
