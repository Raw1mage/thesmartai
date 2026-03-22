# Design: builder_framework

## Context

- `beta-tool` captures external worktree orchestration semantics.
- `build_beta` captures builder-native beta workflow integration.
- `planner-lifecycle` captures `/plans` versus `/specs` authority boundaries that builder depends on.

## Decisions

1. Use `specs/builder_framework/` as the canonical semantic root.
2. Preserve each merged source under `sources/` rather than flattening or rewriting detailed artifacts.
3. Keep the canonical files small and cross-cutting, with provenance explicit in-file.
4. Treat builder-native beta support as insufficient unless the framework also defines an explicit execution-surface enforcement layer for beta-enabled build runs.

## Builder Enforcement Model

- Source artifacts under `sources/build_beta/` prove that builder already absorbed bootstrap, routine git, syncback, remediation, and finalize behavior.
- Real operation exposed an enforcement gap, and the framework now treats that gap as resolved through an explicit runtime execution gate.
- The framework distinguishes two layers:
  1. **Capability layer** — mission metadata, bootstrap helpers, routine git helpers, syncback/finalize/remediation helpers.
  2. **Enforcement layer** — runtime gate that resolves where implementation work is allowed to run.
- `plan_enter` has strong enforcement because it is a single tool boundary in `packages/opencode/src/tool/plan.ts`.
- Builder now has a corresponding runtime boundary because build execution spans `plan_exit`, mission handoff, workflow continuations, and delegated coding/testing work.

## Implemented Enforcement Shape

- Beta-enabled build execution now gates coding implementation on a resolved beta execution contract.
- The authoritative execution contract is:
  - implementation worktree = `mission.beta.betaPath`
  - implementation branch = `mission.beta.branchName`
  - docs/specs/events writeback = main repo/worktree
- Routing is applied before coding/delegation rather than after model reasoning.
- Beta-enabled coding on authoritative main repo/base branch is fail-fast illegal.
- Focused runtime validation now covers this enforcement behavior in addition to existing helper/unit coverage.

## Structure

- `proposal.md`, `spec.md`, `design.md`, `implementation-spec.md`, `tasks.md`, `handoff.md`: canonical taxonomy entry files.
- `sources/beta-tool/`: preserved beta-tool source artifacts.
- `sources/build_beta/`: preserved builder-native beta integration artifacts.
- `sources/planner-lifecycle/`: preserved planner lifecycle artifacts relevant to builder flow.
