# Proposal

## Why

- Current execution has partially converged around planner-first behavior, but the newly created plan artifact is still empty template content.
- The user explicitly requires a stricter contract: discussion must first be written into planner/spec artifacts, then analyzed into tasks/todos, and only then execution may continue.
- Without this step, code, runtime todo state, and handoff documents can drift from the actual agreed direction.

## What Changes

- Fill this new planner change set with the already-converged discussion from the session.
- Define a clear contract for how `implementation-spec.md`, `tasks.md`, runtime todos, and `handoff.md` relate.
- Restate the remaining execution backlog in planner form before any new implementation continues.

## Capabilities

### New Capabilities

- planner-execution-contract: execution must start from completed planner artifacts rather than jumping directly from discussion into code.
- todo-lineage-contract: runtime todo is explicitly treated as a projection of planner tasks, not as an independent planning surface.

### Modified Capabilities

- plan/build workflow: planner-first documentation becomes a hard prerequisite for continued implementation work in this thread.
- session continuity: future build-mode continuation should consume plan artifacts with clearer lineage and stop-gate semantics.

## Impact

- Affects the active planning surface under `specs/changes/1773389007712-misty-rocket/`.
- Aligns with existing work already captured under `specs/changes/20260315-web-monitor-restart-control/`.
- Delays further implementation until the new planner artifacts are no longer placeholders.
