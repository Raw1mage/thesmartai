# Design

## Context

- Current cron runtime is app-native and persists jobs under `~/.config/opencode/cron/jobs.json`.
- Recent debugging found two concrete failures:
  1. heartbeat cadence was too coarse (30m)
  2. real `serve --unix-socket` path originally failed to start lifecycle daemon, so heartbeat never ran
- Even after these fixes, current scheduler semantics are still thin: it polls persisted jobs and tracks `nextRunAtMs`, but does not yet model restart-safe schedule ownership as a first-class durable contract.

## Goals / Non-Goals

**Goals:**
- Define a durable single-daemon scheduler MVP
- Make restart recovery explicit and testable
- Persist enough state to reconcile next future slot after restart
- Keep missed-run policy simple: skip-to-next

**Non-Goals:**
- Multi-daemon lease or leader election
- Replay/catch-up of missed slots
- Replacing app-native scheduler with OS cron

## Decisions

- MVP remains single-daemon only; no distributed lease/claim in this slice.
- Missed-run policy is fixed to skip-to-next, matching user decision.
- Reconciliation on daemon start becomes a first-class control step, not an incidental helper.
- Persisted scheduler state must move beyond 'best effort nextRunAtMs' thinking toward 'slot reconciliation state'.
- Existing heartbeat polling may remain as execution cadence, but correctness must come from reconciliation + persisted state, not mere uptime continuity.

## Data / State / Control Flow

- Job create/update writes durable scheduler metadata to CronStore.
- Daemon start loads persisted jobs, reconciles each job against current wall time and policy, then seeds future execution state.
- Heartbeat tick only evaluates future due jobs already reconciled into durable scheduler state.
- Job execution appends run log and advances scheduler state to the next future slot.
- Restart path repeats reconciliation without replaying offline missed windows.

## Risks / Trade-offs

- Keeping skip-to-next may surprise users expecting catch-up -> mitigation: document policy clearly in product/UI later.
- Using only `nextRunAtMs` may still be too weak for future multi-daemon work -> mitigation: design MVP state to be extensible toward claim/slot semantics.
- If daemon restart occurs near a due boundary, minute-level cadence may still introduce small delay -> accepted for MVP.

## Critical Files

- packages/opencode/src/cron/types.ts
- packages/opencode/src/cron/store.ts
- packages/opencode/src/cron/heartbeat.ts
- packages/opencode/src/cron/schedule.ts
- packages/opencode/src/daemon/index.ts
- packages/opencode/src/server/server.ts
- packages/opencode/src/cron/run-log.ts