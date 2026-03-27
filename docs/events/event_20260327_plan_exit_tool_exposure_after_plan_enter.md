# Event: plan_exit Tool Exposure After plan_enter

**Date**: 2026-03-27

## Requirement

使用者發現 `plan.ts` 原始碼中明明存在 `plan_exit`，但在實際對話中成功執行 `plan_enter` 後，外部工具清單仍沒有暴露 `plan_exit`，需要查明為何 plan mode 沒有拿到對應工具。

## Scope

### IN
- 釐清 `plan_enter` 後 session mode / tool exposure 鏈是否正確刷新
- 修正 `plan` mode 成功切換後 `plan_exit` 未暴露的問題
- 補最小必要驗證與事件紀錄

### OUT
- 不重做 planner artifact 系統
- 不重做 tool registry 註冊機制
- 不重做 build/plan agent permission model

## Task List

1. 建立 `plan_exit` 存在但未暴露的 debug baseline
2. 檢查 agent permission、tool registry、session mode 切換鏈
3. 修正 mode 切換後 ACP 工具暴露不同步
4. 驗證並同步 event / architecture

## Debug Checkpoints

### Baseline
- `packages/opencode/src/tool/plan.ts` 內存在 `PlanExitTool`
- `packages/opencode/src/tool/registry.ts` 已在 `app|cli|desktop|web` client 下註冊 `PlanExitTool`
- `packages/opencode/src/agent/agent.ts` 中 `plan` agent allow `plan_exit`，`build` agent deny `plan_exit`
- 實際 session 已成功 `plan_enter` 並建立 `/plans/20260327_cron-manager-debug-web-cron-task-list-task/`
- 但外部可見工具清單仍無 `plan_exit`

### Instrumentation Plan
- 檢查 `plan_enter` 成功後 session 的 active mode 是否實際切到 `plan`
- 檢查 ACP/session manager 是否根據 user message 的 `agent` 欄位更新 mode
- 比對 tool registry 正常、但 mode 沒切時會否仍沿用 build permission 產生工具清單

### Execution
- 讀取 `tool/plan.ts`, `tool/registry.ts`, `agent/agent.ts`, `session/prompt.ts`
- 確認 registry 與 permission 都沒壞
- 發現 ACP 在 `processMessage()` 中只處理 assistant/user message parts 與 tool updates，但原先不會在收到 user message 時同步 `message.info.agent` 到 session mode
- 補上：當收到 user message 且帶有合法 `agent` 時，將 session mode 更新為該 agent id

### Root Cause
- `plan_enter` 會建立新的 user message，並在該訊息上標記 `agent: "plan"`（之後 `plan_exit` 會反向切回 `build`）。
- 但 ACP 的 `processMessage()` 在收到此 user message 時，**沒有把 `message.info.agent` 寫回 session manager mode**。
- 結果是 session 雖然在資料層已進 plan mode，ACP/tool exposure 仍沿用舊的 build mode 權限視角，因此對外工具清單缺少 `plan_exit`。

## Changes

- `packages/opencode/src/acp/agent.ts`
  - 在 `processMessage()` 中，若收到 user message 且帶有合法 `agent`，同步呼叫 `sessionManager.setMode(sessionId, nextModeId)`
  - 使 `plan_enter` / `plan_exit` 所依賴的 mode-sensitive tool exposure 能隨訊息切換正確刷新

## Verification

- `bun test packages/opencode/src/bus/subscribers/task-worker-continuation.test.ts` ✅
- `bun test packages/app/src/context/global-sync/event-reducer.test.ts` ✅
- Code inspection:
  - `packages/opencode/src/tool/plan.ts:1075` 定義 `PlanExitTool`
  - `packages/opencode/src/tool/registry.ts:141` 註冊 `PlanExitTool`
  - `packages/opencode/src/agent/agent.ts:113` `plan` agent allow `plan_exit`
  - `packages/opencode/src/acp/agent.ts:698-705` 現在會把 user message 的 agent 寫回 session mode

## Key Decisions

1. 不改 registry / permission 設定，因為它們本身正確。
2. 將問題定性為 **session mode 與 ACP tool exposure 的同步漏接**。
3. 採最小修復：在既有 message processing 路徑中補 mode sync，而不是新增額外 fallback refresh。

## Architecture Sync

Architecture Sync: Verified (No doc changes)

Basis:
- 本次修復沒有新增模組邊界或新的資料流，只是讓既有 `message.info.agent -> session mode -> tool exposure` 鏈路恢復一致。
- `specs/architecture.md` 既有對 plan/build mode 與 control surface 的描述仍成立。

## Remaining

- 建議後續補一個直接覆蓋「`plan_enter` 後 `plan_exit` 應出現在可用工具中」的 ACP/integration 測試，避免 mode-sync regression。
