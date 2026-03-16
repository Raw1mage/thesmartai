## Goal

建立 kill-switch phase-1 的「執行契約版」規格：以 runtime 真實路徑（`packages/opencode/**`）收斂後端控制平面與測試驗證，確保可授權觸發、可阻擋新排程、可觀測 ACK/fallback 與可審計。

## Scope

- IN (milestone-1):
  - `/api/v2/admin/kill-switch/*` 後端路由契約（status/trigger/cancel/task control）
  - `KillSwitchService`（state/audit/idempotency/cooldown/mfa/ack/fallback）
  - session scheduling gate（`message`/`prompt_async` -> `409 KILL_SWITCH_ACTIVE`）
  - auth-bound operator gate + capability gate `kill_switch.trigger`（deny-by-default）
  - 後端測試與 typecheck
- OUT (deferred):
  - Web Admin UI
  - TUI 控制入口
  - Redis/MinIO 強綁定部署（改為 adapter phase）

## Assumptions

- `RequestUser` 與 `WebAuth` 已可提供 request-level operator 身份邊界。
- global config permission 可由 `Config.getGlobal().permission` 取得並用 `PermissionNext` 評估。
- runtime 已有 `Storage` 可持久化 kill-switch state/audit/snapshot placeholder。

## Stop Gates

- 若 capability policy 非 `allow`，kill-switch 操作必須 fail-fast（403）；不得新增隱式 fallback。
- 若測試矩陣（route/service/session-gate）或 typecheck 未過，不得宣告里程碑完成。
- 若新實作切片未在 `tasks.md` 命名，不得進入 build execution。

## Critical Files

- specs/20260316_kill-switch/implementation-spec.md (this file)
- specs/20260316_kill-switch/spec.md
- specs/20260316_kill-switch/design.md
- specs/20260316_kill-switch/tasks.md
- specs/20260316_kill-switch/control-protocol.md
- specs/20260316_kill-switch/rbac-hooks.md
- specs/20260316_kill-switch/snapshot-orchestration.md
- packages/opencode/src/server/app.ts
- packages/opencode/src/server/routes/killswitch.ts
- packages/opencode/src/server/killswitch/service.ts
- packages/opencode/src/server/routes/session.ts
- packages/opencode/src/server/routes/killswitch.test.ts
- packages/opencode/src/server/routes/session.killswitch-gate.test.ts
- packages/opencode/src/server/killswitch/service.test.ts

## Structured Execution Phases

Phase A — Planner convergence (done)

- Rewrite all companion artifacts to runtime truth.

Phase B — Backend control-plane convergence (done)

- Runtime route/service integration + session scheduling gate + ACK/fallback behavior.

Phase C — Security hardening (done)

- auth-bound operator gate + capability `kill_switch.trigger` deny-by-default + MFA challenge/verify path.

Phase D — Validation convergence (done)

- route/service/session-gate tests green + package typecheck green.

Phase E — Ops closure (done)

- `finalize-deploy-policy-doc`
- `build-runbook`

Artifacts:

- `docs/policies/kill-switch-deployment-policy.md`
- `docs/runbooks/kill-switch-incident-runbook.md`

Phase F — Deferred phase-2 (completed in this execution round)

- Redis control adapter
- MinIO snapshot adapter
- Web/TUI operator UI

Artifacts:

- `packages/opencode/src/server/killswitch/service.ts` (control transport + snapshot backend adapters)
- `packages/opencode/src/server/killswitch/service.test.ts` (adapter fail-fast tests)
- `packages/opencode/src/cli/cmd/killswitch.ts` + `packages/opencode/test/cli/killswitch.test.ts`
- `packages/app/src/components/settings-general.tsx`
- `packages/app/src/components/settings-kill-switch.ts`
- `packages/app/src/components/settings-kill-switch.test.ts`

## Validation

- Acceptance criteria:
  1. authorized & capability-allowed trigger returns `request_id` (+ snapshot_url placeholder)
  2. unauthorized/unauthenticated/capability-denied request fail-fast with explicit error
  3. kill-switch active blocks scheduling endpoints with `409 KILL_SWITCH_ACTIVE`
  4. ack rejected/timeout leads to forceKill fallback and auditable failure path

- Required evidence:
  - `bun test packages/opencode/src/server/routes/killswitch.test.ts packages/opencode/src/server/routes/session.killswitch-gate.test.ts packages/opencode/src/server/killswitch/service.test.ts`
  - `bun run typecheck` (workdir `packages/opencode`)

## Handoff

- Use `tasks.md` canonical names for runtime todo materialization.
- Build mode should execute pending milestone-1 tasks first (`finalize-deploy-policy-doc`, `build-runbook`).
- Any new implementation slice must be added back to spec/tasks before coding.
- After confirming this plan package, switch via `plan_exit`.
