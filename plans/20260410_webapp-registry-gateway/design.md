# Design

## Context

OpenCode 的 C Gateway 是一個單線程 epoll-based reverse proxy，以 root 身份運行在 port 1080，負責 HTTP 請求的認證（JWT/PAM）和轉發（splice proxy 到 Per-User Daemon）。目前所有未認證的請求一律收到 Login 頁面。

需要在這個架構中插入一個「公開路由」分支，讓匹配特定 URL prefix 的請求繞過認證，直接轉發到本地 backend port。

## Goals / Non-Goals

**Goals:**

- 零拷貝轉發公開 webapp 流量（重用既有 splice 機制）
- 路由表可熱重載（SIGHUP），無需重啟 Gateway
- 最長 prefix 匹配，確保 `/cecelearn/api` 優先於 `/cecelearn`
- 開發者可透過 CLI 工具自助發布路由

**Non-Goals:**

- 不做 WebSocket 升級支持（v1 scope，splice 可透傳但不做顯式 upgrade 處理）
- 不做 HTTP/2 或 gRPC
- 不做 load balancing / multiple backends per prefix

## Decisions

- **DD-1: Route matching 位置**：在 `route_complete_request()` 中，header accumulation 完成後、JWT 檢查之前插入 `match_web_route()` 調用。命中則 early return，不進入 JWT/PAM 流程。理由：最小侵入性，且保證公開路由的延遲最低。

- **DD-2: Config 格式**：選用 whitespace-delimited 純文字（`<prefix> <host> <port> <uid>`），不用 JSON。理由：C 語言解析 JSON 需要額外 library，而 `sscanf` 一行即可解析四個欄位。第四欄 uid 記錄 owner，向下相容三欄格式（uid 預設 0）。

- **DD-3: Proxy 機制**：重用既有 `Connection` 結構和 `ECTX_SPLICE_CLIENT / ECTX_SPLICE_DAEMON` 狀態機，但 `daemon_fd` 連接到 TCP socket 而非 Unix socket。理由：零拷貝 splice 迴圈已經測試穩定，不需要另造。

- **DD-4: 排序策略**：`load_web_routes()` 載入後按 prefix 長度降序排列（bubble sort, n ≤ 128），確保最長匹配優先。理由：簡單且 n 小，不需要 trie。

- **DD-5: Boundary guard**：prefix match 要求路徑在 prefix 之後必須是 `\0` 或 `/`，防止 `/cecelearn` 誤匹配 `/cecelearning`。

- **DD-6: Registration via control socket**：Gateway 額外 listen `/run/opencode-gateway/ctl.sock`（0660, opencode group）。Daemon 透過 ctl.sock 發送 JSON 註冊命令，Gateway 以 root 權限更新 in-memory table + flush routes.conf。理由：解決 daemon (普通 uid) 無法寫入 `/etc/opencode/` 的權限問題，且 Gateway 自己做 in-memory 更新不需要 SIGHUP。

- **DD-7: Error redirect**：公開路由的 backend connect fail 時，回傳 `302 Found Location: /` 而非 `502 Bad Gateway`。理由：Gateway 在這個角色上類似 nginx，匿名用戶不該看到醜的錯誤頁面。

- **DD-8: 先到先贏衝突策略**：prefix 已存在時 publish 立即拒絕，不做覆蓋。理由：避免多用戶搶 prefix 造成路由抖動。

- **DD-9: Host header 不改寫**：v1 不做 Host header rewrite。Webapp dev server 需自行設定接受外部 Host（如 Vite `server.host: '0.0.0.0'`）。理由：Gateway 是 raw splice 零拷貝轉發，改寫 header 需要 buffer manipulation，增加複雜度。若未來證實必要，在 splice 前的 `pending_req->buf` 階段改寫即可。

## Data / State / Control Flow

```
HTTP Request
    │
    ▼
Header Accumulation (PendingRequest, 8KB buf)
    │
    ▼
Parse method, path, cookie
    │
    ▼
match_web_route(path) ──── HIT ────► connect(target_ip:port)
    │                                     │
    │ MISS                                ▼
    ▼                               alloc_conn()
Check JWT cookie                    pipe2() × 2
    │                               write(pending_buf → pipe)
    ▼                               epoll_ctl(client_fd, daemon_fd)
[Original auth flow]                    │
                                        ▼
                                  splice() bidirectional proxy
```

**SIGHUP reload flow:**

```
SIGHUP → g_reload_routes = 1
    │
    ▼ (checked in epoll_wait loop)
load_web_routes() → re-read /etc/opencode/web_routes.conf
    │
    ▼
g_web_routes[] updated, g_nweb_routes updated
```

## Risks / Trade-offs

- **Risk: route table race during reload** → Mitigation: `g_reload_routes` is `sig_atomic_t`; `load_web_routes()` runs in main thread（single-threaded，無 race）。SIGHUP 中斷 epoll_wait 後在下一輪迴圈處理。

- **Risk: backend 未啟動時 connect() 失敗** → Mitigation: `connect()` 回傳 error 時立即送 502 並 close client fd。不做 retry。

- **Risk: 大量公開路由拖慢 match** → Mitigation: n ≤ 128 的線性掃描在現代 CPU 上 < 1μs。若未來需擴展可改用 trie，但 v1 不需要。

- **Risk: splice pipe buffer 殘留** → Mitigation: 重用既有 `close_conn()` 清理邏輯，所有 pipe fd 在連線結束時關閉。

- **Trade-off: 不做 path rewrite** → 公開 webapp 收到的 request path 仍包含 prefix（如 `/cecelearn/index.html`），webapp 必須自行處理。這避免了 Gateway 中做 HTTP 內容修改的複雜度。

## Critical Files

- `daemon/opencode-gateway.c` — WebRoute struct, ctl.sock listen/protocol, load/match/proxy, error redirect, SIGHUP handler
- `webctl.sh` — publish-route / remove-route / list-routes 子命令（透過 ctl.sock）
- `/etc/opencode/web_routes.conf` — 持久化路由設定（`prefix host port uid` 格式）
- `/run/opencode-gateway/ctl.sock` — control socket（runtime artifact）
- `templates/skills/web-registry.md` — AI skill template
- `specs/architecture.md` — 需更新 C Gateway 段落
