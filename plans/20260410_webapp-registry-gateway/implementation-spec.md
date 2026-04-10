# Implementation Spec: C Gateway Web Registry

## Goal

為 opencode C Gateway 增加公開 webapp reverse proxy 能力與 control socket registration protocol，使 Per-User Daemon 可透過 IPC 動態註冊公開路由，匿名使用者可直接存取已註冊的 webapp。

## Scope

### IN

- `/etc/opencode/web_routes.conf` 格式定義與 C parser（含 owner uid 欄位）
- `daemon/opencode-gateway.c`：route table loader、prefix matcher、bypass-JWT proxy、SIGHUP reload
- `daemon/opencode-gateway.c`：control socket (`/run/opencode-gateway/ctl.sock`) listen + JSON protocol
- 公開路由的錯誤處理：502/404 靜默 redirect 回首頁
- Skill template (`templates/skills/web-registry.md`)：AI 可透過 skill → daemon API → ctl.sock 完成 route publish
- 衝突偵測（先到先贏，重複 prefix 立即拒絕）

### OUT

- TLS 終止 / domain 管理
- 正則表達式路由（僅靜態 prefix match）
- HTTP Host header rewrite（v1 不做，webapp 自行設定 `server.host`）
- 自動化 webapp 部署 / CI pipeline
- Route health check / auto-removal（v1 用靜默 redirect 取代）

## Assumptions

- cecelearn webapp 已部署在本地（frontend port 5173, backend port 3014）
- `/etc/opencode/` 目錄已存在，Gateway (root) 有完整寫入權限
- 所有 daemon user 屬於 `opencode` group，可 connect 到 ctl.sock
- 公開 webapp 自行處理含 prefix 的 request path（如 `/cecelearn/index.html`），Gateway 不做 rewrite
- Webapp dev server 需自行設定接受非 localhost Host header（如 Vite `server.host: '0.0.0.0'`）

## Stop Gates

- 若 `splice()` 對 TCP socket（非 Unix socket）行為異常，需重新評估 proxy 機制
- 若 ctl.sock group 權限模型不適用於某些部署環境，需引入替代認證
- 若公開路由被用於惡意流量放大，需引入 rate limiting per-route（v2 scope）

## Critical Files

- `daemon/opencode-gateway.c` — WebRoute struct, ctl.sock, load/match/proxy, error redirect
- `/etc/opencode/web_routes.conf` — 持久化路由設定（`prefix host port uid` 格式）
- `/run/opencode-gateway/ctl.sock` — control socket（runtime artifact）
- `webctl.sh` — `publish-route` / `remove-route` / `list-routes` CLI（透過 ctl.sock）
- `templates/skills/web-registry.md` — AI skill template

## Structured Execution Phases

- Phase 1 (C Gateway Core): routes.conf parser + prefix matcher + bypass-JWT splice proxy + error redirect to `/`
- Phase 2 (Control Socket): ctl.sock listen + JSON protocol (publish/remove/list) + routes.conf persistence + in-memory update
- Phase 3 (CLI + Skill): `webctl.sh` subcommands 透過 ctl.sock 操作 + web-registry skill template
- Phase 4 (Testing): 編譯 Gateway、ctl.sock 端到端測試、匿名存取驗證、衝突偵測驗證

## Control Socket Protocol

Gateway 額外 listen `/run/opencode-gateway/ctl.sock` (Unix domain, `ECTX_CTL_LISTEN` / `ECTX_CTL_CLIENT`)。
Socket permissions: `0660`, group `opencode`。

Request/Response 格式：一行 JSON + `\n`。

```
→ {"action":"publish","prefix":"/cecelearn","host":"127.0.0.1","port":5173}
← {"ok":true}

→ {"action":"remove","prefix":"/cecelearn"}
← {"ok":true}

→ {"action":"list"}
← {"ok":true,"routes":[{"prefix":"/cecelearn","host":"127.0.0.1","port":5173,"uid":1000}]}
```

Gateway 收到 `publish` 時：
1. 檢查 prefix 是否已存在 → 已存在則回 `{"ok":false,"error":"prefix already registered"}`
2. 透過 `SO_PEERCRED` 取得 peer uid → 記錄為 route owner
3. 更新 `g_web_routes[]` in-memory table
4. Flush 到 `/etc/opencode/web_routes.conf`（持久化）
5. 回 `{"ok":true}`

## Gateway Route Table Format

```
# Format: <prefix> <target_ip> <target_port> <owner_uid>
/cecelearn/api 127.0.0.1 3014 1000
/cecelearn 127.0.0.1 5173 1000
```

第四欄為 owner uid（由 `SO_PEERCRED` 取得）。Gateway 重啟時從 routes.conf 重建完整 table。

## Error Handling for Public Routes

公開路由的 backend 不可達（connect fail）或回傳 error 時，Gateway **不暴露錯誤訊息**，直接 `302 Found` redirect 到 `/`（首頁）。行為類似 nginx `error_page 502 =302 /`。

使用者體驗：webapp 掛了 → 瀏覽器自動回到首頁，不會看到 Bad Gateway。

## Registration Flow (Full Chain)

```
使用者: "把 cecelearn 發布到 /cecelearn"
  → AI 調用 web-registry skill
    → skill 呼叫 webctl.sh publish-route /cecelearn 127.0.0.1 5173
      → webctl.sh connect 到 /run/opencode-gateway/ctl.sock
        → Gateway 更新 in-memory table + flush routes.conf
          → 路由即時生效，匿名用戶可存取
```

## Validation

- `webctl.sh compile-gateway` 編譯成功，無 warning
- Gateway 啟動後正確載入 routes.conf 和 listen ctl.sock（log 確認）
- 透過 ctl.sock 發送 publish → `curl http://127.0.0.1:1080/cecelearn` 回傳 webapp 內容
- 重複 prefix publish → 回傳 `{"ok":false,...}`
- Backend 停止 → `curl` 收到 302 redirect 到 `/`（非 502）
- `curl http://127.0.0.1:1080/` 仍回傳 Login 頁面
- 已認證使用者的 opencode 功能不受影響
- Gateway restart 後 routes.conf 自動重載，公開路由仍生效

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
