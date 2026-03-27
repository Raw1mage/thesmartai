# Event: Cron Tasks Not Running On Schedule

**Date**: 2026-03-27

## Requirement

使用者懷疑 task manager 中設定的 cron task 沒有按時執行，需要確認是 UI 顯示問題還是 scheduler 實際沒有準點跑，並在必要時修復。

## Scope

### IN
- 釐清 cron task 是否真的未按時執行
- 分析 heartbeat / scheduler / CronStore schedule seeding 路徑
- 做最小且正確的修復，使分鐘級 cron 更接近準點執行
- 補 targeted tests 與 event 記錄

### OUT
- 不重做成秒級精準 timer wheel / per-job timer scheduler
- 不重做 scheduled tasks UI
- 不引入 fallback 補跑機制來掩蓋排程缺陷

## Task List

1. 建立 cron scheduler debug baseline
2. 證明是 runtime scheduler 問題還是 UI 誤報
3. 修正 scheduler cadence 與 create/update seeding
4. 驗證並同步 event / architecture

## Debug Checkpoints

### Baseline
- 使用者觀察到 task manager 中設定的 cron task 疑似沒有按時執行
- 既有 scheduled tasks UI 事件已註記 runtime integration test 尚未完成

### Instrumentation Plan
- 對照 `heartbeat.ts`, `store.ts`, `schedule.ts`, `daemon/index.ts`, `scheduler/index.ts`
- 釐清 scheduler 是否為 true cron-time execution 還是 coarse polling
- 檢查 create/update 是否會立即 seed `nextRunAtMs`

### Execution
- 讀取 cron heartbeat、store、schedule、daemon init、session route 與既有 heartbeat tests
- 確認 `packages/opencode/src/cron/heartbeat.ts` 使用 `DEFAULT_INTERVAL_MS = 30 * 60 * 1000`
- 確認 `packages/opencode/src/scheduler/index.ts` 僅以 `setInterval()` 週期呼叫 tick
- 確認 `CronStore.create()` / `update()` 原先不會 eager seed `nextRunAtMs`
- 確認 `recoverSchedules()` 只在 daemon start 時補算 schedule metadata

### Root Cause
- 核心 scheduler 設計是 **30 分鐘 heartbeat 輪詢器**，不是依 cron 下一次觸發時間做分鐘級檢查。
- 因此 job 只會在 heartbeat tick 時被檢查，最差可晚 30 分鐘；這已足以解釋「沒按時執行」。
- 次要問題是新建/更新 job 不會立即補 `nextRunAtMs`，使首次執行更依賴下一個 heartbeat 或 daemon 重啟後 recovery。

## Changes

- `packages/opencode/src/cron/heartbeat.ts`
  - 將預設 scheduler cadence 從 30 分鐘改為 1 分鐘
- `packages/opencode/src/cron/store.ts`
  - 在 `create()` 時，若未提供 `state.nextRunAtMs`，立即依 `enabled/schedule/wakeMode` seed
  - 在 `update()` 時，若變更 `schedule/enabled/wakeMode` 且未顯式覆寫 `nextRunAtMs`，重新計算
- `packages/opencode/src/cron/store.test.ts`
  - 新增 create/update schedule seeding 測試
- `packages/opencode/src/cron/heartbeat.test.ts`
  - 新增 minute-level cadence 測試並修正 active-hours 測試輸入

## Verification

- `bun test packages/opencode/src/cron/store.test.ts` ✅
- `bun test packages/opencode/src/cron/heartbeat.test.ts` ✅

Observed evidence:
- `CronStore > seeds immediate nextRunAtMs for wakeMode now` ✅
- `CronStore > recomputes nextRunAtMs when schedule changes` ✅
- `Heartbeat helpers > registers minute-level default cadence` ✅

## Key Decisions

1. 採最小且架構一致的修法：保留 heartbeat polling 模型，但把 cadence 提升到分鐘級。
2. 不直接升級為 per-job exact timer，因為那會擴大 scheduler 架構變更範圍。
3. 不允許靠 UI 或 run-history 補救來掩蓋 scheduler 準點性缺陷。

## Architecture Sync

Architecture Sync: Verified (No doc changes)

Basis:
- 本次只是在既有 cron heartbeat/schedule model 內調整 cadence 與 seeding 行為。
- 未新增新的模組邊界、持久化 schema 或控制流 ownership。

## Remaining

- 建議後續做 live daemon/runtime smoke test：建立 job → 檢查 `nextRunAtMs` → 觀察 run log timing
- 目前仍屬分鐘級 polling，不是秒級 scheduler；若未來要支援更精準粒度，需另開 architecture slice
