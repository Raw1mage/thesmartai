# Tasks

## 1. Durable Scheduler Contract
- [ ] 1.1 Define the MVP durable scheduler state contract for single-daemon restart recovery
- [ ] 1.2 Identify which existing cron state fields can be reused and which need extension
- [ ] 1.3 Record the fixed MVP missed-run policy: skip-to-next

## 2. Recovery And Reconciliation
- [ ] 2.1 Rewrite daemon-start reconciliation around durable scheduler semantics
- [ ] 2.2 Ensure create/update paths seed durable scheduler metadata immediately
- [ ] 2.3 Verify future slot ownership survives daemon restart

## 3. Execution Validation
- [ ] 3.1 Add targeted tests for restart recovery and missed-run skip-to-next behavior
- [ ] 3.2 Run runtime smoke validation for daemon restart -> future due run -> run log append
- [ ] 3.3 Record validation evidence and residual limitations

## 4. Documentation
- [ ] 4.1 Sync event logs with durable scheduler findings and decisions
- [ ] 4.2 Sync architecture docs if module/state boundaries materially change