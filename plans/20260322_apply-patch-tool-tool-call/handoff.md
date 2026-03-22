# Handoff

## Execution Contract

- This feature is now implemented in mainline code.
- Future follow-up work should treat this package plus the event log as the implementation record.

## Required Reads

- `implementation-spec.md`
- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`
- `docs/events/event_20260322_apply_patch_observability_plan.md`

## Current State

- `apply_patch` now emits phased running metadata from backend execution checkpoints.
- `ApplyPatch` now renders a running-state `BlockTool` before final completion.
- Targeted apply_patch tests pass, including phased metadata observability coverage.

## Stop Gates In Force

- Re-enter planning if future work requires broader runtime metadata transport changes.
- Do not add guessed or fallback progress signals.

## Build Entry Recommendation

- Start from `packages/opencode/src/tool/apply_patch.ts` and `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in `tasks.md`
