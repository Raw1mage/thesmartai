# Observability — compaction-redesign

## Events

Runtime events emitted via the event bus. Declare here before code emits them.

- `compaction.started` — emitted at the entry of `SessionCompaction.run` after
  cooldown check passes
  - **Payload**: `{ sessionID: string, observed: string, step: number, intent: "default" | "rich" }`
  - **Emitter**: `SessionCompaction.run`
  - **Consumers**: UI toast, audit log

- `compaction.kind_attempted` — emitted each time the chain walker tries a
  kind (whether it succeeds or falls through)
  - **Payload**: `{ sessionID: string, observed: string, kind: string, available: boolean, succeeded: boolean }`
  - **Emitter**: `SessionCompaction.run` chain-walk loop
  - **Consumers**: debug log, metrics (kind-success-rate)

- `compaction.completed` — emitted after Anchor write + markCompacted finishes
  - **Payload**: `{ sessionID: string, observed: string, kind: string, anchorMessageId: string, durationMs: number }`
  - **Emitter**: `SessionCompaction.run`
  - **Consumers**: UI toast (success state), audit log, analytics

- `compaction.throttled` — emitted when cooldown blocks execution
  - **Payload**: `{ sessionID: string, observed: string, currentRound: number, lastCompactedRound: number, threshold: number }`
  - **Emitter**: `SessionCompaction.run` cooldown check
  - **Consumers**: debug log only (not user-visible)

- `memory.turn_summary_appended` — emitted after `Memory.appendTurnSummary`
  persists
  - **Payload**: `{ sessionID: string, turnIndex: number, textLength: number }`
  - **Emitter**: `Memory.appendTurnSummary`
  - **Consumers**: debug log; potential UI live-update of session memory view

- `memory.legacy_fallback_read` — emitted when `Memory.read` falls back to
  legacy SharedContext / checkpoint
  - **Payload**: `{ sessionID: string, legacySource: "shared-context" | "checkpoint" | "both" }`
  - **Emitter**: `Memory.read`
  - **Consumers**: migration progress dashboard (count of un-migrated
    sessions remaining)

## Metrics

Numeric measurements collected for dashboards / alerts.

- `compaction.kind_distribution` — counter labelled by `kind`
  - **Type**: counter
  - **Labels**: `kind ∈ {narrative, schema, replay-tail, low-cost-server, llm-agent}`, `observed`
  - **Dashboard**: compaction-overview
  - **Goal**: narrative + schema + replay-tail (free) ≥ 80% of total after
    full deployment

- `compaction.duration_ms` — histogram of `run()` total wall-clock duration
  - **Type**: histogram
  - **Labels**: `kind`, `observed`
  - **Dashboard**: compaction-overview
  - **Goal**: narrative kind p99 < 100ms; LLM agent kind p99 may exceed 30s

- `compaction.api_calls_per_run` — counter of API calls invoked during a
  single `run()` (only kinds 4-5 produce non-zero values)
  - **Type**: counter
  - **Labels**: `kind`, `observed`
  - **Dashboard**: compaction-overview, codex-quota-burn
  - **Goal**: zero for `manual` observed when narrative path is available

- `compaction.cooldown_skipped_count` — counter of `compaction.throttled`
  events
  - **Type**: counter
  - **Labels**: `observed`
  - **Dashboard**: compaction-overview

- `memory.turn_summary_count` — gauge of `Memory.turnSummaries.length` per
  active session
  - **Type**: gauge
  - **Labels**: `sessionID` (sampled)
  - **Dashboard**: per-session debug view

- `memory.legacy_fallback_rate` — counter of `memory.legacy_fallback_read`
  events
  - **Type**: counter
  - **Dashboard**: migration progress
  - **Goal**: trends toward zero as sessions are touched and migrated

## Logs

Structured log lines. Declare key fields so logging conventions are mechanical.

- Log level usage:
  - `error`: storage write failures, malformed legacy data after fallback
    fails too
  - `warn`: deprecated shim invoked, kind chain exhausted, plugin hook
    failure with successful fallback
  - `info`: kind chain transitions (every fail-loud step per AGENTS.md rule
    1), `run` entry/exit, manual `/compact` accepted
  - `debug`: cooldown decisions, individual executor steps

- Required structured fields on every compaction-related log line:
  - `service: "session.compaction" | "session.memory"`
  - `sessionID`
  - `observed` (when within `run`)
  - `kind` (when within an executor)
  - `step` (runloop round counter)

## Alerts

- **compaction-llm-agent-spike** — fires when `compaction.kind_distribution{kind="llm-agent"}`
  rate exceeds 20% of total compactions over 1 hour
  - **Implies**: narrative + free fallbacks are failing more than expected;
    investigate Memory population, budget threshold, or plugin hook health

- **memory-legacy-fallback-not-trending-down** — fires when
  `memory.legacy_fallback_rate` does not decrease over 7 days post-deploy
  - **Implies**: migration is stuck; some code path may be regenerating
    legacy data instead of consuming new

- **compaction-api-burn-on-manual** — fires when
  `compaction.api_calls_per_run{observed="manual"}` mean > 0 over 1 hour
  - **Implies**: R-2 acceptance is being violated — manual `/compact` is
    burning quota when it shouldn't

## Manual smoke checkpoints

Each phase boundary in `tasks.md` should manually capture:

- `compaction.kind_distribution` snapshot before/after — narrative %
  should grow as phases land
- `compaction.api_calls_per_run` for manual observed — should drop to 0
  after phase 6 cuts over manual `/compact` to `run()`
