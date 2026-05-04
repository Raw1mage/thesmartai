# Design: docxmcp-http-transport

## Context

把 docxmcp 從「stdio + docker bind-mount staging」轉成「HTTP MCP server + content-addressed token API」。容器邊界回歸 docker 預設零信任、host filesystem 完全不暴露。docxmcp repo 同時生出 bin-wrappers/ 非 Docker 表層給 CLI 使用者。bind mount 升級為跨 mcp 生態的安全紅線。

範圍邊界由 [proposal.md](proposal.md) 鎖定。本檔聚焦於決策、風險、影響面。

## Goals / Non-Goals

### Goals

- 容器邊界乾淨：docxmcp container 啟動 `Mounts` 列表為空（named volume cache 例外允許）
- 檔案傳遞高效：multipart raw bytes，無 base64、無 tarball 壓縮（docx 已是 zip）
- AI 路徑統一：本機與遠端都走 HTTP MCP，loopback < 1ms 無延遲劣勢
- docxmcp 兩層 surface：Docker 內層（既有 CLI + MCP server）+ 非 Docker 表層（bin-wrappers）
- 跨 mcp 生態 bind mount 全面禁止，新增 mcp app 不能再導入

### Non-Goals

- 把其它 mcp app（gmail / google-calendar / system-manager）轉到 HTTP — 只 docxmcp
- 跨機器部署 stack（Cloud Run / k8s 詳細部署）— 本 spec 只確保架構可行
- bin-wrappers 進入 AI 工具表 — wrappers 純為 CLI 使用者
- ssh 通道支援 — docker exec 已涵蓋本機需求

## Decisions

### DD-1：HTTP MCP transport（Streamable HTTP, 2025-03-26 spec）

**Decision**：docxmcp 用 mcp Python SDK 的 `StreamableHTTPSessionManager` 暴露 `/mcp` endpoint；opencode 用 `@modelcontextprotocol/sdk` 的 `StreamableHTTPClientTransport` 連。

**Rationale**：MCP 協議的 long-lived HTTP transport 標準。同時支援多 client 連線、resumability via SSE event id、mcp-session-id header。比自定 JSON-RPC over HTTP 通用、跟生態對齊。

### DD-2：File API endpoint shape

**Decision**：

```
POST /files       multipart/binary  → 200 { token, sha256, size }
GET /files/{token}                  → 200 raw bytes
DELETE /files/{token}               → 204
```

multipart field name 為 `file`、其它欄位（filename, mime-type）走 multipart 標準 header。

**Rationale**：multipart 是 web 標準、所有 HTTP client / server 都認、Python starlette / FormData 支援 streaming（不爆記憶體）。token-based 比 sha-based 簡單（不暴露 sha 給未上傳的人探查、開放 token 旋轉）。

### DD-3：Token format

**Decision**：`tok_<base32(20-byte cryptographic random)>` — 共 36 字元前綴 + base32 = 適合 URL path 與 JSON 字串。

**Rationale**：
- 20 byte = 160 bit entropy，brute-force 不可能
- base32 大小寫不敏感、URL-safe、無歧義字元（去掉 0/O/1/I）
- `tok_` prefix 方便 log / debug 一眼識別

**Rejected alternatives**：UUIDv7（時間序透露、entropy 較低）、sha256 of content（同檔多次上傳碰撞 + 暴露內容指紋）。

### DD-4：Container session storage

**Decision**：`/tmp/docxmcp-sessions/<token>/<original-filename>`，TTL 60 分鐘 idle、總體 1 GB cap、LRU eviction。

**Rationale**：
- `/tmp` 是 ephemeral、container restart 自動清
- 多檔每 token 一資料夾，避免 token 衝突
- TTL + cap 防止累積
- LRU 而非 FIFO：最近用過的不被踢

### DD-5：Bundle cache via named volume

**Decision**：docxmcp 容器內 cache 走 named volume `docxmcp-cache:/var/cache/docxmcp/bundles/<sha>/`。容器重啟 cache 保留、token 全清。host **看不到** named volume 內容（docker daemon 自管）。

**Rationale**：保留跨 session sha-keyed cache 的效益（與舊 spec DD-4 同精神）、同時 host 仍不可見。named volume 是 docker 推薦的「持久化但不暴露」storage 模式。

**Note**：此 named volume 為「容器自管儲存」、**不是 bind mount**（host path 不寫死、host 進程無法直接讀）。R1 的禁令對它例外允許。

### DD-6：cutover 一次性、無反向相容

**Decision**：本 spec 落地 = 直接刪除既有 stdio + bind mount 路徑。不保留 fallback。

**Rationale**：保留兩條路會永遠養著 bind mount 的程式碼，安全紅線執行不徹底。一次性切換配合 daemon restart 風險可接受。

### DD-7：bin-wrappers 內部使用 docker cp + docker exec

**Decision**：每個 wrapper 三步驟：
```bash
docker cp <host-path> <container>:/tmp/incoming-<random>-<basename>
docker exec <container> python /app/bin/<tool>.py /tmp/incoming-<random>-<basename> "${other-args[@]}"
docker exec <container> rm -f /tmp/incoming-<random>-<basename>
```

**Rationale**：
- `docker cp` 走 docker daemon tar stream API，**不是 bind mount**
- 失敗清理：trap exit 確保 rm 跑到
- random 後綴避免並行 wrapper 互踩

### DD-8：opencode mcp client per-app transport switch

**Decision**：`mcp-apps.json` entry 加 `transport: "stdio" | "streamable-http"` 欄；opencode `connectMcpApps` 依此選對應 transport class。

**Rationale**：影響面最小、其它 mcp app 不動、未來轉 HTTP 一個一個遷。

### DD-9：dispatcher 大砍 + 重寫 HTTP 路徑

**Decision**：
- **撤除**：`/specs/_archive/repo-incoming-attachments` 的 DD-3 (mcp /state mount)、DD-5 (staging dir)、DD-11 (hard-link + break-on-write)、DD-15 (EXDEV fallback)、DD-16 (host-side manifest sha integrity)
- **保留**：DD-1 (project root fail-fast)、DD-2 (jsonl history)、DD-6 (drift detection)、DD-7 (currentSha)、DD-8 (conflict-rename)、DD-12 (filename sanitize)、DD-13 (jsonl rotate)、DD-14 (result path rewriting)、DD-17 (AttachmentRefPart with repo_path)
- dispatcher.before：`POST /files` 取 token、改寫 args
- dispatcher.after：解析 mcp result、寫產物到 `<sourceDir>/<stem>/`、best-effort `DELETE /files/{token}`

**Rationale**：HTTP transport 沒共享 inode、沒 cross-fs 議題、沒 host-side cache 完整性問題（容器自管），既有那五條 DD 全部失去 raison d'être。

### DD-10：bundle 結果回傳 = base64 in tool result（OQ-1 收斂）

**Decision**：docxmcp tool 跑完把 bundle（description.md / outline.md / media/）打包成 base64 of tar（`base64(tar(bundle/))`） 放進 mcp tool result 的 `structuredContent.bundle_tar_b64`。opencode dispatcher.after 解開、寫到 `<repo>/<sourceDir>/<stem>/`。

**Rationale**：1 round-trip、protocol 內、不需要二次 GET /files。雖然 mcp result 有大訊息成本，但 docxmcp bundle 通常 < 5 MB（除了內含大圖），可接受。

**Risk**：bundle 含 100 MB+ 大圖時訊息會卡。Mitigation：planned 階段加大圖時改走二次 token GET 路徑（`bundle_token` 取代 `bundle_tar_b64`），DD-10 留 v1 簡單路徑。

### DD-11：multipart 上傳 chunked streaming

**Decision**：docxmcp Python 用 starlette `request.stream()` 逐 chunk 讀 + 逐 chunk 寫到 `/tmp/docxmcp-sessions/<token>/...`，不一次吃進記憶體。

**Rationale**：50 MB+ 檔案不應一次 buffer 到 memory；streaming 才允許大檔。

### DD-12：Unix domain socket transport（取代 TCP port，2026-05-03 拍板）

**Decision**：docxmcp HTTP server 走 Unix domain socket、**不開 TCP port**。

```
host 端：~/.local/state/opencode/sockets/docxmcp/docxmcp.sock
container 端：/run/docxmcp/docxmcp.sock
```

docker compose 用窄 bind mount 把 host 的 socket 目錄掛進容器：

```yaml
volumes:
  - "${HOME}/.local/state/opencode/sockets/docxmcp:/run/docxmcp"
```

opencode mcp client 連 `unix:///home/<user>/.local/state/opencode/sockets/docxmcp/docxmcp.sock`，透過 Bun fetch 的 `unix:` URL scheme（或等價 socketPath 機制）。

**Rationale**：
- **零 port 衝突**：不爭搶 8080 / 51080 / 任何 TCP port
- **檔案權限做 access control**：socket dir mode 0700、socket file mode 0600，比 `127.0.0.1:port` 更嚴格
- **跨 mcp app 自然並存**：每個 mcp app 自己的 socket dir，沒有 port allocator 問題
- **跟 opencode 既有風格一致**：opencode daemon 自己就用 `/run/user/1000/opencode/daemon.sock`

**Why bind mount IPC dir 例外允許**：先前 bind mount 禁令針對的是「資料目錄」（共享真實使用者資料、容器寫立即反映 host）。IPC rendezvous 目錄性質不同：

| | 資料目錄 bind mount（**禁**） | IPC dir bind mount（**例外允許**） |
|---|---|---|
| 內容 | 真實檔案、使用者 docx、cache | 0-byte AF_UNIX socket inode |
| 容器讀 host 資料 | 可以 | **不能**（dir 內只有 socket、沒檔案） |
| 容器寫 host 資料 | 可以 | **不能**（同上） |
| 資料流通道 | filesystem inode（共享）| socket bytes（協議化通訊） |
| 需要 break-on-write 等補丁 | 需要 | 不需要 |

DD-13 lint 規則對應加 IPC exception clause（見下）。

**No auth**：socket 檔案權限 0600 + dir 0700 已足夠 — 只有同 uid 的 opencode 進程能連，比 TCP `127.0.0.1` 更嚴（後者所有同機 uid 都可連）。

### DD-13：bind mount lint guard（含 IPC 例外）

**Decision**：opencode `McpAppStore.addApp` 加 lint：command 含 `-v` / `--mount type=bind` 預設 reject、回 `bind_mount_forbidden` 錯誤碼。**例外**：bind mount 的 host source 路徑符合 `^${HOME}/.local/state/opencode/sockets/[a-z0-9-]+/?$` AND container target 符合 `^/run/[a-z0-9-]+/?$`，且 mount 屬性沒有 `:rw`、`:ro` 等資料 mount flags（純 IPC dir）→ 允許。

**Rationale**：
- 預設禁令仍嚴格擋住所有資料目錄 bind mount
- IPC 例外條款窄而具體：
  - host 路徑必須在 opencode-managed sockets dir 下、不能是任意路徑
  - container 路徑必須是 `/run/<name>` 慣例（IPC dir 標準位置）
  - 不含資料 flags
- 任何違反這些條件的 bind mount 仍被擋

實作上 lint 偵測順序：
1. 解析 `-v` / `--mount type=bind` 參數
2. 對每條 mount 套用 IPC exception 正則檢查
3. 全部通過例外 → allow；任一條不符例外 → reject `bind_mount_forbidden`，errorBody 含 evidence

### DD-14：localhost binding 等價語意

**Decision**：Unix socket 天然只能同機連、檔案權限再做 uid 隔離。等同先前「localhost-only」的安全保證、且更強。
**Rationale**：socket 沒有網路層、沒有 spoof 攻擊面。docker 將 socket dir 掛進容器後，容器內 socket 也只能容器內進程連。雙向都被同機 uid 限定。

### DD-15：Per-user docxmcp container model（多 user 隔離，2026-05-03 拍板）

**Decision**：每個 system user 跑自己的 docxmcp container；socket 路徑用 XDG runtime dir，跟 opencode daemon 對齊：

```
/run/user/${UID}/opencode/sockets/docxmcp/docxmcp.sock
```

docker compose 用 `-p docxmcp-${USER}` 的 project name 避免容器名衝突；bind mount：

```yaml
volumes:
  - "/run/user/${UID}/opencode/sockets/docxmcp:/run/docxmcp"
```

mcp-apps.json url：

```
unix:///run/user/<uid>/opencode/sockets/docxmcp/docxmcp.sock:/mcp
```

opencode daemon 啟動時用自己 uid 解析 url 中的 `<uid>` 動態值（或寫死當前 user 的 uid，每個 user 有自己的 mcp-apps.json）。

**Rationale**：
- 跟 opencode 既有 per-user daemon 模型（`/run/user/<uid>/opencode/daemon.sock`）對齊
- 三層隔離：uid 不同 + dir 0700 + sock 0600
- container 跟 user lifecycle 同步：user 登出 → `/run/user/<uid>` 自動清 → 容器 socket 失效
- compose project name 自動避免容器名衝突
- 6 user × 50MB Python 約 300MB RSS，可接受

**前提**：所有需要用 docxmcp 的 user 必須在 `docker` group（能跟 docker daemon 對話）。系統管理員一次性執行 `usermod -aG docker <user>` 補齊。

**Cache 跨 user 共享**：named volume `docxmcp-cache` 是 docker 層級、所有 container 共用 → user A 算過的 sha，user B 上傳同 sha 時 cache 命中（不浪費計算成果原則）。如要嚴格 per-user cache 隔離，可改為 `docxmcp-cache-${USER}`（v2 視需要）。

**Out of scope**：system-level docxmcp service（root-launched 對外服務）— 屬未來 spec，本 spec 不處理。

### DD-16：Streamable HTTP framing 保留，跑在 UDS 上

**Decision**（針對「放棄 http」的釐清，2026-05-03 拍板）：transport 仍走 MCP 標準 Streamable HTTP（2025-03-26 spec），底下載體從 TCP 換成 Unix domain socket。

```
docxmcp Python：uvicorn --uds /run/docxmcp/docxmcp.sock
opencode TS：fetch with `unix:` URL scheme（Bun 內建支援）
```

**為何保留 HTTP framing 而非自寫 raw JSON-RPC over UDS**：
- mcp Python SDK + TS SDK 內建 Streamable HTTP transport，零開發成本
- 跟 mcp 生態相容（其它 mcp client 將來如要連同台 docxmcp 也可走 same socket）
- HTTP overhead ~200 bytes / request 對大檔通信不痛
- 「放棄 http」的原意是放棄 TCP port，不是放棄協議框架

**為何仍合「放棄對外」原則**：socket 是 user-private、外部 process 連不到、跨機器更不可能。HTTP 在這條 socket 上純粹是內部 framing 約定、沒有對外服務含義。

### DD-17：System-level service 留未來

**Decision**：system-level docxmcp service（root-launched、跨 user 共用、可能對外）不在本 spec 範圍。

**Rationale**：使用者明示「將來要做 system level 對外服務那是另外的事」。本 spec 處理 per-user / 同機 / 內部 IPC 場景。對外服務牽涉 auth、TLS、跨機器 token、租戶隔離等，明顯不同問題域。

### DD-13：bind mount lint guard

**Decision**：opencode `McpAppStore.addApp` 加 lint：command 含 `-v` / `--mount type=bind` 直接 reject、回 `bind_mount_forbidden` 錯誤碼。

**Rationale**：register API 是攻擊面入口；lint 在這一層擋住所有「之後再加 bind mount」的可能。比 audit-after-the-fact 強。

## Risks / Trade-offs

| # | 風險 | 影響 | 緩解 |
|---|---|---|---|
| RK-1 | docxmcp container 啟動 race（HTTP server 還沒 ready 時 opencode 已連） | 中 | docker compose health check `curl /healthz`；opencode 連線 retry 3 次 1s 間隔 |
| RK-2 | bundle base64 大訊息卡 mcp client（docxmcp 50MB+ 簡報） | 中 | DD-10 註明；planned 階段加 size threshold 切換到 token-based 二次 GET |
| RK-3 | docker compose service 死了不重啟 | 高 | `restart: unless-stopped` + healthcheck；opencode 偵測 connection lost 觸發 reconnect 流程 |
| RK-4 | named volume 容量爆 | 中 | LRU + size cap；docxmcp 內嵌定期清理 background task |
| RK-5 | mcp-apps.json 手動編輯繞過 lint 重新加 bind mount | 中 | `audit-bind-mounts` endpoint 定期掃；TUI / web UI 顯示警告 |
| RK-6 | wrapper 在 docxmcp container 沒啟動時呼叫導致 confusing error | 低 | wrapper 第一步 `docker inspect` 容器存在 → 不在則明確訊息 + 提示 `docker compose up -d` |
| RK-7 | starlette streaming 與 mcp protocol 訊息混線（同一 ASGI app 同時跑 /mcp 與 /files）| 低 | 不同 endpoint 走獨立 handler；mcp 走 chunked SSE、files 走 multipart；驗證階段壓測並行請求 |
| RK-8 | 一次性 cutover 萬一炸了無 stdio 反向相容路徑 | 中 | implementing 前最後一步前 git tag `pre-http-transport-cutover`；炸了 git revert + daemon restart |

## Critical Files

### docxmcp 端

新增 / 重構：
- `bin/mcp_server.py` — 既有有 `--transport http`，擴 starlette routes：加 `/files` (POST/GET/DELETE)、`/healthz`
- `bin/_mcp_registry.py` — 21 支 ToolSpec 從 `source/doc_dir` schema 改為 `token` schema、`build_argv` 內部解 token → path
- 新增 `bin/_token_store.py` — TTL+LRU+size-cap token table；ephemeral fs ops in `/tmp/docxmcp-sessions/`
- 新增 `bin-wrappers/<toolname>` × 21（shell 腳本）
- 新增 `install.sh` — 把 `bin-wrappers/*` 連結到 `~/.local/bin/docxmcp-tools/`
- `Dockerfile` — 移除 `EXPOSE 8080` 之外的 mount 假設；`/tmp` 規劃；可選 named volume mount point
- `docker-compose.yml` — 移除所有 `-v <host>:<container>`；保留 `docxmcp-cache:/var/cache/docxmcp` named volume；加 healthcheck
- `mcp.json` — 改為 URL 形式

### opencode 端

新增 / 重構：
- `packages/opencode/src/mcp/index.ts` — 加 `StreamableHTTPClientTransport` per-app switch；`McpAppStore` add lint guard for bind mount
- `packages/opencode/src/incoming/dispatcher.ts` — **大改**：刪除所有 `staging-mount`、`hard-link`、`break-on-write` 邏輯；新增 HTTP uploader 路徑
- `packages/opencode/src/incoming/index.ts` — 移除 `maybeBreakIncomingHardLink`、`IncomingDispatcher.breakHardLinkBeforeWrite` exports
- `packages/opencode/src/tool/edit.ts`、`tool/write.ts` — 拿掉 `maybeBreakIncomingHardLink` 呼叫
- `packages/opencode/src/server/routes/mcp.ts` — `addApp` 路徑加 lint check（DD-13）；新增 `GET /store/audit-bind-mounts`
- 移除 `packages/opencode/test/incoming/dispatcher.test.ts` 中 hard-link / break-on-write / cross-fs 相關 test cases；新增 HTTP uploader test cases

### docs

- `specs/architecture.md` 「Incoming Attachments Lifecycle」段落更新：bind mount 模型 → HTTP transport 模型；加 cross-cutting bind-mount-ban 政策
- `specs/_archive/repo-incoming-attachments/design.md` DD-3/5/11/15/16 inline-delta SUPERSEDED → 指向本 spec
- docxmcp `HANDOVER.md` 「不要重新討論」段：bind mount 那條改寫為「絕禁，HTTP+token」、加新一條「兩層 surface」、DD-16 manifest 段落 SUPERSEDED（容器自管 cache）

## Cross-Cut Concerns

- **Observability**：`docxmcp.http.upload` `docxmcp.http.tool-call` `docxmcp.http.token-eviction` 三個 metric；opencode 端 `mcp.dispatcher.http-upload-failed` event
- **Backward compat**：無。一次性 cutover
- **Security**：bind mount lint at register API + audit endpoint；docxmcp HTTP 只 bind 127.0.0.1（DD-12）

## Open Questions

planned 階段收斂：

- **OQ-1**：✅ 收斂為 DD-10（base64 in tool result）。v2 視大檔頻率改 token-based
- **OQ-2**：compose health check 細節（curl path、interval、retries） — planned 階段定 docker-compose.yml 細節
- **OQ-3**：✅ 收斂為 DD-5（named volume cache）
- **OQ-4**：✅ 收斂為 DD-3（`tok_<base32 20-byte>`）
- **OQ-5**：✅ 收斂為 DD-12（localhost-only，no auth v1）
- **OQ-6**：✅ 收斂為 DD-11（starlette `request.stream()` chunked）
- **OQ-7**：planned 階段定 — 是否走 `repo-incoming-attachments` revise 模式 vs 純 inline-delta；目前傾向 inline-delta（避免狀態機複雜化、本 spec 自我交叉引用即可）
- **OQ-8（NEW）**：bin-wrappers 是否需要 generate-on-demand（從 docxmcp 容器 `tools/list` 動態生）vs 出貨時手寫 21 支。手寫易維護、生成隨工具集自動同步。傾向 v1 手寫 21 支
- **OQ-9（NEW）**：`audit-bind-mounts` endpoint 是否在 web/TUI 顯示警告 banner — UX 設計留 implementing 階段
