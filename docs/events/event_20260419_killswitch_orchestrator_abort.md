# Event: kill switch 無法停止 orchestrator

Date: 2026-04-19
Status: Done

## 需求

- 修復 kill switch 無法停止 orchestrator、造成 session 卡住無反應的問題。
- 補強 AGENTS 規範：agent 停下時必須交代後續建議。

## 範圍

### IN

- `packages/opencode/src/server/routes/killswitch.ts`
- `packages/opencode/src/server/killswitch/service.ts`
- `packages/opencode/src/tool/task.ts`
- 相關測試與驗證

### OUT

- 不擴充新的 kill switch product feature
- 不重寫 subagent lifecycle 架構

## 任務清單

- [x] 讀取 architecture 與既有 kill switch / stalled subagent event
- [x] 建立本次 event log
- [x] 定位 kill switch 無法停止 orchestrator 的根因
- [x] 實作最小安全修補
- [x] 補齊測試並驗證
- [x] Architecture sync 檢查與收尾

## Debug Checkpoints

### Baseline

- 使用者回報：kill switch 觸發後，orchestrator 沒有真正停下來，進入當機無反應狀態。

### Evidence Collected

- `packages/opencode/src/server/routes/session.ts` 的 `POST /:sessionID/abort` 與 `POST /abort-all` 除了 `SessionPrompt.cancel(...)`，還會額外呼叫 `terminateActiveChild(...)` / `terminateAllActiveWorkers()`。
- `packages/opencode/src/server/routes/killswitch.ts` trigger 路徑目前只透過 `KillSwitchService.publishControl(... action: "cancel")` 或 `forceKill()` 去做 `SessionPrompt.cancel(..., "killswitch")`。
- `packages/opencode/src/server/killswitch/service.ts` 的 `handleControl("cancel")` 與 `forceKill()` 都沒有終止 `SessionActiveChild` / worker process。
- `packages/opencode/src/tool/task.ts` 顯示 orchestrator 等待中的 subagent worker 需要 stdin cancel 或 process kill 才會真正解除等待。

### Working Hypothesis

- kill switch 目前只 abort parent prompt runtime，沒有同步終止 active child worker；因此 orchestrator 可能停在等待 subagent 結果的邊界，表面上像是「kill switch 無法停止 orchestrator」。

### Execution

- 補上 kill switch 對 active child / worker 的顯式終止。
- 新增或更新測試，覆蓋 kill switch control/force-kill 會同步清掉 child worker 的案例。
- 在 `packages/opencode/src/server/killswitch/service.ts` 新增 `cancelSessionExecution(sessionID)`，讓 `handleControl(cancel|pause)` 與 `forceKill()` 共同走同一條 stop 路徑：先 `SessionPrompt.cancel(..., "killswitch")`，再 `terminateActiveChild(sessionID)`。
- 在 `packages/opencode/src/server/killswitch/service.test.ts` 補上 unit tests，驗證 `handleControl("cancel")` 與 `forceKill()` 都會同步終止 active child。
- 同步更新 `AGENTS.md` 與 `templates/AGENTS.md`，要求 agent 在任何 stop boundary 都要說明停止原因與後續建議/恢復第一步。

### Validation

- `bun test packages/opencode/src/server/killswitch/service.test.ts packages/opencode/src/server/routes/killswitch.test.ts packages/opencode/src/server/routes/killswitch.e2e.test.ts` ✅
- `bun run --cwd packages/opencode typecheck` ⚠️ 失敗，但錯誤皆為 repo 既有跨模組型別問題；本次 kill-switch 變更未新增新的 type error surface。
- `AGENTS.md` / `templates/AGENTS.md` 條文已同步 ✅

### Architecture Sync

- Updated `specs/architecture.md`：補記 kill-switch stop path 必須同時 abort parent prompt 與 terminate active child worker，否則 orchestrator 可能卡在等待 subagent 結果的邊界。

## Process RCA: 錯誤宣稱「使用者插話」

### Symptom

- assistant 在被追問「為什麼停」時，錯誤宣稱是因為使用者插話造成中斷。

### Root Cause

- 真正停止點是 assistant 在前一輪把「orchestrator kill-switch 修補」誤判為已完整結案，於是直接輸出 completion summary。
- 之後使用者提出新的 `subagent kill switch` 症狀時，assistant 在解釋停止原因時只抓了局部對話狀態，錯把「新的使用者訊息」描述成「先前停止的原因」。
- 也就是說，問題不是 user interruption，而是 assistant 對 **停止原因** 與 **後續新需求** 兩個時間點混淆。

### Corrective Action

- 對外回覆停止原因時，必須區分：
  1. 上一輪真正停止的 trigger
  2. 當前這輪新收到的使用者訊息
- 已在 `AGENTS.md` / `templates/AGENTS.md` 補充 stop boundary 回覆規則，要求停下時除了原因，也要附後續建議/恢復第一步，降低錯誤結案與錯誤歸因。
