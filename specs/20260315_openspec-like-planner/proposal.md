# Proposal: openspec-like planner

## Why

- The planner workflow had drifted into creating fragmented plan roots from discussion slices, timestamp slugs, and follow-up artifacts.
- The user clarified the intended model: a repo may contain multiple plans, but the same workstream must extend its existing plan instead of spawning a new sibling root for every new idea, bug, or follow-up slice.
- Without reconverging adjacent planner slices back into the correct workstream root, `proposal/spec/design/tasks/handoff` multiply, references drift, and runtime todo lineage becomes harder to govern.

## What Changes

- Converge the planner-first / restart / runner-lineage workstream into its canonical root: `specs/20260315_openspec-like-planner/`.
- Use one primary artifact set (`proposal/spec/design/implementation-spec/tasks/handoff`) as the living planner surface for this workstream.
- Preserve deeper analysis artifacts for this same workstream as supporting docs in the same root.
- Keep unrelated-but-valid workstreams as separate plans instead of forcing the entire repo into one root.

## Capabilities

### New Capabilities

- `stable-workstream-plan-root`
  - one canonical plan root can accumulate additional design slices for the same workstream without opening a new sibling plan for every thread turn.
- `supporting-doc-expansion`
  - advanced design artifacts for the same workstream (runner contract, target model, compatibility analysis, roadmap) can live beside the main six files as supporting docs.

### Modified Capabilities

- `planner-execution-contract`
  - planner artifacts remain the execution substrate, but now within a stable expandable root for this workstream instead of multiple scattered sibling folders.
- `todo-lineage-contract`
  - runtime todo still derives from `tasks.md`, but `tasks.md` is now the backlog inside the canonical workstream package.
- `planner-to-runtime-handoff`
  - build/runner continuation now reads from one stable workstream plan location rather than chasing whichever sibling plan root was created most recently.
- `adjacent-workstream-separation`
  - separate workstreams may remain separate plans when their scope is meaningfully distinct.

## Impact

- Affects the canonical planning surface under `specs/20260315_openspec-like-planner/`.
- Replaces fragmented sibling plan roots for this workstream with one durable package plus supporting docs.
- Establishes the rule that repos may host multiple plans, but the same workstream should expand its existing plan instead of branching endlessly.
