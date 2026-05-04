# Event: Durable Cron Scheduler Plan Consolidation

**Date**: 2026-03-27
**Plan**: `/home/pkcs12/projects/opencode/plans/20260327_plan-enter-plans-20260327-durable-cron-scheduler/`

## Requirement

使用者要求進入 `durable-cron-scheduler` 的 plan mode。經 clarification 後，確認本次不是重寫全新的 durable scheduler spec，而是收斂現況：把既有 scheduler durability 修復、相關 architecture、與 2026-03-27 cron debug evidence 統整成單一 active plan。

## Scope

### IN
- 盤點 durable cron scheduler 的既有基線
- 將近期 cron runtime 修復納入 active plan
- 明確規劃剩餘 hardening / validation slices

### OUT
- 不重寫 channel / lane / kill-switch 的完整 scheduler-channels spec
- 不進入 code implementation
- 不新增 fallback scheduling behavior

## Planning Checkpoints

### Baseline
- `specs/_archive/scheduler-channels/` 已存在完整 durability + channel 規劃，且多數 task 已標記完成。
- `docs/events/event_20260327_cron_not_running_on_schedule.md` 已證明分鐘級 heartbeat 與 create/update seeding 是重要基線。
- `docs/events/event_20260327_cron_no_execution_log_runtime_lifecycle.md` 已證明真實 `serve --unix-socket` 路徑若未啟動 lifecycle，會導致完全沒有 run log。

### Decision
- 本 plan 定位採「收斂現況」。
- `scheduler-channels` 視為歷史/架構脈絡來源；本次 active plan 只聚焦 durable cron scheduler 的 current-state contract 與剩餘 hardening。

### Output
- 已填寫本次 plan 的 implementation-spec / proposal / spec / design / tasks / handoff。
- 已補齊 IDEF0 / GRAFCET / C4 / Sequence artifacts，反映 consolidation → validation → documentation sync 的流程。
- build 階段已完成 `plan_exit` beta admission branch authority 修復，避免舊流程每次強制覆寫 `implementationBranch` 為 slug-derived 預設值。
- build 階段已補上 `Server.listenUnix()` lifecycle wiring regression coverage，並完成 live cron smoke validation。

## Validation

- Planner artifacts 已從模板狀態改為具體內容。
- `bun test "/home/pkcs12/projects/opencode/packages/opencode/src/tool/plan.test.ts"` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/opencode/src/session/mission-consumption.test.ts"` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/opencode/src/server/server.test.ts"` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/opencode/src/cron/heartbeat.test.ts"` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/opencode/src/cron/store.test.ts"` ✅
- live smoke validation ✅
  - daemon socket: `/run/user/1000/opencode/daemon.sock`
  - smoke job id: `34462463-e764-438d-8447-e414871b7a17`
  - run id: `3b5510d5-cbb0-4ef0-93d3-58fe4fa2d41c`
  - run history status: `ok`
  - summary: `HEARTBEAT_OK`
  - JSONL evidence path: `/home/pkcs12/.config/opencode/cron/runs/34462463-e764-438d-8447-e414871b7a17.jsonl`
- Environment note: `./webctl.sh dev-start` attempted to touch `/etc/opencode` and hit read-only filesystem, but the already-running approved daemon was healthy and produced the required execution evidence.

## Architecture Sync

Architecture Sync: Updated

Basis:
- 本次不只完成 planning 收斂，還修正了 `plan_exit` beta admission 對 `implementationBranch` 的 authority/correction flow，因此 planner runtime contract 已有實質行為變更，需要同步到 architecture SSOT。
