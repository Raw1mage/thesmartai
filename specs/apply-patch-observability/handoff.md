# Handoff

## Execution Contract

- This feature is implemented and merged.
- Future changes should read the formalized spec package plus the event log before modifying `apply_patch` observability behavior.

## Required Reads

- `implementation-spec.md`
- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`
- `docs/events/event_20260322_apply_patch_observability_plan.md`

## Current State

- `apply_patch` emits phased metadata during running state.
- `ApplyPatch` renders a running-state block card before final completion.
- Feature-local apply_patch tests are passing.

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
