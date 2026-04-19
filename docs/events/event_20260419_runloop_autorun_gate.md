# Event: runloop autorun gate

## Requirement

- 使用者要求不要只忽略對話中的 `Continuation Gate`，而是直接修改 runloop 程式。
- 後續進一步澄清：不只是未 armed 時不要注入該 prompt，而是要把 feed 給 AI 的 `Continuation Gate` 硬編碼 prompt 取消，讓 AI 在正常工作流中自行決定 todolist；runloop 不應硬編碼要求它「更新 todolist」。

## Scope

### IN

- 將 runloop 從 always-on continuation pump 改為尊重 session autonomous policy
- 停止在一般對話 turn 自動 force-enable autorun
- 停用 autorun 時清除已排隊的 continuation
- 移除 armed runloop 對 `Continuation Gate` / completion-verify 更新 todo 提示的依賴
- 補上對應 unit test

### OUT

- 不實作完整 `autorun_armed` / spec binding lifecycle
- 不改寫 plan-builder promote hooks
- 不處理與本次變更無關的既有 TypeScript / test 基線問題

## Tasks

- [x] 1. 讀取 architecture / existing events / workflow-runner 與 prompt 入口
- [x] 2. 將 runloop continuation gate 改為以 `workflow.autonomous.enabled` 為準
- [x] 3. 調整 session route，停用時清 queue、啟用時才 enqueue continuation
- [x] 4. 更新單測並驗證核心 runloop 行為
- [x] 5. 同步 architecture 文件與本 event

## Debug Checkpoints

### Baseline

- 觀察到 `packages/opencode/src/session/prompt/runner.txt` 的 `Continuation Gate` 會在沒有 active plan / todo 的一般對話情境仍被送入 synthetic user message。
- 程式證據顯示 `packages/opencode/src/session/workflow-runner.ts`、`packages/opencode/src/session/prompt.ts`、`packages/opencode/src/server/routes/session.ts` 都把 autonomous continuation 視為 always-on。

### Instrumentation Plan

- 讀取 `specs/architecture.md`、`docs/events/event_20260323_build_mode_refactoring.md`、`docs/events/event_20260328_plan_exit_rca.md`
- 精讀 `packages/opencode/src/session/workflow-runner.ts`、`packages/opencode/src/session/prompt.ts`、`packages/opencode/src/server/routes/session.ts`
- 以 `workflow-runner.test.ts` 做 focused regression

### Execution

- `Session.defaultWorkflow()` 的 `workflow.autonomous.enabled` 預設值改為 `false`
- `planAutonomousNextAction(...)` 新增 `not_armed` stop reason，未啟用 autorun 時不再產生 `Continuation Gate`
- `shouldInterruptAutonomousRun(...)` 與 pending continuation resumability 加入 disabled guard
- `prompt.ts` 移除每輪 turn 對 autorun 的 force-enable
- `/session/:sessionID/autonomous` 改為尊重 `body.enabled`，停用時清掉 pending continuation，且只有 enabled 時才 enqueue synthetic continuation
- `workflow-runner.ts` 移除 `runner.txt` 載入、移除 `completion_verify` 這條「update the todolist」硬編碼路徑；沒有 actionable todo 時直接 `todo_complete` stop
- armed continuation 改成最小 resume 訊號：`Continue with the current work based on the existing session context.`，不再把 runloop policy 寫成 prompt contract 餵給 AI
- 後續 cleanup：刪除已失效的 `packages/opencode/src/session/prompt/runner.txt` artifact，避免未來被誤接回 runtime 路徑

### Root Cause

- runloop 實作層原本有兩層耦合問題：
  1. 把 autonomous continuation 視為 always-on，實際 pump gate 不在 runtime，而落到 LLM prompt 的 `Continuation Gate` 自我判斷。
  2. 即使 armed 之後，仍靠 `runner.txt` 與 `completion_verify` 這類硬編碼 prompt，要求 AI「update the todolist」來驅動 stop/continue。
- 結果是 runloop 把本該屬於 AI 正常工作決策的內容硬塞成 synthetic prompt contract，讓 prompt injection 看起來像 runtime authority。

## Key Decisions

- 本次先採最小可驗證修補：直接使用現有 `session.workflow.autonomous.enabled` 作為 runtime gate，而不是在這一刀同時導入完整 spec-bound `autorun_armed` 新基礎設施。
- 停用 autorun 要 fail-fast 地清掉既有 queue，避免舊 continuation 殘留再度觸發 injection。
- armed continuation 保留最小 resume 訊號，但移除 `Continuation Gate` 與 `completion_verify` 這類把 todo 管理規則硬編碼進 prompt 的做法；沒有 actionable todo 就直接停。

## Verification

- `bun test "packages/opencode/src/session/workflow-runner.test.ts"` ✅ 26 pass / 0 fail
- `bun test "packages/opencode/test/session/planner-reactivation.test.ts"` ⚠️ 失敗，原因為既有基線問題：找不到 `../../src/session/planner-layout`，與本次 runloop 變更無直接關聯
- `bun x tsc -p tsconfig.json --noEmit` ⚠️ 失敗，原因為既有 `templates/skills/plan-builder/scripts/plan-rollback-refactor.ts` parse errors，與本次變更無直接關聯

## Files

- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/server/routes/session.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- `packages/opencode/src/session/prompt/runner.txt` (deleted)
- `specs/architecture.md`
- `specs/autonomous-opt-in/design.md`
- `specs/autonomous-opt-in/proposal.md`

## Remaining

- 若要完全落實 `specs/autonomous-opt-in/`，後續仍需補上 session-spec binding、explicit arm trigger、plan refill/disarm lifecycle。

## Architecture Sync

- Updated: `specs/architecture.md` 已補充 runloop 改為 policy-gated pumping、`/session/:sessionID/autonomous` 成為 explicit runtime switch，且 autonomous continuation 不再依賴 `Continuation Gate` / completion-verify prompt contract，而改由最小 resume 訊號 + 現有 todo 狀態自然驅動。
