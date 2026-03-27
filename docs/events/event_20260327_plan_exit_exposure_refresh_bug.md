# Event: plan_exit Exposure Refresh Bug

**Date**: 2026-03-27

## Requirement

使用者指出一個明顯 bug：`plan_enter` 有暴露且可用，但 `plan_exit` 在成功進入 plan mode 後仍不出現在 session 可用工具清單，造成 plan/build mode tool exposure 不對稱。

## Scope

### IN
- 釐清 `plan_enter` / `plan_exit` 為何在 session-visible tool list 上不對稱
- 修正 mode change 後 capability / available command refresh 缺口
- 確保 client 在切到 plan mode 後會看到新的 mode/capability 視圖

### OUT
- 不改 `plan.ts` 的 tool 定義
- 不改 tool registry 註冊邏輯
- 不改 agent permission policy 本身

## Task List

1. 建立 `plan_enter` 可用但 `plan_exit` 缺失的 baseline
2. 檢查 registry / agent permission / ACP mode refresh 鏈
3. 修正 mode change 後 client capability refresh
4. 驗證並同步 event / architecture

## Debug Checkpoints

### Baseline
- `packages/opencode/src/tool/plan.ts` 中存在 `PlanExitTool`
- `packages/opencode/src/tool/registry.ts` 已註冊 `PlanExitTool`
- `packages/opencode/src/agent/agent.ts` 中：
  - `build` allow `plan_enter`
  - `plan` allow `plan_exit`
- 實際行為卻是：可 `plan_enter`，但進入 plan mode 後仍看不到 `plan_exit`

### Instrumentation Plan
- 檢查 ACP 是否在 mode 變更後只更新內部 state，而沒有把新的 capability view 推給 client
- 比對 initial session load 與 mode switch 的 session update 路徑

### Execution
- 檢查 `packages/opencode/src/acp/agent.ts`
- 發現 ACP 會更新 `sessionManager.modeId`，但 mode 變更後沒有主動推送新的 `available_commands_update`
- client 因而停留在舊模式視角，看不到新 mode 對應的 commands/capabilities

### Root Cause
- 這不是 `plan_exit` 不存在，也不是 permission 未 allow。
- 真正缺口在 ACP refresh：**mode change 後，新的 session-visible capabilities 沒有被主動推回 client**。
- 結果就是：
  - 後端 mode 已切到 `plan`
  - 但 client 仍沿用舊的 `build` 可用 commands 視圖
  - 所以使用者看到 `plan_enter` 有，`plan_exit` 沒有

## Changes

- `packages/opencode/src/acp/agent.ts`
  - 新增 `pushAvailableCommandsUpdate()`，集中重算並推送 `available_commands_update`
  - `loadSessionMode()` 初始載入時，推送 update 時附帶 `currentModeId`
  - `setSessionMode()` 在 `sessionManager.setMode()` 後立即主動推送新的 `available_commands_update + currentModeId`
  - 讓 mode change 後 client 的 mode/capability 視圖與後端狀態同步

## Verification

- Code inspection shows:
  - mode change 後現在會主動推送新的 commands/capability update
  - initial session load 與 explicit mode switch 都會經過同一個集中更新 helper
- `bun x tsc -p packages/opencode/tsconfig.json --noEmit` ❌
  - repo 既有錯誤仍存在，無法作為本次變更失敗證據
- Side tests kept passing in same worktree:
  - `bun test packages/opencode/src/cron/heartbeat.test.ts` ✅
  - `bun test packages/opencode/src/cron/store.test.ts` ✅

## Key Decisions

1. 不改 tool 定義與 permission，因為那兩層本身是正確的。
2. 將問題定性為 ACP capability refresh 缺口，而不是 plan mode 邏輯錯誤。
3. 採最小修法：在 mode 變更點主動推送新的 session-visible command/capability 視圖。

## Architecture Sync

Architecture Sync: Verified (No doc changes)

Basis:
- 本次修復是既有 `session mode -> client capability view` 鏈路的同步補強。
- 未新增模組邊界或新的長期 ownership model。

## Remaining

- 建議補一個 integration test：`plan_enter` 後 client 應看到 `plan_exit`，避免未來 regression。
- 本次修復需 reload/restart runtime 後，再以實際 session 手動驗證 `plan_enter -> plan_exit` 對稱暴露。
