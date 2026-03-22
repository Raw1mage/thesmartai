# Implementation Spec

## Goal

- Make `apply_patch` observable and expandable while running in the TUI by emitting phased execution metadata and rendering a running-state block card before final completion.

## Scope

### IN

- `packages/opencode/src/tool/apply_patch.ts` phased metadata contract and checkpoint emission.
- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` running-state `ApplyPatch` block rendering.
- Preservation of completed diff and diagnostics rendering.
- Validation evidence and event-log synchronization for this feature implementation.

### OUT

- Generic redesign of all tool renderers.
- Changes to unrelated tool cards.
- Performance-only optimization of patch execution.

## Assumptions

- The existing running-state tool metadata channel (`Tool.Context.metadata()`) remains the canonical transport for incremental tool-part metadata.
- Repo-wide root typecheck noise under `infra/*.ts` remains an existing unrelated blocker and does not invalidate feature-local tool validation.

## Stop Gates

- If future changes require broader runtime metadata transport changes beyond `Tool.Context.metadata()`, re-enter planning.
- Do not add guessed or fallback progress signals; progress must stay evidence-backed.

## Critical Files

- `packages/opencode/src/tool/apply_patch.ts`
- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`
- `docs/events/event_20260322_apply_patch_observability_plan.md`

## Structured Execution Phases

- Phase 1: derive `ApplyPatchMetadata` and emit checkpoint metadata across parse/plan/apply/diagnostics/failure/completion.
- Phase 2: render `ApplyPatch` as a running-state `BlockTool` that can expand before final `metadata.files` exists.
- Phase 3: preserve completed diff/diagnostics behavior and validate feature-local tool behavior.

## Validation

- Run `bun test "packages/opencode/test/tool/apply_patch.test.ts"` and extend/add coverage for phased metadata and running-state rendering as needed.
- Verify code paths cover `parsing`, `planning`, `awaiting_approval`, `applying`, `diagnostics`, `failed`, and `completed` states.
- Record whether root `bunx tsc --noEmit --pretty false` is still blocked by pre-existing unrelated `infra/*.ts` typing errors.

## Handoff

- Build agent must implement the phased metadata contract and running-state renderer behavior described above.
- Build agent must update the event log and keep planner artifacts aligned with actual implementation status.
