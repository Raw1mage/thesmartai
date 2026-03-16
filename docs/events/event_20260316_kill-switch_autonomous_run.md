Event: autonomous run - kill-switch A/B/C hardening (dev fallback mode)

Date: 2026-03-16

Context

- User requested autonomous progression with auto-answered decisions.
- Runtime choices: Redis persistence, MinIO snapshots, MFA enabled now, local commits only.
- Later approved dev fallback mode (no hard dependency on Redis/MinIO at runtime for local demo).

Actions completed in this run

- Added/updated Redis-backed control channel + audit integration:
  - src/server/control/control_channel.ts
  - src/server/services/redis_client.ts (dev in-memory fallback)
  - src/server/services/audit_service.ts
- Added MFA request-scoped storage and verification:
  - src/server/services/mfa_service.ts
- Added kill-switch state persistence API:
  - src/server/services/kill_switch_state.ts
- Added route hardening and feature endpoints:
  - src/server/routes/admin/kill_switch.ts
    - POST /trigger (RBAC + cooldown + MFA + snapshot + state write + ACK timeout fallback forceKill)
    - POST /cancel
    - POST /tasks/:id/control
    - GET /status
- Added worker control handler + forceKill prototype:
  - src/server/worker/worker_control_handler.ts
  - src/server/worker/worker_manager.ts
- Added middleware:
  - src/server/middleware/rbac_middleware.ts
  - src/server/middleware/cooldown_middleware.ts
- Added executable pseudo-code demo and manual checks:
  - scripts/executable_pseudocode_demo.cjs
  - test/manual_check_control.cjs

Debug checkpoints

- Baseline: duplicate questioning and non-observable dynamic execution in previous rounds.
- Instrumentation:
  - route flow audit events added for trigger/cancel/task-control/rbac/cooldown.
  - control channel audit events for publish/ack/timeout and pending key cleanup.
- Root causes found:
  1. one-shot subagent orchestration without explicit iterative validation loop
  2. ESM/CJS mismatch in manual scripts under package "type": "module"
  3. missing production hooks (cancel/task-control/forceKill/cooldown)
- Fixes applied:
  - Converted demo/manual scripts to .cjs or dynamic imports compatible with module mode.
  - Added missing routes and fallback kill path.

Validation status

- Local static validation: files present, route flow completed, manual script paths fixed.
- Pending final dynamic validation:
  - run test/manual_check_control.cjs (DONE)
  - run scripts/executable_pseudocode_demo.cjs (DONE)
  - run delegated review agent for spec conformance (DONE; tool-side artifact access limitation noted)

Additional fixes after first review feedback

- Implemented idempotency window for trigger request_id generation:
  - src/server/services/kill_switch_state.ts#getOrCreateIdempotentRequestId
- Updated /status response shape to spec fields (active, initiator, initiated_at, mode, scope, ttl, snapshot_url):
  - src/server/routes/admin/kill_switch.ts
- Added ACK status rejection handling (ack.status !== accepted => forceKill + error response):
  - src/server/routes/admin/kill_switch.ts
- Added snapshot failure audit path:
  - src/server/services/snapshot_service.ts
  - src/server/routes/admin/kill_switch.ts (catch around createSnapshot)
- Added soft-pause guard middleware artifact for scheduler integration:
  - src/server/middleware/kill_switch_guard.ts

Known verification caveat

- review subagent in the last run reported 'inconclusive_no_artifact_access' due to tool-mode restrictions, not implementation absence.

Architecture sync

- Impacted boundaries: server control-channel, admin route surface, worker control lifecycle.
- Architecture Sync: Verified (No doc changes) after real-runtime migration validation.

Major architecture correction (destructive update approved)

- Removed non-runtime prototype tree under `/src/server/**` and migrated kill-switch implementation into actual runtime path:
  - `packages/opencode/src/server/killswitch/service.ts`
  - `packages/opencode/src/server/routes/killswitch.ts`
  - route mounted in `packages/opencode/src/server/app.ts` as `/api/v2/admin/kill-switch/*`
- Added scheduling gate integration in real session entrypoints:
  - `packages/opencode/src/server/routes/session.ts`
  - blocks new `/message` and `/prompt_async` with HTTP 409 when kill-switch active.

Notes

- This replaces prototype-only stubs with runtime-integrated product path.
- Force-kill currently maps to `SessionPrompt.cancel(sessionID)` in this runtime, with audit persistence in storage.

Final validation (runtime path)

- `bun test packages/opencode/src/server/killswitch/service.test.ts`: PASS (2/2)
- `bun run typecheck` (workdir `packages/opencode`): PASS
- Root fix in this pass:
  - Replaced invalid `KillSwitchService.ControlAction` / `KillSwitchService.Ack` schema references in route layer with local zod schemas to avoid namespace runtime access mismatch.

Integration test expansion (this pass)

- Added route integration tests:
  - `packages/opencode/src/server/routes/killswitch.test.ts`
    - `/status` inactive response
    - `/trigger` MFA challenge flow
    - `/trigger` ACK rejected/timeout -> forceKill fallback
    - RBAC forbidden path
    - `/tasks/:sessionID/control` rejected ACK path
    - `/cancel` state clear path
  - `packages/opencode/src/server/routes/session.killswitch-gate.test.ts`
    - `POST /:sessionID/message` returns `409 KILL_SWITCH_ACTIVE` when kill-switch active
    - `POST /:sessionID/prompt_async` returns `409 KILL_SWITCH_ACTIVE` when kill-switch active
- Validation:
  - `bun test packages/opencode/src/server/routes/killswitch.test.ts packages/opencode/src/server/routes/session.killswitch-gate.test.ts packages/opencode/src/server/killswitch/service.test.ts`: PASS (10/10)
  - `bun run typecheck` (workdir `packages/opencode`): PASS

Auth hardening (this pass)

- Replaced kill-switch route RBAC header gate (`x-user-role`) with runtime auth-bound operator gate:
  - file: `packages/opencode/src/server/routes/killswitch.ts`
  - behavior:
    - if web auth disabled: allow (local/dev compatibility)
    - if web auth enabled and request user missing: `401 auth_required`
    - if web auth enabled and request user != configured operator username: `403 forbidden` (`operator_mismatch`)
- Updated route tests to reflect auth-bound behavior:
  - file: `packages/opencode/src/server/routes/killswitch.test.ts`
  - added/updated cases:
    - operator auth enabled + missing request user -> 401
    - operator mismatch -> 403
    - removed dependency on `x-user-role` header
- Validation:
  - `bun test packages/opencode/src/server/routes/killswitch.test.ts packages/opencode/src/server/routes/session.killswitch-gate.test.ts packages/opencode/src/server/killswitch/service.test.ts`: PASS (11/11)
  - `bun run typecheck` (workdir `packages/opencode`): PASS

Capability gate hardening (this pass)

- Added explicit capability policy gate for kill-switch operations:
  - file: `packages/opencode/src/server/routes/killswitch.ts`
  - contract: `permission = "kill_switch.trigger"`
  - source: `Config.getGlobal().permission` via `PermissionNext.fromConfig(...)` + `PermissionNext.evaluate(...)`
  - fail-fast: non-allow (`ask`/`deny`) returns `403 forbidden` with `reason = capability_denied`
- Kept existing auth-bound operator gate as first boundary, then capability gate.
- Updated tests:
  - file: `packages/opencode/src/server/routes/killswitch.test.ts`
  - added case: capability denied (`kill_switch.trigger=deny`) -> 403 capability_denied
- Validation:
  - `bun test packages/opencode/src/server/routes/killswitch.test.ts packages/opencode/src/server/routes/session.killswitch-gate.test.ts packages/opencode/src/server/killswitch/service.test.ts`: PASS (12/12)
  - `bun run typecheck` (workdir `packages/opencode`): PASS

Planner-first consolidation (plan mode)

- User decision: stop iterative slice-by-slice prompting; build a full follow-up plan/spec package before further implementation.
- Rewrote companion artifacts to runtime-authoritative paths and phase-based execution contract:
  - `specs/20260316_kill-switch/proposal.md`
  - `specs/20260316_kill-switch/spec.md`
  - `specs/20260316_kill-switch/design.md`
  - `specs/20260316_kill-switch/implementation-spec.md`
  - `specs/20260316_kill-switch/tasks.md`
  - `specs/20260316_kill-switch/handoff.md`
  - `specs/20260316_kill-switch/control-protocol.md`
  - `specs/20260316_kill-switch/rbac-hooks.md`
  - `specs/20260316_kill-switch/snapshot-orchestration.md`
  - `specs/20260316_kill-switch/mapping.md`
- Planning decisions locked in:
  - Milestone-1 scope: backend + tests convergence first
  - Infra strategy: Storage-first + adapterized Redis/MinIO in phase-2
  - Capability policy: `kill_switch.trigger` deny-by-default, deployment must explicitly allow
- Execution transition: complete plan package, then switch to build mode

Build mode — ops closure deliverables

- Completed `finalize-deploy-policy-doc`:
  - `docs/policies/kill-switch-deployment-policy.md`
  - includes deny-by-default capability policy, rollout checklist, prohibited patterns, verification commands
- Completed `build-runbook`:
  - `docs/runbooks/kill-switch-incident-runbook.md`
  - includes incident flow, triage matrix, evidence checklist, post-incident validation, and postmortem template
- Synced planner artifacts:
  - `specs/20260316_kill-switch/tasks.md` updated milestone-1 items 7/8 to done
  - `specs/20260316_kill-switch/implementation-spec.md` phase E marked done with artifact links

Architecture sync

- Architecture Sync: Verified (No doc changes) for this build slice; only ops/policy/runbook docs and spec/task status updates were added.

Delegation-first milestone-2 completion

- Subagent-delivered implementations integrated and verified:
  1. Control transport adapterization (default local + explicit redis fail-fast)
  2. Snapshot backend adapterization (default local + explicit minio/s3 fail-fast)
  3. Web UI operator surface (Settings Runtime kill-switch controls, MFA challenge flow)
  4. CLI/TUI-accessible operator command (`opencode killswitch` status/trigger/cancel)

Key files added/updated in this round

- `packages/opencode/src/server/killswitch/service.ts`
- `packages/opencode/src/server/killswitch/service.test.ts`
- `packages/opencode/src/cli/cmd/killswitch.ts`
- `packages/opencode/test/cli/killswitch.test.ts`
- `packages/app/src/components/settings-general.tsx`
- `packages/app/src/components/settings-kill-switch.ts`
- `packages/app/src/components/settings-kill-switch.test.ts`
- `packages/opencode/src/index.ts` (registered new command)

Validation evidence (main-agent recheck)

- `bun test packages/opencode/src/server/killswitch/service.test.ts packages/opencode/src/server/routes/killswitch.test.ts packages/opencode/src/server/routes/session.killswitch-gate.test.ts packages/opencode/test/cli/killswitch.test.ts`: PASS (17/17)
- `bun test --preload ./happydom.ts ./src/components/settings-kill-switch.test.ts` (workdir `packages/app`): PASS (2/2)
- `bun run typecheck` (workdir `packages/opencode`): PASS
- `bun run typecheck` (workdir `packages/app`): PASS

Architecture sync

- Architecture Sync: Verified (No doc changes) for this round; behavior-level additions were covered by specs/tasks/event updates.
