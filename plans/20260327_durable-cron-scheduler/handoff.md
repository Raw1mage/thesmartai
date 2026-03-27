# Handoff

## Execution Contract
- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding
- Preserve MVP boundary: single-daemon durable scheduler only
- Preserve product decision: missed runs are skipped, not replayed

## Required Reads
- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md
- docs/events/event_20260327_cron_not_running_on_schedule.md
- docs/events/event_20260327_cron_no_execution_log_runtime_lifecycle.md

## Current State
- Coarse cadence and missing lifecycle wiring have already been identified and patched in working tree.
- What remains is a proper durable scheduler contract so cron does not depend on continuous daemon uptime semantics alone.
- This plan is a new architecture-sensitive slice and should not overwrite the earlier child-session plan package.

## Stop Gates In Force
- Stop if implementation drifts into multi-daemon lease/claim design
- Stop if product changes missed-run policy away from skip-to-next
- Stop if persistence changes require migration strategy beyond the current MVP assumption

## Build Entry Recommendation
- Start by formalizing scheduler state semantics in `cron/types.ts` / `cron/store.ts`, then align daemon-start reconciliation in `cron/heartbeat.ts` and `daemon/index.ts`.

## Execution-Ready Checklist
- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md