# Scheduler Channels Specs

Canonical feature root for scheduler durability and future channel-oriented runtime scheduling.

## Current State Summary

This root currently contains two different layers of truth:

1. **Implemented durable scheduler baseline**
   - Persisted cron job state in `CronStore`
   - Boot recovery via `Heartbeat.recoverSchedules()`
   - Stale recurring jobs skip to next future fire time
   - Stale one-shot jobs disable on boot expiry
   - Minute-level heartbeat cadence
   - `Server.listenUnix()` lifecycle wiring required so live daemon execution actually produces run evidence

2. **Planned channel-oriented runtime extensions**
   - Channel isolation
   - Per-channel lane allocation
   - Channel-scoped kill-switch
   - Channel-aware daemon health reporting

## How to Read This Root

- Treat root `spec.md` / `proposal.md` as a mixed package: the scheduler durability parts describe current-state behavior, while channel sections remain planned architecture.
- Treat `slices/20260327_plan-enter-plans-20260327-durable-cron-scheduler/` plus `packages/opencode/src/cron/heartbeat.ts`, `packages/opencode/src/server/server.ts`, and `specs/architecture.md` as the current durable scheduler truth.
- Do not assume channel isolation described here is already implemented just because the durable scheduler baseline is complete.
