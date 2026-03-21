# Implementation Spec

## Goal

Rewrite telemetry as a bus-messaging-first contract so the next builder can move from the current snapshot/hydration baseline to a projector-owned, reducer-owned architecture without reinterpreting authority.

## Scope

### IN

- Rewrite the telemetry spec package into a builder checklist.
- Define current state, target state, and migration path separately.
- Define the target authority chain: runtime events → server projector → app reducer → UI consumer.
- Update `specs/architecture.md` and event documentation to match the rewrite contract.

### OUT

- Product code changes.
- Quota/account/billing telemetry redesign.
- UI redesign.
- Preserving legacy telemetry glue that conflicts with target ownership.

## Assumptions

- Runtime telemetry events already exist for at least part of the needed fact surface.
- Runtime telemetry persistence already exists for supported event types.
- `session.top` and monitor telemetry exist today as snapshot-bearing baseline paths.
- App already has `global-sync` state with `session_telemetry`, but current steady-state hydration ownership is wrong.
- Builder is authorized to remove, replace, or demote conflicting legacy telemetry glue.
- The rewrite must preserve telemetry's original product purpose: A111 prompt composition evidence and A112 round/session/compaction evidence.

## Stop Gates

- **Duplicate authority**: stop if any steady-state path other than projector → reducer can write canonical telemetry truth.
- **Fallback promotion**: stop if `session.top`, monitor hydration, or local fallback remains or becomes a steady-state primary path.
- **Partial migration hazards**: stop if projector/reducer are introduced while old hydration/page-hook writers can still mutate canonical telemetry.
- **Architecture drift**: stop if implementation optimizes around current shortcuts instead of bus-first ownership.
- Stop if the real code baseline materially differs from the documented current-state inventory.
- Stop for approval if telemetry work expands into broader non-telemetry app architecture rewrite.
- Stop for approval if non-telemetry monitor/status semantics must change to complete this migration.

## Critical Files

- `specs/architecture.md`
- `specs/20260320_telemetry-implementation/proposal.md`
- `specs/20260320_telemetry-implementation/spec.md`
- `specs/20260320_telemetry-implementation/design.md`
- `specs/20260320_telemetry-implementation/implementation-spec.md`
- `specs/20260320_telemetry-implementation/tasks.md`
- `specs/20260320_telemetry-implementation/handoff.md`
- `docs/events/event_20260321_telemetry_builder_first_contract.md`
- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/processor.ts`
- `packages/opencode/src/bus/subscribers/telemetry-runtime.ts`
- `packages/opencode/src/session/monitor.ts`
- `packages/opencode/src/server/routes/session.ts`
- `packages/app/src/context/global-sync/event-reducer.ts`
- `packages/app/src/context/global-sync/types.ts`
- `packages/app/src/context/sync.tsx`
- `packages/app/src/pages/session/use-status-monitor.ts`
- `packages/app/src/pages/session/monitor-helper.ts`

## Structured Execution Phases

### Phase 1 — Baseline freeze

- Record the actual current telemetry path from runtime emission to UI consumption.
- Mark which current paths are inventory only, which are recovery only, and which incorrectly act as steady-state authority.
- Freeze these facts before defining the rewrite so builder does not code against stale assumptions.

### Phase 2 — Event contract

- Define authoritative runtime telemetry event shapes for prompt, round, compaction, and future session telemetry facts.
- Define identity, ordering, replay, and idempotency semantics.
- Decide what projector-owned updates the app consumes.
- Reject any contract that requires UI or page hooks to synthesize missing authority.
- Freeze a minimum event matrix before moving forward:
  - event classes
  - producer boundaries
  - required identity fields
  - ordering / replay assumptions
  - projector-consumed payload subset
  - reducer-consumed downstream update subset

### Phase 3 — Projector

- Define the server telemetry projector as the sole authoritative read-model owner.
- Define projector aggregate shape and session-scoped lifecycle.
- Route monitor and `session.top` to projector-owned state only.
- Delete or demote monitor-derived authority heuristics.
- Freeze a minimum projector aggregate matrix before reducer work:
  - prompt telemetry summary
  - round telemetry summary
  - compaction telemetry summary
  - session cumulative summary
  - freshness metadata
  - degraded/catch-up metadata

### Phase 4 — Reducer cutover

- Define `global-sync` reducer actions and canonical `session_telemetry` shape.
- Cut all steady-state telemetry writes over to reducer-owned updates.
- Remove, replace, or degrade old page-level hydration writers.
- Name the exact cutover condition after which legacy writers are forbidden.
- Define an explicit forbidden-writer list after cutover, including at minimum:
  - page-level hydration effects
  - monitor helper authority synthesis
  - snapshot refresh writers
  - local fallback promotion paths
- Cutover is not complete until the forbidden-writer list is attached to the implementation slice and validated as enforced.

### Phase 5 — Snapshot demotion

- Keep `session.top` only for bootstrap, reconnect, catch-up, buffer miss, and degraded recovery.
- Remove repeated page-level snapshot refresh as a steady-state dependency.
- Ensure degraded mode cannot silently re-promote snapshot or monitor authority.

### Phase 6 — Cleanup

- Remove conflicting legacy glue after authority cutover.
- Remove any fallback path that can recreate duplicate authority.
- Align architecture doc, handoff doc, and event log to the final ownership model.

### Phase 7 — Validation

- Prove runtime event → projector → reducer → UI consumer steady-state flow.
- Prove `session.top` is secondary bootstrap/catch-up/degraded transport only.
- Prove hydration-first / monitor-first / page-hook-first steady-state has been removed or demoted.
- Prove no duplicate authority, fallback promotion, partial migration hazard, or architecture drift remains.

## Validation

- Package docs use identical current-state / target-state / migration-path separation.
- Target architecture is consistently described as runtime events → server projector → app reducer → UI consumer.
- `tasks.md` uses the required ordered checklist: baseline freeze → event contract → projector → reducer cutover → snapshot demotion → cleanup → validation.
- `session.top` is described only as bootstrap/catch-up/degraded transport.
- Builder-facing instructions are concrete enough to begin implementation without redefining ownership.
- Stop gates explicitly block duplicate authority, fallback promotion, partial migration hazards, and architecture drift.
- Event-contract validation: builder can point to a concrete minimum event matrix before projector work starts.
- Projector validation: builder can point to a concrete minimum aggregate matrix before reducer work starts.
- Cutover validation: builder can point to an explicit forbidden-writer list after reducer cutover.
- Product validation: the plan explicitly preserves A111 prompt evidence and A112 round/session/compaction evidence goals.
- Completion validation: builder can show a single evidence table mapping architecture proof, product proof, and migration proof to concrete commands, fixtures, or runtime traces.

## Handoff

- Next builder reads this file first, then companion artifacts.
- Next builder treats current code as migration baseline only.
- Next builder prioritizes rewrite-to-target over preserve-current-shape.
- Next builder must stop instead of landing a partial cutover.
- Next builder must not begin projector implementation until the event matrix is explicit.
- Next builder must not begin reducer cutover until the projector aggregate matrix is explicit.
- Next builder must not declare completion until forbidden legacy writers are removed, replaced, or degraded-only by explicit cutover rule.