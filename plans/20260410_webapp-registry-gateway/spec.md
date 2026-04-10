# Spec

## Purpose

讓 C Gateway 能根據靜態路由表將匹配 URL prefix 的 HTTP 請求直接轉發至本地 backend port，繞過 JWT/PAM 認證流程，使匿名使用者可存取公開 webapp。

## Requirements

### Requirement: Public Route Matching

Gateway SHALL 在 HTTP header accumulation 完成後、JWT 驗證之前，對 request path 進行 prefix matching。

#### Scenario: Exact prefix match with trailing path

- **GIVEN** routes.conf 包含 `/cecelearn 127.0.0.1 5173`
- **WHEN** 請求路徑為 `/cecelearn/index.html`
- **THEN** Gateway 將請求轉發至 `127.0.0.1:5173`，不進行 JWT 驗證

#### Scenario: Exact prefix match at root

- **GIVEN** routes.conf 包含 `/cecelearn 127.0.0.1 5173`
- **WHEN** 請求路徑為 `/cecelearn`
- **THEN** Gateway 將請求轉發至 `127.0.0.1:5173`

#### Scenario: No match falls through to auth

- **GIVEN** routes.conf 不包含 `/admin` prefix
- **WHEN** 請求路徑為 `/admin/dashboard`
- **THEN** Gateway 照舊執行 JWT 驗證流程

#### Scenario: Longest prefix wins

- **GIVEN** routes.conf 包含 `/cecelearn/api 127.0.0.1 3014` 和 `/cecelearn 127.0.0.1 5173`
- **WHEN** 請求路徑為 `/cecelearn/api/health`
- **THEN** Gateway 將請求轉發至 `127.0.0.1:3014`（較長的 prefix 優先）

#### Scenario: Partial prefix does not match

- **GIVEN** routes.conf 包含 `/cecelearn 127.0.0.1 5173`
- **WHEN** 請求路徑為 `/cecelearning/page`
- **THEN** Gateway 不視為匹配（必須在 prefix 後接 `/` 或結束）

### Requirement: Route Table Hot Reload

Gateway SHALL 在收到 SIGHUP 時重新讀取 routes.conf，不中斷現有連線。

#### Scenario: SIGHUP triggers reload

- **GIVEN** Gateway 已啟動且載入了 3 條路由
- **WHEN** 管理者修改 routes.conf 並送出 `kill -HUP <gateway_pid>`
- **THEN** Gateway 重新讀取 routes.conf，新路由立即生效；既有 splice 連線不受影響

### Requirement: Backend Connection Failure

Gateway SHALL 在無法連線到 proxy target 時回傳 502 Bad Gateway。

#### Scenario: Backend port not listening

- **GIVEN** routes.conf 包含 `/cecelearn 127.0.0.1 5173` 但 port 5173 無人監聽
- **WHEN** 請求路徑為 `/cecelearn`
- **THEN** Gateway 回傳 HTTP 502 Bad Gateway 並關閉連線

### Requirement: CLI Route Publishing

`webctl.sh publish-route` SHALL 將路由寫入 routes.conf 並觸發 Gateway 重載。

#### Scenario: Publish new route

- **GIVEN** routes.conf 不包含 `/myapp`
- **WHEN** 執行 `webctl.sh publish-route /myapp 127.0.0.1 8080`
- **THEN** `/myapp 127.0.0.1 8080` 被追加到 routes.conf，並送出 SIGHUP 給 Gateway

#### Scenario: Duplicate prefix rejected

- **GIVEN** routes.conf 已包含 `/myapp 127.0.0.1 8080`
- **WHEN** 執行 `webctl.sh publish-route /myapp 127.0.0.1 9090`
- **THEN** 指令失敗並報錯，不修改 routes.conf

### Requirement: Control Socket Registration

Daemon SHALL 可透過 `/run/opencode-gateway/ctl.sock` 動態註冊公開路由。

#### Scenario: Publish via ctl.sock

- **GIVEN** Gateway 已啟動且 ctl.sock 正在 listen
- **WHEN** Daemon connect 到 ctl.sock 並送出 `{"action":"publish","prefix":"/myapp","host":"127.0.0.1","port":8080}`
- **THEN** Gateway 回傳 `{"ok":true}`，路由即時生效，routes.conf 同步更新

#### Scenario: Duplicate prefix via ctl.sock

- **GIVEN** `/myapp` 已被其他 daemon 註冊
- **WHEN** Daemon 送出 `{"action":"publish","prefix":"/myapp",...}`
- **THEN** Gateway 回傳 `{"ok":false,"error":"prefix already registered"}`，不修改路由表

### Requirement: Silent Error Redirect

Gateway SHALL 在公開路由的 backend 不可達時 redirect 回首頁，不暴露錯誤訊息。

#### Scenario: Backend down

- **GIVEN** `/cecelearn` 已註冊指向 port 5173，但該 port 無人監聽
- **WHEN** 匿名請求 `/cecelearn`
- **THEN** Gateway 回傳 `302 Found` redirect 到 `/`

## Acceptance Checks

- 匿名瀏覽器存取 `http://<host>:1080/cecelearn` 可看到 cecelearn webapp 而非 login 頁面
- 匿名瀏覽器存取 `http://<host>:1080/` 仍顯示 login 頁面（既有行為不變）
- 已認證使用者存取 `http://<host>:1080/` 仍正常進入 opencode webapp
- 透過 ctl.sock publish 後 `curl` 可立即存取新路由
- 重複 prefix publish 被拒絕
- Backend 停止時，`curl -L` 最終回到首頁（302 redirect）
- Gateway restart 後 routes.conf 自動重載
