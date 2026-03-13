# Event: webapp crash investigation

Date: 2026-03-13
Status: In Progress

## 需求

- 調查 webapp crash 原因。
- 建立可追溯 RCA 與驗證證據，避免只靠 symptom 猜測。

## 範圍 (IN / OUT)

### IN

- webapp 啟動 / 載入 / runtime crash 相關前後端邊界
- `packages/app/**` 與必要的 `packages/opencode/**` web runtime 路徑
- 必要的 runtime / browser / build 證據蒐集

### OUT

- 本輪先以調查與根因定位為主；未確認根因前不做大範圍修補
- 不主動新增 fallback mechanism

## 任務清單

- [x] 讀取 Architecture 與相關 webapp 歷史事件，建立基線
- [ ] 建立本輪 crash baseline / reproduction path
- [ ] 搜尋 crash 相關邊界與近期高風險變更
- [ ] 重現 crash 並蒐集 console / network / server evidence
- [ ] 收斂 root cause 與影響範圍
- [ ] 記錄 validation 與 Architecture Sync 結論

## Debug Checkpoints

### Baseline

- 已先閱讀 `docs/ARCHITECTURE.md` 與近期 webapp 事件。
- 已知最近 webapp 高風險區域包含：workspace bootstrap/sync、session scroll ownership、web runtime routing、browser-safe workspace utilities。
- 已知歷史 startup crash 包含：
  - `current()[0]` child tuple 未就緒
  - browser bundle 誤用 Node-only API（如 `node:path` / `Buffer`）
- 使用者後續澄清：本案不是 landing/login page 啟動即 crash，而是發生在 `codex-cli dev` root session 中，當 main agent 委派 subagent 後，subagent 先失去回應，接著整個 web runtime 看起來 offline，需手動自 backend terminal 重啟 web 才恢復。
- 目前 smoke check 未重現 generic webapp startup/login crash；`./webctl.sh status` 也顯示 dev runtime 健康，故 fault domain 已由前端 entry/bootstrap 轉向 autonomous runner / delegated subagent lifecycle / backend runtime hang。

### Instrumentation Plan

- 優先從 component boundary 拆查：
  1. 啟動入口 / route bootstrap
  2. sync/workspace context
  3. session page 與主要 provider/context
  4. browser console / pageerror / failed request
  5. server runtime log / build errors
- 先 search 再 read，之後以可重現證據驗證 root cause。

### Execution

- 已確認 `codex-cli dev` root session：`ses_3254eeeffffe8bIuv4FLFJj2sK`
- root session `workflow.state` 目前仍為 `running`，不是 `waiting_user` / `blocked`。
- 多個 child sessions 已存在，且其 `workflow.state` 為 `waiting_user`，表示 delegated subagent lineage 確實存在。
- 已讀取最近一次 delegated Slice 2 task part：
  - coding subagent task part `prt_ce6249817001mcIWbZVV2H6wQP`
  - 狀態為 `error`
  - 明確錯誤：`Subagent execution timed out after 600 seconds`
- 同批 testing subagent task part `prt_ce6249bf0001ZIywy4uOAeLKAM` 已 `completed`。
- 父 session 對應 todo 仍保留：
  - `full7` status = `in_progress`
  - `action.waitingOn = "subagent"`
- 程式碼證據：
  - `packages/opencode/src/tool/task.ts`
    - timeout 時會 `SessionPrompt.cancel(session.id)` 並丟出 `Subagent execution timed out after 600 seconds`
    - catch path 會呼叫 `Todo.reconcileProgress(... taskStatus: "error")`
  - `packages/opencode/src/session/todo.ts`
    - `reconcileProgress(... taskStatus: "error")` 不會把 linked todo 改成 error/completed
    - 反而會保留或設成 `status: in_progress`
    - 並保留/補上 `action.waitingOn = "subagent"`
  - `packages/opencode/src/session/workflow-runner.ts`
    - `detectStructuredStopReason()` 只要 actionable todo 有 `waitingOn === "subagent"` 就直接回 `wait_subagent`
    - `countActiveSubtasks()` 只計算 tool part `pending/running`，不計 `error`
- 綜合上列可見：subagent 已 timeout/error，但父 todo 仍被保留為「等待 subagent」，導致 autonomous runner 邏輯持續把 root session 視為應該 `wait_subagent` 的狀態來源。

### Root Cause

- 初步 root cause 已大幅收斂：
  - 這不是單純 web startup crash。
  - 更像是 delegated subagent timeout 後，父 session 的 todo / workflow 收斂失敗。
  - 具體表現為：subagent tool part 已 `error`，但 linked todo 仍停在 `in_progress + waitingOn=subagent`，使 autonomous runner 後續決策長期卡在 `wait_subagent` 語義。
- 尚待補最後一跳證據：此錯誤狀態如何影響 web runtime 對 session 狀態訂閱、以及為何在使用者觀感上會演變成整體 web offline / backend 需重啟。

### Validation

- 已驗證：目前 generic web landing/login smoke 無 crash 證據。
- 已驗證：recent delegated coding subagent 確有 600s timeout 實證，不是純推測。
- 已驗證：todo reconcile 與 workflow stop-reason 實作之間存在狀態不一致風險（subagent 已 error，但 todo 仍等待 subagent）。
