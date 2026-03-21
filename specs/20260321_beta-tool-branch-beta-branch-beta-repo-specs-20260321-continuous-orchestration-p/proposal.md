# Proposal: Continuous Orchestration

## Why

- The Orchestrator's `task()` dispatch currently blocks the parent turn until the subagent completes.
- That blocks user progress visibility, prevents mid-run interaction, and makes slow LLM responses look like failures.

## Original Requirement Wording (Baseline)

- "啟用beta-tool，基於現在branch，開一個beta branch在beta repo，進行 specs/20260321_continuous_orchestration/proposal.md的開發計"
- "只做 plan"

## Requirement Revision History

- 2026-03-22: Scope narrowed to planning only; the workstream remains a plan package and does not include code implementation.
- 2026-03-22: Beta-tool branch creation was requested, but the beta worktree gate is blocked by a dirty main worktree; this plan records the blocker and keeps branch setup as a later execution gate.

## Effective Requirement Description

1. Define an execution-ready plan for continuous orchestration.
2. Keep the current workstream in plan mode only; do not implement code in this session.
3. Preserve beta-tool branch setup as a follow-up execution gate once the main worktree is clean.

## Scope

### IN

- Clarify the problem statement, goals, and stopping conditions.
- Define the plan artifacts needed for later implementation.
- Record the beta-tool clean-tree blocker and branch-setup dependency.

### OUT

- Code changes.
- Tests or runtime validation.
- Creating the beta branch until the worktree is clean.

## Non-Goals

- Parallel subagent dispatch.
- Cross-process bus changes.
- UI polishing beyond what the plan must describe.

## Constraints

- Plan only in this session.
- Beta-tool refuses to create a worktree while the main worktree is dirty.
- The workstream must remain aligned with the existing cms branch architecture.

## What Changes

- The proposal becomes an execution plan for async task orchestration.
- Future implementation will treat `task()` as fire-and-dispatch, with completion resumed via bus event and session continuation.
- Branch setup is deferred until the repo is clean.

## Capabilities

### New Capabilities

- Continuous orchestration plan: documents the intended non-blocking task flow.
- Beta-tool gate tracking: records prerequisites for creating the beta branch/worktree.

### Modified Capabilities

- Planning workflow: now explicitly plan-only for this session.

## Impact

- Affects future implementation in `packages/opencode/src/tool/task.ts`.
- Affects future bus subscriber and prompt/runtime follow-up work.
- Affects docs/events tracking and beta-tool execution gating.
