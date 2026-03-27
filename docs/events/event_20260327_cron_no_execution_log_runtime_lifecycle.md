# Event: Cron No Execution Log — Runtime Lifecycle Wiring

**Date**: 2026-03-27

## Requirement

使用者補充：問題不只是 cron 可能晚執行，而是「連晚 30 分鐘後都完全沒有執行紀錄」。需要釐清為什麼 scheduled task 根本沒有 run log / execution log。

## Scope

### IN
- 釐清 cron run log 完全為空的上游根因
- 檢查真實 web/daemon `serve --unix-socket` 啟動鏈是否有啟動 cron lifecycle
- 修正 runtime lifecycle wiring，讓 heartbeat/recovery 在真實 daemon 啟動
- 保留前一輪已完成的 cadence + seeding 修復

### OUT
- 不重做 scheduler 架構
- 不重做 run log UI
- 不引入 fallback 補寫 run log

## Task List

1. 建立『完全沒有執行紀錄』與『只是晚執行』之差異 baseline
2. 對照 daemon lifecycle 與真實 serve path
3. 修正 serve/unix-socket runtime 啟動時未啟動 cron lifecycle 的問題
4. 驗證並同步 event / architecture

## Debug Checkpoints

### Baseline
- 前一輪已確認 cron cadence 原本太粗（30 分鐘 heartbeat）
- 但使用者補充指出：不是單純晚，而是完全沒有任何 execution/run log
- `RunLog` 與 UI route 本身看起來讀寫的是同一個固定路徑

### Instrumentation Plan
- 檢查 `daemon/index.ts` 中 lifecycle `Daemon.start()` 的職責
- 檢查 `cli/cmd/serve.ts -> server/server.ts` 的真實 daemon 啟動路徑
- 確認 run log 是否因 heartbeat 永遠沒啟動而完全不產生

### Execution
- 確認 `packages/opencode/src/daemon/index.ts:41-82` 的 `Daemon.start()` 會執行：
  - `Heartbeat.recoverSchedules()`
  - `Heartbeat.register()`
- 確認真實 web runtime 路徑是：
  - `packages/opencode/src/cli/cmd/serve.ts`
  - `packages/opencode/src/server/server.ts: listenUnix()`
- 發現該路徑只做 `Bun.serve()`、discovery file、cleanup，但**沒有呼叫 lifecycle `Daemon.start()`**
- 因此 heartbeat scheduler 根本沒有註冊，不會 tick，也不會 append run log

### Root Cause
- `scheduled tasks` UI/route 實作已存在，但真實 per-user daemon 的 `serve --unix-socket` 啟動路徑沒有接上 lifecycle daemon。
- `Heartbeat.register()` 只在 lifecycle `Daemon.start()` 內被呼叫；若 `serve` path 繞過它，cron subsystem 就永遠不會自動運作。
- 這能直接解釋：
  1. 完全沒有 run log
  2. 即使等待超過原本 30 分鐘也沒有自動執行

## Changes

- `packages/opencode/src/server/server.ts`
  - 將 discovery helper `./daemon` 與 lifecycle manager `../daemon` 分開命名：
    - `RuntimeDaemon` = lifecycle manager
    - `DiscoveryDaemon` = discovery/pid helper
  - 在 `listenUnix()` 的 single-instance guard 後呼叫 `RuntimeDaemon.start()`
  - 若 lifecycle 啟動失敗則 fail fast
  - discovery file 改用 `DiscoveryDaemon.writeDiscovery()`
  - `server.stop()` 先做 `RuntimeDaemon.shutdown()` + `DiscoveryDaemon.removeDiscovery()`
  - 移除原本額外 `SIGTERM`/`SIGINT` cleanup + `process.exit()` 路徑，避免與 lifecycle signal handlers 重疊
  - 保留 `process.once("exit")` 做 discovery best-effort 清理

- Related existing working-tree fixes retained:
  - `packages/opencode/src/cron/heartbeat.ts`
  - `packages/opencode/src/cron/store.ts`
  - `packages/opencode/src/cron/heartbeat.test.ts`
  - `packages/opencode/src/cron/store.test.ts`

## Verification

- `bun test packages/opencode/src/cron/heartbeat.test.ts` ✅
- `bun test packages/opencode/src/cron/store.test.ts` ✅

Code evidence:
- `packages/opencode/src/server/server.ts` 現在會在 `listenUnix()` 中啟動 `RuntimeDaemon.start()`
- `server.stop()` 現在會走 lifecycle shutdown
- `RunLog` 讀寫路徑保持不變，問題不在 log store 本身，而在 heartbeat 根本沒起來

## Key Decisions

1. 不把 lifecycle start 掛在 helper `server/daemon.ts`，因為它是 discovery/spawn helper，不是 runtime lifecycle authority。
2. 把 lifecycle wiring 掛在 `Server.listenUnix()`，因為這是實際 per-user daemon 的啟動邊界。
3. fail fast：若 runtime daemon lifecycle 啟動失敗，不允許靜默啟動一個沒有 cron subsystem 的 web daemon。

## Architecture Sync

Architecture Sync: Verified (No doc changes)

Basis:
- 既有 architecture 已將 cron retention + heartbeat scheduler 視為 daemon lifecycle 一部分。
- 本次修復只是讓真實 serve path 對齊既有 architecture authority，沒有新增新的 ownership boundary。

## Remaining

- 需要重啟 web/daemon runtime，做 live smoke test：
  1. 啟動 daemon
  2. 建立/等待一個 due job
  3. 確認 `~/.config/opencode/cron/runs/*.jsonl` 出現 run log
  4. 確認 `/system/tasks` execution log 會更新
- 後續可補一個 `Server.listenUnix()` lifecycle wiring integration test，避免 regression
