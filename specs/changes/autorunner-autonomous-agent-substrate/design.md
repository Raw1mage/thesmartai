# Design

## Context

- 目前 `workflow-runner.ts` 的 continuation decision 主要依賴：
  - actionable todo
  - `activeSubtasks` 計數
  - pending approvals / questions
  - workflow metadata
- `task.ts` 在 delegated subagent 成功時會呼叫 `Todo.reconcileProgress(... taskStatus: "completed")`，失敗時則呼叫 `Todo.reconcileProgress(... taskStatus: "error")`。
- `Todo.reconcileProgress(... taskStatus: "error")` 目前會把 linked todo 保持或推成 `waitingOn=subagent`，這對「subagent 還在跑」與「subagent 已 error/timeout 但 parent 未收斂」兩種情況缺少辨識能力。
- `ProcessSupervisor` 目前是最接近 process truth 的 runtime 來源，但只保留 in-memory 狀態，沒有持久化 event journal。
- 目前存在待驗證方向：runner 可能演進為 24x7 背景 daemon；若該方向成立，TUI / Web 應被視為 attachable control/observation surfaces，而不是 execution ownership 邊界。
- 從現有程式入口來看，repo 已存在 `serve`/`web` server entry、`attach <url>` TUI attach 路徑、以及 `/tui` server routes；這表示系統已具有「server + attachable access surface」的雛形，但尚未證明它已是完整 daemon-owned multi-access truth。
- 使用者已明確給出第一個 runner 實例：runner 應能讀取本 repo `/specs` 中已完整編譯並批准的開發計畫，然後代替人類去委派各種 coding agents 持續執行。

## Goals / Non-Goals

**Goals:**

- 先建立最小 runtime event journal substrate。
- 先讓 runner 的 execution authority 明確綁定到「已批准的 OpenSpec compiled plan」。
- 先把 `wait_subagent` stale mismatch 轉成顯式 anomaly evidence。
- 保持實作切片小到可測試、可回歸、可在 autorunner branch 逐步演進。
- 所有第一階段 substrate 決策應盡量避免阻斷未來 daemon/multi-access 方向，但是否正式承諾該方向，需待可行性分析後再決定。

**Non-Goals:**

- 本輪不直接完成 reducer/daemon/lease 全重構。
- 本輪不把全部 workflow state 改為真正 event-sourced architecture。
- 本輪不對 cms branch 直接施作。

## Decisions

1. **先做 journal baseline，再做 reducer**
   - 因為現在最大的缺口是沒有統一可追溯 evidence path。
2. **runner 第一個產品實例鎖定 `/specs` 開發計畫執行**
   - 這比抽象 daemon 願景更具體，也能直接驗證 runner 是否真的成為 approved-plan execution owner。
3. **第一個底層異常切片鎖定 `wait_subagent` mismatch**
   - 這是已有硬 evidence、且最能代表 worker truth / todo truth 分裂的痛點。
4. **最小 event service 應落在 runtime substrate 層**
   - 建議新增 `packages/opencode/src/system/runtime-event-service.ts` 或等價模組。
5. **anomaly detection 先掛在 workflow evaluation path**
   - 因為 `workflow-runner.ts` 是目前 autonomous continuation 最接近 canonical decision 的位置。
6. **將 TUI/Web 定位為 attachable surfaces，而非 runtime owner**
   - 這是候選長期方向；是否採納需以可行性分析結果為準。
7. **把 multi-access server 視為 daemon 的前導階段**
   - 目前僅作為分析假說：若同一個 opencode server runtime 能同時服務 TUI attach 與 Web access，這可視為 daemon architecture 的早期里程碑；但前提是 execution truth 必須共享，而不是只有 transport 共享。

## Risks / Trade-offs

- 若 journal schema 設計過大，會把第一個切片做成半套 daemon architecture，風險過高。
- 若 anomaly 偵測只寫在 UI/monitor 層，仍然無法成為後續 reducer 的基底。
- 若直接修改 todo reconcile semantics 而沒有先記錄 evidence，可能把現有症狀隱藏掉而不是真正收斂。

## Critical Files

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/tool/task.ts`
- `packages/opencode/src/session/todo.ts`
- `packages/opencode/src/process/supervisor.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- `packages/opencode/src/session/todo.test.ts`
- `packages/opencode/src/storage/storage.ts`

## Proposed First Slice Shape

### Runner execution contract baseline

- runner 僅能從已批准的 OpenSpec compiled plan 啟動 execution
- `/specs` 開發計畫是第一個 supported mission contract
- plan 需可編譯成：
  - goal
  - structured tasks / dependencies
  - stop gates
  - validation
  - delegation hints

### New runtime module

- `packages/opencode/src/system/runtime-event-service.ts`
  - append event
  - list recent events by session
  - fixed minimal schema

### First anomaly contract

- code: `unreconciled_wait_subagent`
- trigger shape:
  - actionable todo still has `waitingOn=subagent` or workflow stop reason is `wait_subagent`
  - but no active subtask / no active process truth supports it
  - and a linked subagent failure/error signal exists or can be derived from current runtime facts

### Integration point

- `workflow-runner.ts`
  - evaluate / plan step 時附帶 anomaly detection
  - 先記 event，再決定 stop/degrade behavior

### First product-visible execution use case

- session runner 載入 `/specs` 裡已批准的開發計畫
- 將 plan tasks 轉成 runner-managed execution queue
- 依角色委派 coding/testing/docs/review 類 agents
- 將完成/等待/錯誤狀態回流到 session runner truth

## Long-Term Target Topology Alignment

- 最終 topology 仍以 `docs/specs/autorunner_daemon_architecture.md` 為準：
  - session 是 daemon-owned actor/job
  - prompt loop 降級為 execution adapter
  - TUI/Web 只負責 attach / observe / control
- 本次 first slice 的價值在於先建立 detached UI 也能讀回的 background event evidence substrate，避免 attach surface 消失時系統真相一併消失。
- 現況判讀：
  - `Server.listen(...)` 已提供常駐 server 能力
  - `attach <url>` 已提供 TUI 連到既有 server 的能力
  - `web` / `serve` 命令已提供 Web/server access 能力
  - 因此架構上已接近「multi-access server 雛形」
  - 但是否已達成「同一個 runtime 在 TUI 與 Web 同時使用下仍維持單一 execution truth」仍需進一步驗證

## Validation Strategy

- 單元測試先覆蓋 event schema 與 anomaly detection。
- targeted regression test 驗證 `wait_subagent` mismatch 不再只是靜默維持舊 stopReason，而是會留下可查 evidence。
