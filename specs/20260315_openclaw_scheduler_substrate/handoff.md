# Handoff

## Execution Contract

- This package is the planning authority for the first implementation-oriented scheduler substrate slice.
- Benchmark findings from `20260315_openclaw_runner_benchmark` are inputs, not the active build authority.
- Do not jump to heartbeat / isolated jobs / daemon lifecycle until Trigger + Queue slices are planned and approved.

## Required Reads

- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/tasks.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_openclaw_scheduler_substrate_plan.md`

## Stop Gates In Force

- Stop if implementation pressure expands scope into scheduler persistence, heartbeat execution, or daemon lifecycle.
- Stop if generic trigger modeling weakens current approval / decision / blocker semantics.
- Stop if queue generalization introduces hidden retry/fallback behavior.

## Build Entry Recommendation

- Start with `RunTrigger` extraction and `RunLane` design only.
- Prefer a thin first refactor that reclassifies existing mission continuation into the new model before adding any new trigger source.

## Execution-Ready Checklist

- [ ] Trigger taxonomy is explicit
- [ ] Lane semantics are explicit
- [ ] Queue generalization boundaries are explicit
- [ ] Validation plan exists before code changes
