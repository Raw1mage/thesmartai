# Proposal

## Why

- OpenCode 需要讓開發者將自建的 webapp（如 cecelearn）發布到主機的 C Gateway，讓匿名使用者無需登入即可存取。
- 目前 Gateway 收到未認證請求時一律導向 Login 頁面，而 Per-User Daemon 只有在 PAM 登入成功後才會啟動——匿名使用者永遠觸碰不到 TypeScript Daemon 內的任何路由邏輯。
- 先前嘗試在 TypeScript Daemon 側實作 webapp registry routing，但發現此架構上的 Catch-22 後決定 pivot。

## Original Requirement Wording (Baseline)

- "讓 cecelearn 可以透過主機的 gateway 被外部使用者直接存取"
- "匿名使用者也要能看到公開的 webapp"

## Requirement Revision History

- 2026-04-10: 初始嘗試在 TypeScript Daemon (`packages/opencode/src/server/app.ts`) 建立 webapp registry routing。
- 2026-04-10: 發現 Catch-22（匿名請求永遠到不了 Daemon），pivot 至 C Gateway 作為 reverse proxy。

## Effective Requirement Description

1. 開發者可透過 CLI 工具（`webctl.sh publish-route`）將 webapp 的 URL prefix 與 proxy target 註冊到全域路由表。
2. C Gateway 在 HTTP request 階段進行 prefix matching，命中公開路由時直接 TCP connect + splice 到目標 port，完全繞過 JWT/PAM 認證。
3. 未命中公開路由的請求照舊走 JWT 驗證 → Per-User Daemon 流程，不受影響。
4. 路由表支援 SIGHUP 熱重載，無需重啟 Gateway。

## Scope

### IN

- `/etc/opencode/web_routes.conf` 格式定義與 C parser
- `webctl.sh publish-route` / `reload-routes` CLI 指令
- `daemon/opencode-gateway.c` 中的 route table loader、prefix matcher、bypass-JWT proxy 邏輯
- SIGHUP signal handler 實現熱重載
- 基本衝突偵測（重複 prefix）

### OUT

- TLS 終止 / domain 管理（由前端 reverse proxy 如 Caddy 處理）
- 正則表達式路由（僅靜態 prefix match）
- HTTP 內容修改 / rewrite（純透明轉發）
- 自動化 webapp 部署流程（CI/CD pipeline）

## Non-Goals

- 不做自動 service discovery（開發者需主動 publish）
- 不做 health check 或自動 failover（v1 scope）
- 不做 per-route access control（v1 所有 routes.conf 內的路由均為 public）

## Constraints

- C Gateway 是單線程 epoll 架構，route matching 必須是 O(n) 且 n ≤ 128 的簡單字串比對，不得阻塞 event loop
- routes.conf 格式必須對 C 語言友好（whitespace-delimited，不用 JSON）
- 公開路由的 proxy target 限 127.0.0.1（本機），不支援遠端 backend
- 既有認證流程（JWT/PAM/Login page）不得被破壞

## What Changes

- `daemon/opencode-gateway.c`：新增 WebRoute 結構、load/match/proxy 函式、SIGHUP handler、control socket (ctl.sock) + JSON registration protocol、公開路由 error redirect
- `webctl.sh`：新增 `publish-route`、`remove-route`、`list-routes` 子命令（透過 ctl.sock）
- `/etc/opencode/web_routes.conf`：新增全域路由設定檔（含 owner uid 欄位）
- `/run/opencode-gateway/ctl.sock`：新增 control socket（runtime artifact）
- `templates/skills/web-registry.md`：新增 AI skill template
- `specs/architecture.md`：需補充 Web Routes + ctl.sock 段落

## Capabilities

### New Capabilities

- Public webapp routing: 匿名使用者可透過 C Gateway 直接存取已註冊的 webapp，無需登入
- Control socket registration: Per-User Daemon 可透過 IPC（ctl.sock）動態註冊/移除公開路由
- Route publishing CLI: 開發者可透過 `webctl.sh publish-route` 或 AI skill 註冊新的公開路由
- Silent error redirect: 公開路由的 backend 不可達時，靜默 redirect 回首頁而非暴露錯誤

### Modified Capabilities

- C Gateway request handling: HTTP request accumulation 完成後新增 public route matching 階段，命中則繞過 JWT 驗證直接 proxy
- C Gateway epoll loop: 新增 control socket listen/accept 處理

## Impact

- `daemon/opencode-gateway.c`：主要修改對象，新增約 130 行 C 代碼
- `webctl.sh`：新增約 50 行 CLI 指令
- Gateway 的 request 處理流程新增一個 early-exit 分支（在 JWT 檢查之前）
- 所有既有認證路由不受影響（public route match 失敗後照舊走原本流程）
