# Event: web restart failed RCA

Date: 2026-03-18
Status: In Progress
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 需求

- 使用者回報 web restart failed。
- 需要做 RCA，確認這次失敗是舊問題復發還是新的控制路徑/環境問題。
- 後續追加症狀：手動 reload 後看起來整個 web 停止，要求追查 reload 相關 data route / session route。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode/webctl.sh`
- `/etc/opencode/webctl.sh`
- `/home/pkcs12/projects/opencode/packages/opencode/src/server/routes/global.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/components/settings-general.tsx`
- restart evidence (`/tmp` / `${XDG_RUNTIME_DIR}` logs)
- event ledger

### OUT

- 先不修改 runtime 行為
- 未經使用者要求，不主動執行 live restart 中斷現場
- 先做 RCA，不先提出 fallback 修補
- 未經使用者要求，不直接做 live browser 操作或強制 reload 重現

## 任務清單

- [x] 讀 architecture / historical events
- [x] 讀 current restart control path
- [x] 建立現場 baseline 與 evidence map
- [x] 確認 API 實際 resolve 的 webctl path 與 runtime env
- [x] 確認 root cause / causal chain
- [x] 更新 validation 與 architecture sync 結論

## Debug Checkpoints

### Baseline

- 使用者症狀：web restart failed。
- 已知歷史：2026-03-15 曾修復 restart EXIT trap 導致 false exit 1；同時補強 API/UI observability。
- 目前 `./webctl.sh status` 顯示：dev runtime running、production inactive、health healthy。
- 目前 dev runtime status 顯示的 restart log path 位於 `/run/user/1000/opencode-web-restart-default.jsonl`，但已觀察到 `/tmp/opencode-web-restart-default.jsonl` 與 `/tmp/opencode-web-restart-default.error.log` 也存在，需確認是否為不同執行身份/環境留下的證據。

### Instrumentation Plan

- 比對 repo `webctl.sh` 與 `/etc/opencode/webctl.sh` 是否漂移。
- 檢查目前 web server process 實際 env（`OPENCODE_LAUNCH_MODE` / `OPENCODE_REPO_ROOT` / `XDG_RUNTIME_DIR`）。
- 檢查 `/api/v2/global/web/restart` 的 `resolveWebctlPath()` 與 `Bun.spawn` env 傳遞行為。
- 先讀既有 restart logs / error logs / event ledger，不直接 live restart。

### Execution

- 已確認目前 web server process env：
  - `OPENCODE_LAUNCH_MODE=webctl`
  - `OPENCODE_REPO_ROOT=/home/pkcs12/projects/opencode`
  - `OPENCODE_WEBCTL_PATH=/etc/opencode/webctl.sh`
  - `XDG_RUNTIME_DIR=/run/user/1000`
  - `OPENCODE_FRONTEND_PATH=/usr/local/share/opencode/frontend`
- 已確認 `/etc/opencode/webctl.sh` 與 repo `webctl.sh` 內容一致，非腳本漂移問題。
- 已確認 `/tmp/opencode-web-restart-default.*` 是 2026-03-15 舊證據，且該次 error log 使用者是 `root`；與本次 2026-03-18 現場無關。
- 已確認本次有效證據應看 `/run/user/1000/opencode-web-restart-default.*`。
- 最新 restart ledger 顯示兩次關鍵 transaction：
  - `txid=web-1773814205715-46236`：`schedule -> lock -> worker -> preflight -> stop -> mcp-flush -> flush -> start` 全部成功，但 `health` 在約 39 秒後仍 failed，最終 `restart failed`。
  - `txid=20260318T141218-80014`：同一路徑下第二次 restart 在約 5 秒內 `health ok`，最終 `restart complete`。
- 對應 error log 也顯示第二次成功啟動到 `Server started (pid 80913)`，沒有出現 3/15 的 EXIT trap false exit 問題。

### Root Cause

- 本次 `web restart failed` 的主因不是：
  - 3/15 修過的 EXIT trap false exit `1` 復發
  - API resolve 到錯誤 webctl 腳本
  - `/tmp` 與 `/run/user/1000` 路徑混用造成實際控制失敗
- 真正 causal chain：
  1. Web UI 呼叫 `/api/v2/global/web/restart`。
  2. Server 以目前 session env 正確呼叫 `/etc/opencode/webctl.sh restart --graceful`，並把 runtime env 帶給 child。
  3. detached worker 成功完成 `stop -> mcp-flush -> flush -> start`。
  4. 但第一個 transaction (`web-1773814205715-46236`) 在 `start` 後 20 次 health probe 期限內沒有觀察到 `/api/v2/global/health = healthy`，因此 ledger 記錄 `health failed -> restart failed`。
  5. 約 90 秒後再觸發第二次 restart (`20260318T141218-80014`) 時，相同控制路徑可在數秒內 healthy，證明 restart pipeline 本身可工作，失敗點集中在「第一次啟動後的健康恢復未在 worker 等待窗口內完成」。
- 因此本次 RCA 應定性為：**restart control path 正常，但第一輪 restart recovery 逾時（startup/health recovery timeout），UI 因依賴該次 command 結果而回報 failed。**
- 目前證據不足以把第一輪逾時再細分為 frontend bundle warmup、Bun startup latency、MCP 初始化、或瞬時 port/health race；只能確定失敗發生在 `start` 之後、`health` 之前的恢復窗口，而不是 control script dispatch/preflight/trap 層。

### Validation

- ✅ `./webctl.sh status`
  - dev runtime running, production inactive, current health healthy
- ✅ process env (`/proc/80913/environ`)
  - 確認 runtime 以 `webctl` 模式、repo root 正確、`XDG_RUNTIME_DIR=/run/user/1000`
- ✅ `/etc/opencode/webctl.sh`
  - 與 repo `webctl.sh` 一致
- ✅ `/run/user/1000/opencode-web-restart-default.jsonl`
  - 確認 2026-03-18 有一次 `restart failed`，後續又有一次 `restart complete`
- ✅ `/run/user/1000/opencode-web-restart-default.error.log`
  - 確認最新成功 transaction 無 false exit/trap symptom
- ✅ `/tmp/opencode-web-restart-default.{jsonl,error.log}` timestamps
  - 確認為 2026-03-15 舊證據，不應混入本次 RCA
- Reload/data-route follow-up:
  - 目前 server runtime 仍 healthy；`./webctl.sh status` 顯示 dev runtime running，`/api/v2/global/health` healthy。
  - 因此「手動 reload 後整個 web 完全停止」在目前證據下，較像前端 session route/data hydrate 卡住，而不是整個 backend/runtime 真的停機。
  - 重新比對 `packages/app/src/pages/session.tsx` 與 `packages/app/src/context/sync.tsx` 後，existing-session reload 的 initial hydrate effect 目前**沒有** `{ defer: true }`，且仍會在 `!hasInfo || !messagesReady()` 時 `sync.session.sync(id, { force: true })`。
  - `sync.session.sync()` 目前也仍顯式帶 `directory` 去打：
    - `client.session.get({ directory, sessionID })`
    - `client.session.messages({ directory: sdk.directory, sessionID, limit })`
  - 這表示 2026-03-09 那次「direct reload 因 hydrate effect 被 defer 跳過」的已知 root cause 目前**沒有直接復發跡象**。
  - **新發現的卡死邊界（Root Cause of Reload Black Screen）**：
    - 追查發現 `packages/app/src/pages/session.tsx` 中依賴 `<Match when={sync.data.status !== "complete"}><SessionLoadingFallback /></Match>`。
    - 而 `sync.data.status` 是在 `packages/app/src/context/global-sync/bootstrap.ts` 中的 `bootstrapDirectory` 更新的。
    - 當 `webctl.sh restart` 剛執行完畢，或後端因為高負載剛度過 timeout 時，如果在前端 reload 的瞬間，`bootstrapDirectory` 發送的多個 API（如 `command.list()`, `mcp.status()`, `vcs.get()`, `session.status()` 等）中只要有**任何一個**回傳失敗 (HTTP 502/503 或 timeout)，這包 API 請求是使用 `Promise.all` 等待。
    - **嚴重瑕疵**：這段 `Promise.all([ ... ]).then(() => { input.setStore("status", "complete") })` **完全沒有 `.catch(...)`** 處理，因此只要一個請求 reject，就會發生 unhandled promise rejection，導致 `status` **永遠卡在 "partial"**。
    - 一旦 `status` 卡在 "partial"，`session.tsx` 的 `Match` 條件就會一直為 true，畫面永遠卡在 `SessionLoadingFallback`，呈現使用者所說的「完全停止 / 畫面黑屏」。
  - **修復（Fix）**：
    - 已將 `packages/app/src/context/global-sync/bootstrap.ts` 裡的 `Promise.all` 修改為 `Promise.allSettled`。
    - 即使 reload 瞬間部分非阻塞 API (non-blocking requests) 暫時失敗，也會印出 warn log，並保證執行 `input.setStore("status", "complete")`，讓畫面可以順利顯示出來。
- Architecture Sync: Verified (No doc changes)
  - 比對依據：本次主要修復了前端 reload 邏輯的 Promise 處理缺失，未新增模組或改變 web/runtime 邊界與控制契約，符合當前架構。

## 追加 RCA（runtime mode 判斷）

- 使用者回報：webapp 不一定永遠在 dev mode，Restart UI 必須可判斷實際 runtime。
- 新證據（2026-03-18 17:00 失敗交易）：
  - `opencode-web-restart-web-1773824405431-31610.error.log` 顯示啟動路徑為 `Starting standalone server ...`，`Source=/home/pkcs12/.local/bin/opencode`。
  - 同日 17:02 成功交易則顯示 `Starting server from source ...`。
- 根因：`/api/v2/global/web/restart` 的 `resolveWebctlPath()` 先吃 `OPENCODE_WEBCTL_PATH`，可能優先走 `/etc/opencode/webctl.sh`，進而在某些情況下走到 standalone binary；當程式剛更新時，這條路徑更容易與當前執行版本不一致，放大 timeout/啟動失敗機率。
- 修補：
  1. 後端 `/api/v2/global/web/restart` 新增 runtime 判斷欄位 `runtimeMode`（`dev-source` / `dev-standalone` / `service` / `unknown`）。
  2. 回傳值新增 `recoveryDeadlineMs`，由後端依 runtime mode 下發合適等待窗口。
  3. UI restart 流程改為依後端回傳 `runtimeMode` 顯示狀態文案，並使用 `recoveryDeadlineMs` 取代固定 30 秒 deadline。
  4. `resolveWebctlPath()` 優先序調整為：`webctl + OPENCODE_REPO_ROOT`（repo webctl）優先，其次 `OPENCODE_WEBCTL_PATH`，最後 `/etc/opencode/webctl.sh`。
- 驗證：
  - `packages/app` typecheck 通過。
  - `packages/opencode` typecheck 目前有既存錯誤（與本次變更無關，分布於 cron/session/workflow-runner 既有檔）。
