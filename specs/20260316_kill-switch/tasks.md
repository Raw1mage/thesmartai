# Tasks for Kill-switch Implementation (phase-1 canonical)

## Milestone-1: Backend + tests convergence

1. `rewrite-spec-bundle` (planner) — **done**
   - proposal/spec/design/implementation-spec/tasks/handoff/control-protocol/rbac-hooks/snapshot-orchestration/mapping 對齊 runtime 現況

2. `integrate-runtime-routes` (backend) — **done**
   - kill-switch route mount in `packages/opencode/src/server/app.ts`
   - runtime routes/service moved to `packages/opencode/src/server/**`

3. `enforce-scheduling-gate` (backend) — **done**
   - block new scheduling in session message/prompt_async when kill-switch active

4. `harden-auth-gate` (backend/security) — **done**
   - replace header role with auth-bound operator gate

5. `harden-capability-gate` (backend/security) — **done**
   - explicit capability `kill_switch.trigger`, deny-by-default

6. `validate-killswitch-test-matrix` (qa/backend) — **done**
   - route/service/session-gate tests pass + typecheck pass

7. `finalize-deploy-policy-doc` (ops/security) — **done**
   - document required global config permission (`kill_switch.trigger = allow`) and rollout checklist
   - output: `docs/policies/kill-switch-deployment-policy.md`

8. `build-runbook` (ops) — **done**
   - incident runbook + postmortem template for trigger/cancel/fallback handling
   - output: `docs/runbooks/kill-switch-incident-runbook.md`

## Milestone-2: Deferred adapters and UI

9. `adapterize-control-transport` (infra/backend) — done
   - Redis/NATS transport adapter with same seq/ACK contract
   - output: adapterized selection in `packages/opencode/src/server/killswitch/service.ts`
   - default: `local`, explicit `redis` mode fail-fast without required config

10. `adapterize-snapshot-backend` (infra/ops) — done
    - MinIO/S3 upload adapter + signed URL policy
    - output: backend selection in `packages/opencode/src/server/killswitch/service.ts`
    - default: `local`, explicit `minio|s3` mode fail-fast without required config

11. `web-admin-killswitch-ui` (frontend) — done
    - output: `packages/app/src/components/settings-general.tsx` + helper/test files

12. `tui-killswitch-control` (tui) — done
    - output: `packages/opencode/src/cli/cmd/killswitch.ts` + CLI tests

## Dependency order

- milestone-1: `1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8`
- milestone-2: `9 -> 10 -> 11,12`

## Validation-oriented closure gates

- Gate-A: backend tests + typecheck green
- Gate-B: deploy policy documented and reviewed
- Gate-C: runbook completed and linked in events
