# Event: subagent worker process exited unexpectedly RCA

Date: 2026-03-14
Status: In Progress

## 需求

- 對 `subagent worker process exited unexpectedly` 做 RCA。
- 找出真正故障層級（task orchestration / worker process / model provider / tool runtime / session state）。
- 釐清是否可穩定重現。
- 給出最小修復方案與回歸驗證方案。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/opencode/**`
- `/home/pkcs12/.local/share/opencode/log/debug.log`
- `/home/pkcs12/projects/opencode/docs/events/**`
- 必要時 `docs/ARCHITECTURE.md` sync 檢查

### OUT

- 未經證據支持的 worker lifecycle 大改
- 新增 fallback mechanism
- 無關 subagent / task / worker 的功能修改

## 任務清單

- [x] 讀 architecture / 既有 event / runtime 相關文件
- [x] 搜尋 subagent / task / worker / unexpected exit 相關程式與事件
- [x] 建立 syslog-style checkpoints
- [x] 以真實 debug log 樣本定位故障層級
- [x] 提出並實作最小 observability 修復
- [ ] 補跑驗證並判定是否需要進一步根因修復
- [ ] Architecture sync 檢查

## Debug Checkpoints

### Baseline

- 使用者看到錯誤字串：`subagent worker process exited unexpectedly`。
- 需先區分這是否只是父層包裝錯誤，還是真正根因訊息。
- 既有已知事件：`event_20260309_subagent_worker_busy_block.md` 已修過 `worker_busy` race，但與本案的 `unexpected exit` 不是同一類。

### Instrumentation Plan

- 先定位錯誤字串來源與 worker lifecycle：
  - `packages/opencode/src/tool/task.ts`
  - `packages/opencode/src/cli/cmd/session.ts`
  - `packages/opencode/src/process/supervisor.ts`
- 讀 `debug.log` 找真實失敗樣本，檢查：
  - 是否有 `worker_assigned / worker_dispatched / first_bridge_event / done / error`
  - 子 session 是否真的開始執行
  - provider/model 是否正常開始與持續成功
  - 最後消失在什麼 component boundary
- 若父層證據不足，最小修復優先補 observability，而不是先猜根因。

### Execution

#### 1. 錯誤字串來源判定

- `packages/opencode/src/tool/task.ts:415` 在 worker 子程序 stdout bridge 結束後，若 `worker.current` 仍存在，直接回傳：
  - `new Error("worker process exited unexpectedly")`
- 結論：這句話是 **task orchestration 父層的泛化包裝錯誤**，不是根因本身。

#### 2. 啟動失敗 / 中途崩潰分流

- `subagent 啟動失敗`：會落在 `subagent worker failed to become ready`，不是本案字串。
- `worker_busy`：已由 2026-03-09 race fix 處理，訊號不同。
- 本案樣本（debug.log 2026-03-14 15:24:09）顯示：
  - task telemetry timeline 有 `worker_assigned` 與 `worker_dispatched`
  - 沒有 `first_bridge_event`
  - 執行約 `242675ms` 後才結束
  - 最終出現 `task.worker.removed` + `worker process exited unexpectedly`
- 初步結論：這不是啟動前失敗，而是 **worker 中途退出**。

#### 3. 真實失敗樣本還原

- 對應 sub session：`ses_314c886bdffeKne0ELPUZt74KL`
- 在同一時間窗內，debug log 明確顯示：
  - subagent 已成功執行多輪 LLM request
  - provider/account identity 正常 pinned 在 `openai / gpt-5.3-codex / openai-subscription-yeatsluo-gmail-com`
  - 多次 `glob / grep / read / apply_patch` 成功完成
- 因此可排除：
  - subagent 啟動失敗
  - provider/model 在一開始就無法工作
  - 單純 task dispatch queue 問題

#### 4. 最後可見邊界

- 最後穩定可見訊號停在：
  - `session.prompt step 9`
  - `tool.resolve start`
  - `tool.registry tools: all / filtered`
  - 大量 `permission evaluate(permission="skill", pattern="...")`
- 之後沒有：
  - worker `done`
  - worker 顯式 `error`
  - task timeout 訊號
  - session-level structured fatal 訊號
- 隨後直接看到 worker 被移除。

### Root Cause

#### 已證實層級判定

1. **不是主要根因：task orchestration**
   - orchestration 層只是把子程序消失包成泛化錯誤。
   - 這一層的問題是 **diagnostics 不足**，不是本次退出的原始 cause。

2. **目前最接近的真正故障層級：worker process 內部 / tool runtime / skill-loading path**
   - worker 已經跑了多輪正常流程後才消失。
   - 最後可見邊界在 `tool.resolve -> ToolRegistry -> permission(skill)` 附近。
   - 比較像子程序內部未捕捉 fatal / hard exit / runtime crash，而不是 provider 正常報錯。

3. **目前沒有證據支持是 provider/model 導致退出**
   - 同一 sub session 內多輪 OpenAI 請求與工具執行皆成功。
   - 若是 provider 層正常錯誤，理論上應看到 `done(ok:false)` 或 assistant/session error，而不是子程序直接消失。

4. **目前沒有證據支持是 session state mismatch 主導**
   - session execution identity、account pin、provider selection 均正常。
   - 未看到 `blocked cross-provider/cross-account` 或 session identity drift 訊號。

#### 目前真正根因狀態

- **完整 root cause 尚未被最終證明**。
- 可證實的是：
  - 真正故障不是字串本身，而是 worker process 在執行中直接消失。
  - 消失前最後邊界落在 tool registry / skill permission evaluate 附近。
- 缺失 evidence：
  - worker exit code 當下未被帶回 task error
  - worker stderr 未被 task 層保留
  - 最後一個 worker control message 未被持久化
- 因此本輪先做最小 observability 修復，避免再次無法分辨是：
  - worker internal fatal
  - parent shutdown/dispose
  - stderr-visible crash
  - 某個特定 skill/tool init 導致 process 退出

### Validation

#### 本輪最小修復

- 檔案：`packages/opencode/src/tool/task.ts`
- 變更：
  - worker stderr 從 `inherit` 改為 `pipe` 並轉發到 parent stderr，同時保留最近 stderr 摘要
  - 記錄 worker `lastPhase` / `lastWorkerMessage` / `lastStderr`
  - 在 unexpected exit 時新增 `debugCheckpoint("task.worker", "worker_exit_unexpected", ...)`
  - 將 `exitCode / lastPhase / lastWorkerMessage / stderr tail` 帶回錯誤訊息
- 目的：
  - 不改既有控制流
  - 不新增 fallback
  - 僅補齊 RCA 所需證據

#### 待執行驗證

- `bun run --cwd packages/opencode typecheck`
- 若可行，重現一次 subagent worker crash 路徑，確認錯誤訊息與 debug log 會帶出：
  - `exitCode`
  - `lastPhase`
  - `lastWorkerMessage`
  - `stderr`

## 結論（目前版）

- **故障真正層級（目前證據）**：`worker process / tool runtime boundary`
- **不是主要根因**：`task orchestration`（它只是錯誤包裝層）
- **暫無證據支持**：`model provider`、`session state` 為主因
- **可否穩定重現**：
  - 目前只有 1 筆真實樣本，尚不足以宣稱「穩定重現」
  - 但失敗樣本具體且可定位到最後邊界
- **最小修復方案**：先補 worker exit observability（已實作）
- **下一步**：用新 diagnostics 再跑一次重現，才能把 root cause 從「worker/tool runtime 邊界」收斂到更細的具體模組
