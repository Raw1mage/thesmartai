# Proposal

## Why

- 目前 cron scheduler 只在 daemon 活著且 heartbeat 正常跑時有效；一旦 daemon 重啟、升級或 lifecycle 漏接，schedule 雖存在但 execution 可能完全停擺。
- 使用者明確要求：cron 不該依賴 system cron，而應由 app-native daemon 以持久化機制在每次重啟後 pickup 既定 schedule，持續守時執行。
- 現有設計僅有薄弱的 `nextRunAtMs` + polling；缺少 restart-safe scheduler contract。

## Original Requirement Wording (Baseline)

- "我是覺得不適合用system cron。而是daemon本身要有持久化機制，每次重啟都能pickup既定的schedule繼續守時執行"

## Requirement Revision History

- 2026-03-27: 從『cron 不準時 / 沒 execution log』debug，提升為 durable scheduler product/architecture plan
- 2026-03-27: 使用者決定 MVP 採「單 daemon durable MVP」+ missed-run policy 為「全部跳過」

## Effective Requirement Description

1. cron scheduler 必須是 app-native durable daemon capability，不依賴 system cron
2. daemon restart 後必須可從持久化 state 恢復並重新接手 schedule
3. MVP 階段 missed runs 一律 skip-to-next，不做 catch-up replay
4. 先解單 daemon restart-safe，再談未來 lease/claim / multi-daemon

## Scope

### IN

- durable scheduler persisted state contract
- daemon restart recovery / reconciliation
- skip-to-next missed-run policy
- 單 daemon restart-safe execution guarantee（分鐘級）

### OUT

- distributed lease / claim
- missed-run catch-up replay
- system cron integration
- 秒級精度保證

## Non-Goals

- 不把 cron 變成作業系統級 global scheduler
- 不在 MVP 解決 multi-instance dedupe
- 不在此輪重做 task manager UI

## Constraints

- 必須維持 app-native scheduler
- 不可新增 fallback 到 Linux system cron
- 必須以 persisted state + daemon lifecycle recovery 為核心，不靠 UI 補救

## What Changes

- cron state model 要從單一 `nextRunAtMs` 補強為可 restart-safe 的 scheduler contract
- daemon boot path 要執行 reconciliation，而非只做 best-effort register
- execution journal / state transition 要能說清楚哪些 slot 已處理、哪些被 skip

## Capabilities

### New Capabilities

- Restart-safe schedule recovery
- Durable skip-to-next missed-slot handling
- 更明確的 scheduler persistence / reconciliation contract

### Modified Capabilities

- cron daemon startup：從『啟動 heartbeat』升級為『reconcile state + 接手 schedule + 再開始 tick』
- cron state persistence：從弱 `nextRunAtMs` 提升為 durable scheduler state

## Impact

- packages/opencode cron runtime
- daemon startup lifecycle
- persisted cron job schema / state semantics
- tests, event logs, and architecture reasoning