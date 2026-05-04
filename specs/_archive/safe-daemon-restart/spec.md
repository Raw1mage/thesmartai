# Spec: safe-daemon-restart

## Purpose

消除「AI 自殺式重啟 → orphan daemon → 使用者被踢出登入」的循環。把 daemon 生命週期控制權收斂到 gateway，並在 gateway 側補上自癒與 runtime 目錄保證。

## Requirements

### Requirement: RESTART-001 AI 可透過正式 tool 請求含 rebuild 的自重啟 (v2, REVISED 2026-04-21)

~~(v1) MCP tool → gateway 新 endpoint → SIGTERM + respawn。~~ Scope 擴大：真正情境是 AI 剛改過 code（src / frontend / gateway），需要完整 rebuild+install+restart，不只 signal。

- **GIVEN** 一個 AI agent 在 daemon context 中（剛做完 code change 或 config 調整）
- **WHEN** 呼叫 `system-manager:restart_self` tool
- **THEN** MCP tool POST `/api/v2/global/web/restart`（**既有端點**，UI 設定頁已在用）帶 JWT
- **AND** 端點在 gateway-daemon 模式下先執行 `webctl.sh restart`（smart-detect rebuild + install per-layer），再自殺退出
- **AND** gateway 偵測 daemon 退出後，下一個請求觸發乾淨 spawn（走 phase 1 的自癒路徑）
- **AND** 使用者瀏覽器的 SSE 自動重連，不被踢登入

#### Scenario: 無變動的空轉重啟
- **GIVEN** 沒有任何 source/frontend/binary 改動
- **WHEN** AI 呼叫 restart_self
- **THEN** webctl.sh 各層 stamp 比對都 skip，不 rebuild
- **AND** daemon 直接重啟（<= 3s）

#### Scenario: daemon 程式碼改動後重啟
- **GIVEN** AI 剛改 `packages/opencode/src/**`
- **WHEN** 呼叫 restart_self
- **THEN** webctl.sh 偵測到 daemon 層 dirty → rebuild daemon bundle（或 dev 模式 re-exec）
- **AND** 其他層（frontend, gateway C binary）skip
- **AND** 新 daemon 跑的是新版本

#### Scenario: Gateway C binary 改動後重啟
- **GIVEN** AI 剛改 `daemon/opencode-gateway.c`
- **AND** restart_self 帶 `targets: ["gateway"]`（或自動偵測到 gateway 層 dirty）
- **WHEN** 執行
- **THEN** webctl.sh `make` + `install` + `systemctl restart opencode-gateway`
- **AND** systemd 拉起新 gateway binary；期間所有使用者斷線 3-5s
- **AND** 新 gateway 重拾 spawn 新 per-user daemon

#### Scenario: 前端 prod bundle 改動後重啟
- **GIVEN** prod 模式（`/usr/local/share/opencode/frontend` 存在）
- **AND** AI 剛改 `packages/app/src/**`
- **WHEN** 呼叫 restart_self
- **THEN** webctl.sh 偵測到 frontend 層 dirty → `build-frontend` + 部署到系統路徑
- **AND** Dev 模式下跳過（vite HMR 處理）

#### Scenario: Webctl rebuild 失敗
- **GIVEN** rebuild 途中任一步 exit ≠ 0
- **WHEN** webctl.sh 回傳錯誤
- **THEN** daemon 不自殺（保命），回傳 5xx + 錯誤 log 路徑給 UI / MCP
- **AND** 系統維持舊版本可用

### Requirement: RESTART-002 Daemon 禁止 spawn 自己或兄弟

- **GIVEN** AI agent 透過 `system-manager:execute_command` 或 Bash 嘗試跑 `webctl.sh dev-start` / `bun ... serve --unix-socket` / `kill <daemon-pid>`
- **WHEN** MCP tool 解析指令
- **THEN** 命中 denylist 的指令**立即拒絕**，回錯誤訊息引導使用者改用 `restart_self`
- **AND** 不執行任何 side effect

### Requirement: RESTART-003 Gateway 自癒 flock orphan

- **GIVEN** 有一個 bun daemon process 持有 `/home/<user>/.local/share/opencode/gateway.lock`（或其等效 flock），但 gateway 的 `DaemonInfo.state ∈ {NONE, DEAD}`
- **WHEN** `ensure_daemon_running` 要 spawn 但 `try_adopt_from_discovery` 失敗
- **THEN** gateway **先**偵測 flock holder PID（透過 `fcntl(F_OFD_GETLK)` 或讀 `/proc/*/fd/` 掃 socket path）
- **AND** 若 holder PID 存在且屬於目標 uid：送 SIGTERM → 1s waitpid → SIGKILL
- **AND** 接著才 `unlink(socket_path)` + fork 新 daemon
- **AND** event log 記錄 `orphan-cleanup: pid=<N>`

### Requirement: RESTART-004 Runtime 目錄必被保證存在

- **GIVEN** 使用者登入成功（JWT 簽發）
- **AND** `/run/user/<uid>/opencode/` 不存在（被 tmpfs 清掉 / 首次 spawn / WSL 重啟）
- **WHEN** gateway 進入 daemon spawn flow
- **THEN** 在 fork 前 gateway 先 `mkdir -p /run/user/<uid>/opencode` 並 `chown <uid>:<gid>` 並 `chmod 0700`
- **AND** 父層 `/run/user/<uid>` 缺失時也一併 `mkdir`（既有 `resolve_runtime_dir` 行為）
- **AND** spawn 才進行；socket 父目錄缺失不再是沉默失敗

### Requirement: RESTART-005 觀測性最低線

- **GIVEN** 任一 restart / orphan cleanup / runtime-dir recreate 事件
- **WHEN** 事件發生
- **THEN** gateway log 以 `[INFO ]` 或 `[WARN ]` 寫入可 grep 關鍵字：`restart-self`, `orphan-cleanup`, `runtime-dir-created`
- **AND** 每個事件含 uid / pid / socket_path / reason
- **AND** restart_self 的 MCP 回應也帶 `eventId` 讓 AI 可追蹤

## Acceptance Checks

- A1. curl `/api/v2/global/restart-self` 帶合法 JWT → 202 + 實際 daemon 重啟 + 新 pid ≠ 舊 pid
- A2. 手動啟一個 orphan bun daemon（持 flock），gateway 請求觸發 → orphan 被 kill、新 daemon 起來、使用者不被踢
- A3. `rm -rf /run/user/1000/opencode/` 後觸發請求 → 目錄自動重建、daemon 正常 spawn
- A4. AI 在 execute_command 輸入 `webctl.sh dev-start` → 被 denylist 擋 + 回傳明確錯誤
- A5. restart_self 呼叫期間的 SSE 連線在 新 daemon 起來後 ≤ 5s 自動重連
- A6. 所有路徑觀察到對應 log keyword，事件可追蹤
