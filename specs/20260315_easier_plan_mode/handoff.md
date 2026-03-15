# Handoff

## Execution Contract

- This package defines the todo-policy rewrite for easier plan mode.
- The goal is not to weaken build mode, but to let plan mode act as a legitimate casual/debug ledger surface.

## Required Reads

- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/tasks.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_easier_plan_mode.md`

## Stop Gates In Force

- Stop if implementation would weaken build-mode planner authority.
- Stop if relaxed todo semantics leak into autonomous build execution.
- Stop if the transition between plan/build mode remains ambiguous.

## Required Implementation Bundle

- Prompt/doc-only wording updates are insufficient.
- The implementation bundle must cover:
  - runtime `todowrite` mode-awareness
  - explicit plan/build sync behavior
  - prompt/system/skill wording alignment
  - tests that lock relaxed plan-mode vs strict build-mode semantics

## Execution-Ready Checklist

- [x] Plan-mode relaxed todo semantics are explicit
- [x] Build-mode strict todo semantics are explicit
- [x] Transition rule is explicit
- [x] Validation strategy is explicit
