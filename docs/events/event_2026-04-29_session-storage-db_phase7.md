# Event: session-storage-db Phase 7 observability

## Scope

- Spec: `specs/session-storage-db`
- Phase: 7 — Observability events, metrics, logs, and admin corruption surface.
- In scope: storage Bus event alignment, ActivityBeacon-backed metrics, structured logs, and a persistent session-page corruption banner.
- Out of scope: live daemon smoke tests, Grafana exporter wiring, and production data mutation.

## Changes

- Confirmed storage Bus payloads in `packages/opencode/src/session/storage/events.ts` align with `observability.md` for corruption, migration lifecycle, migration failure, and legacy debris cleanup.
- Added `packages/opencode/src/session/storage/metrics.ts` as a thin ActivityBeacon-backed storage metrics adapter.
- Added metric emissions for session open timing, integrity-check timing, migration counters/durations/stage timings, connection-pool size/capacity, legacy pending count, corruption, and legacy debris cleanup.
- Normalized storage structured log names for integrity failure, schema migration, pool acquire/evict, migration lifecycle, and debris handling.
- Added a session-page `session.storage.corrupted` listener that shows a persistent error toast and in-page banner with `opencode session-inspect check <sid>` recovery copy.

## Validation

- `bun test "./packages/opencode/src/session/storage/dreaming.test.ts"` — 7 pass, 0 fail.
- `bun test "./packages/opencode/src/session/storage/router.test.ts"` — 13 pass, 0 fail.
- `bun test "./packages/opencode/src/cli/cmd/session-inspect.test.ts"` — 4 pass, 0 fail.
- Initial parallel execution of those three tests timed out because the fixtures share the same storage root; sequential rerun passed.
- `bun run typecheck` in `packages/app` failed on pre-existing `packages/ui/src/components/session-review.tsx` `FileDiff.before/after` errors.
- `bun run typecheck` in `packages/opencode` failed on pre-existing provider/CLI/TUI/session type errors unrelated to Phase 7 changes.
- Live daemon restart/smoke test: not run; explicitly out of scope.
- Browser/admin UI smoke test: not run; live app launch is out of scope.

## Issues

- No dedicated histogram/Grafana exporter abstraction exists in the repo. Metrics are emitted through the existing `ActivityBeacon` counter/gauge channel instead of introducing a parallel telemetry system.
- The UI affordance is copy-first (`opencode session-inspect check <sid>`) because no existing admin API invokes CLI diagnostics directly.
