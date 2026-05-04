# Proposal: docxmcp-http-transport

## Why

- 使用者明確拒絕 bind mount 作為 mcp container 與 host 之間的檔案傳遞機制：「**絕不接受 bind mount 這種界線不清的行為**」「**A 才是長遠正解，對全世界都通用**」。
- bind mount 的本質是「在乾淨的容器邊界上戳一個洞」— host 寫檔容器即時看見、容器寫檔 host 即時看見、共享同一 inode。這個耦合違反容器的安全/隔離初衷。dispatcher 之所以需要 break-on-write、hard-link 偵測、EXDEV fallback 等補丁，根源都是 bind mount 這條洞。
- 既有 `specs/_archive/repo-incoming-attachments/` DD-3「mcp 容器只 mount `/state`」DD-5「staging 路徑通用化」DD-11「hard-link + break-on-write」DD-15「EXDEV cross-fs fallback」DD-16「manifest sha integrity」全部圍繞 bind mount 機制建構。設計目標（檔案歸位 repo / 跨 session cache / 容器邊界乾淨）正確，但**機制錯了**。
- 業界 path-based MCP server 都用 bind mount，因為「path-based tool API + 同機 docker」是最便宜的 IPC。但這是經濟學妥協，不是設計正解。長遠視角：mcp server 必須能跨機器部署、必須容器邊界回歸 docker 預設零信任、必須 mcp.json 不寫死 host path。HTTP transport + token API 是滿足這三條的唯一路。

## Original Requirement Wording (Baseline)

> 絕不接受 bind mount 這種界線不清的行為。

> A 才是長遠正解，對全世界都通用。

> 不然就整個檔案實體傳進去呀

> mcp 是 docker 執行的，不能直接給他系統路徑。可以用 curl post 呀。檔案大小可以用 tar ball pipe 過去嗎

> C 也可以做。但我很困惑為什麼堅持要 base64。不能自動壓成 tar ball 嗎

## Requirement Revision History

- 2026-05-03 初稿（mode `new`）— 自市場調查與容器邊界討論結論收斂：bind mount 不可接受、HTTP+token 為長遠正解。
- 2026-05-03 補充（同日）— 釐清 base64 / tarball 誤會：A (HTTP multipart) 走 raw binary、不需 base64；base64 只在「JSON 內塞 binary」（B/C 路線）才必要。docx 已是 zip，再 tar.gz 無壓縮收益。確認 A 路線採 multipart/binary（raw bytes）作為主上傳通道。
- 2026-05-03 補充（同日）— 雙層 surface 確認：docxmcp repo 內含「Docker 內層」（既有 Python CLI + MCP server）+「非 Docker 表層」（shell wrappers，調用 docker cp + docker exec，由 docxmcp `install.sh` 安裝）。AI 一律走 HTTP MCP（本機與遠端統一）；wrapper 是給 CLI 使用者 / ops / 腳本的便利層、不進 opencode 的 AI 工具表。
- 2026-05-03 補充（同日）— 改用 Unix domain socket 取代 TCP port：因 port 8080 在多 project dev 機災區、TCP localhost binding 不夠強。bind mount 禁令收緊為「**資料目錄禁、IPC rendezvous dir 例外允許**」。DD-12 改寫、DD-13 lint 加 IPC exception 條款。socket 路徑：host `~/.local/state/opencode/sockets/<app>/` ↔ container `/run/<app>/`，dir 0700 + sock 0600 做存取控制。

## Two-Layer Surface

docxmcp repo 從本 spec 起明確區分兩層 surface：

```
docxmcp repo/
├── Docker 內層（既有，與 mcp 相關）
│   ├── Dockerfile              ← 不掛任何 host path
│   ├── docker-compose.yml      ← service 永駐、無 -v
│   ├── bin/*.py                ← 21 支 Python CLI（不動）
│   └── bin/mcp_server.py       ← HTTP MCP server + token API
│
├── 非 Docker 表層（新加）
│   ├── bin-wrappers/           ← shell wrappers 給 CLI 使用者
│   │   ├── extract_text        ← 內部呼叫 docker cp + docker exec
│   │   ├── extract_outline
│   │   └── ...（共 21 支）
│   └── install.sh              ← 把 bin-wrappers 安裝到 ~/.local/bin/docxmcp-tools/
│
└── mcp.json                    ← URL 形式（http://127.0.0.1:8080/mcp）
```

**AI 路徑單一**：opencode 一律走 HTTP MCP，無論本機或遠端。HTTP localhost loopback round-trip < 1ms，不比 docker exec 慢，不需要為了「省一條 round-trip」維護兩條 AI 路徑。

**Wrapper 用途**：純粹給 CLI 使用者（人類、腳本、ops）方便使用 — `extract_text foo.docx` 比 `docker cp foo.docx docxmcp:/tmp/x && docker exec docxmcp /app/bin/extract_text.py /tmp/x && docker exec docxmcp rm /tmp/x` 簡潔。**不進** opencode 的 AI 工具表。

## Effective Requirement Description

1. docxmcp container 啟動時**不掛載任何 host filesystem**（無 `-v`、無 named volume mount 進 host path）。容器邊界回歸 docker 預設「自閉沙盒」。
2. docxmcp 以 HTTP server 形式長駐（`docker compose up -d`），而非 per-call stdio。對外 endpoint 至少包含：
   - `POST /files`：**multipart/binary** 接檔（raw binary，不經 base64 編碼），回 `{ token, sha256, size }`
   - `GET /files/{token}`：可選，下載已上傳的檔案（debug / verify 用）
   - `DELETE /files/{token}`：清除特定 token
   - 既有 MCP `/mcp` endpoint（已實作，phase E）：tool 呼叫走 Streamable HTTP
3. docxmcp **所有 21 支 tool API 改吃 token**（取代現行 `source: <path>` / `doc_dir: <path>`）。tool 內部解 token → 容器自管的 ephemeral 檔案路徑（容器內部 `/tmp/docxmcp-sessions/<token>/<filename>`）→ 既有 Python CLI 邏輯不動。
4. opencode mcp client 切換為 `StreamableHTTPClientTransport`（mcp SDK 已支援）。dispatcher 重構為「HTTP uploader」：
   - 接到含 repo path 的 tool args → 用 multipart POST 把檔案 raw 上傳到 docxmcp `/files` 取 token → 將 args 中的 path 替換為 token → 走 mcp `tools/call` 把 rewritten args 送 docxmcp
   - 結果回來的 token / 檔案 reference → opencode 視需要 fetch（多數情況：bundle 結果 docxmcp 直接 base64 in tool result，opencode 寫到 repo `<sourceDir>/<stem>/`；OQ-1 要決定是否走 token-based 二次 fetch）
5. 既有 `repo-incoming-attachments` 的 repo 落地、履歷、attachment_ref repo_path 渲染**完全保留**。被 supersede 的只有 bind mount 機制部分（DD-3 / DD-5 / DD-11 / DD-15 / DD-16 + dispatcher 的 staging-mount 程式碼）。
6. mcp.json / mcp-apps.json 內容簡化為純 URL 連線資訊；不含 `-v`、不含 host path。

## Scope

### IN
- docxmcp Python（Docker 內層）：新 `POST /files` `GET /files/{token}` `DELETE /files/{token}` route；container-internal session storage（`/tmp/docxmcp-sessions/`）+ TTL 清理；21 支 tool 的 mcp wrapper schema 從 `source: path` 改為 `token: string`；既有 CLI（`bin/*.py`）保持不動
- docxmcp Dockerfile：移除 `/state` 假設；確認 stateless container（重啟丟所有 token）
- docxmcp `docker-compose.yml`：service 永駐（`restart: unless-stopped`），`-p 127.0.0.1:8080:8080` bind localhost；無 `-v` 任何 host path
- docxmcp 非 Docker 表層（**新**）：`bin-wrappers/<toolname>` shell 腳本 21 支，內部 `docker cp + docker exec + cleanup` 三段式；`install.sh` 把 wrappers 鋪到 `~/.local/bin/docxmcp-tools/` 並更新 PATH 提示
- opencode `mcp-apps.json`：docxmcp entry 改為 URL transport（`http://127.0.0.1:8080/mcp`）
- opencode mcp client（`packages/opencode/src/mcp/index.ts`）：`StdioClientTransport` 與 `StreamableHTTPClientTransport` per-app 分支，目前只 docxmcp 走 HTTP，其它 mcp app 仍走 stdio
- opencode dispatcher（`packages/opencode/src/incoming/dispatcher.ts`）：刪 staging-mount + bind-mount 邏輯；新增 HTTP upload + token rewrite path
- 移除 break-on-write helper（DD-11）、cross-fs fallback（DD-15）、host-side manifest sha integrity check（DD-16）— 改由 docxmcp 容器自管（容器內 cache 是它家事）
- 跨 spec：`repo-incoming-attachments/design.md` DD-3 / DD-5 / DD-11 / DD-15 / DD-16 標 SUPERSEDED → 指向本 spec；DD-1 / DD-2 / DD-6 / DD-7 / DD-8 / DD-12 / DD-13 / DD-14 / DD-17 保留
- 跨 spec：opencode `incoming/` 模組的 paths / history / sanitize / rotate 全保留（與 transport 解耦）

### OUT
- 其它 mcp app（gmail / google-calendar / system-manager 等）的 transport 不動，仍走 stdio。本 spec 範圍僅限 docxmcp
- 跨機器部署 / Cloud Run / k8s 的具體部署 stack — 本 spec 只確保**架構上**支援，實際部署留 ops
- docxmcp Python 的 CLI 介面（`bin/*.py` argparse）不動，避免動到 21 支腳本內部
- 既有 stdio + bind-mount 部署的反向相容：一次性切換、不保留回退路徑
- mcp Resources protocol（B 路徑）— 雙向 mcp 成本高、訊息走 base64 有 buffer 限制問題，否決
- C 路徑（content in args）— 同樣踩 JSON 訊息上限，否決
- A2 路徑（docker exec + tar pipe 取代 mcp）— 不是 mcp 協議的一部分、跨機器不通、container 名不穩定，否決
- bin-wrappers 進入 opencode AI 工具表 — wrapper 純給 CLI 人類使用者，AI 統一走 HTTP MCP（loopback < 1ms 無延遲劣勢、避免「同一工具兩個入口」工具表混亂）
- ssh-based 通道 — 額外的 sshd 安裝 + key 管理開銷，docker exec 已涵蓋本機需求、HTTP MCP 已涵蓋遠端需求，否決

## Non-Goals

- 把 opencode 所有 mcp app 統一遷移到 HTTP — 只動 docxmcp 一個
- 在 docxmcp 內實作 user 認證 / 多租戶 — 容器假設 localhost 信任邊界，鎖 `127.0.0.1:8080`
- 處理 token 跨 docxmcp container 重啟保活 — token TTL = container lifetime；容器死 token 全清
- 大檔（>1GB）支援 — multipart 雖然 stream OK 但 docxmcp 內部處理大檔記憶體用量不在本 spec 範圍

## Constraints

- docxmcp container 啟動到 `/files` accepting requests < 5s（compose `restart: unless-stopped` 接受）
- POST /files 大檔上傳支援 streaming multipart（Python `starlette` `request.stream()`），避免一次性吃進記憶體
- token 為 cryptographically random，無法被 brute-force（OQ-4 待定 format）
- container 重啟後所有 in-flight tool call 應失敗並產生明確錯誤訊息（`token_not_found: container restarted`），讓 opencode 重新 upload+ retry
- bind mount **絕對禁止**重新導入；容器啟動 inspect 時 `Mounts` 應為空（除了可選的 named volume for bundle cache）
- docxmcp 容器內 session storage 不能無限長大：`/tmp/docxmcp-sessions/` 加 TTL（預設 1h idle）+ size cap（預設 1 GB total）+ LRU eviction
- 此 spec 設計時假設 docxmcp HTTP server **單機 single container**。多 replica（token 同步、共享 storage）超出本 spec

## What Changes

| 面向 | 從 | 到 |
|---|---|---|
| docxmcp 容器啟動 | `docker run -i -v ~/.local/state/.../mcp-staging:/state docxmcp:latest` per-call | `docker compose up -d` 永駐、無 host path mount |
| docxmcp transport | stdio | HTTP (Streamable HTTP, MCP 2025-03-26) |
| docxmcp tool args | `{source: "incoming/foo.docx"}` | `{token: "tok_abc...XYZ"}` |
| docxmcp 容器邊界 | mount `/state` | 完全自閉，無 host fs |
| 上傳通道編碼 | filesystem hard-link | **multipart/binary raw bytes** — 不需 base64 編碼 |
| opencode mcp client | StdioClientTransport | StreamableHTTPClientTransport（per-app）|
| dispatcher.before | host stage to `/state/staging/<sha>.<ext>` | `POST /files` (multipart) → 收 token → rewrite args |
| dispatcher.after | hard-link `/state/bundles/<sha>/` → `<sourceDir>/<stem>/` | 視 docxmcp tool result 而定（OQ-1）：base64 blob in result vs 二次 token fetch |
| `mcp.json / mcp-apps.json` | 含 `-v` 與 host path | 純 URL `http://127.0.0.1:8080/mcp` |
| 跨 session sha cache | host `mcp-staging/<app>/bundles/<sha>/` | docxmcp 容器自管 named volume `docxmcp-cache:/var/cache/docxmcp/bundles/<sha>/` — host 看不到內容（DD 待定） |

## Capabilities

### New Capabilities

- `docxmcp.http-transport`：Streamable HTTP MCP transport
- `docxmcp.token-api`：content-addressed token-based file API (POST/GET/DELETE /files)
- `docxmcp.container-internal-cache`：容器自管 bundle cache，host 看不到
- `opencode.mcp.streamable-http-client`：per-app mcp transport switch
- `opencode.dispatcher.http-uploader`：multipart upload 取代 bind-mount staging

### Modified Capabilities

- `repo-incoming-attachments` 的 dispatcher 從「staging-mount manager」變「HTTP uploader」
- `repo-incoming-attachments` DD-3 / DD-5 / DD-11 / DD-15 / DD-16 部分或全部 SUPERSEDED（細節見 design.md）

### Removed Capabilities

- bind-mount staging（`mcp-staging/<app>/staging/`）
- hard-link cross-session cache on host（`mcp-staging/<app>/bundles/`）
- break-on-write helper / nlink>1 detach
- EXDEV cross-fs fallback
- host-side manifest.json integrity check（容器自管）

## Impact

- **影響的程式碼（opencode）**
  - `packages/opencode/src/mcp/index.ts` — 加 transport switch；docxmcp 走 HTTP
  - `packages/opencode/src/incoming/dispatcher.ts` — **大改** stage-to-mount → multipart POST /files
  - `packages/opencode/src/incoming/index.ts` — 移除 break-on-write helper exports
  - `packages/opencode/src/tool/edit.ts` `write.ts` — 移除 `maybeBreakIncomingHardLink` 呼叫（不再需要）
  - `~/.config/opencode/mcp-apps.json` — docxmcp entry 改 HTTP URL

- **影響的程式碼（docxmcp）**
  - `bin/mcp_server.py` — HTTP route 加 file API；既有 `--transport http` 已有 ASGI app，擴 routes
  - `bin/_mcp_registry.py` — 21 支 tool spec 的 input_schema 與 build_argv 從 `source` 改 `token`；wrapper 內部 `tokenStore.resolve(token)` 取 path
  - 新增 `bin/_token_store.py`（暫名）— in-memory token table + ephemeral filesystem under `/tmp/docxmcp-sessions/<token>/<filename>`，含 TTL + LRU
  - `Dockerfile` — 移除 `/state` 假設；`/tmp` 空間規劃；可選 named volume for bundle cache
  - `docker-compose.yml` — 拿掉 `-v` host path mount；只留 ports + restart policy

- **影響的 docs**
  - `specs/architecture.md` 「Incoming Attachments Lifecycle」段落更新：bind-mount → HTTP transport
  - `specs/_archive/repo-incoming-attachments/design.md` DD-3/5/11/15/16 標 SUPERSEDED → 指向本 spec
  - docxmcp `HANDOVER.md`「不要重新討論」段：bind mount 那條改寫；「Bundle manifest.json」DD-16 段落 SUPERSEDED（容器自管）

- **影響的使用者**
  - 不可見：repo `incoming/` 行為不變、AttachmentRefPart 仍含 repo_path、AI 工具呼叫流程從 LLM 角度看一致
  - 可見：daemon log service tag 多 `incoming.dispatcher.http`；docker compose 多一個常駐 container（`docxmcp-http`）

- **遷移**
  - 一次性切換。daemon restart + docxmcp HTTP container up = 新流程立刻生效
  - mcp-apps.json 改寫即生效；舊 stdio entry 直接刪
  - 既有 `~/.local/state/opencode/mcp-staging/` 內容由使用者執行清理腳本，本 spec 不主動刪

## Decisions Locked-in (v1 baseline)

| # | 決定 | 細節 |
|---|---|---|
| A | Transport | Streamable HTTP (MCP 2025-03-26 spec) |
| B | File API | `POST /files` (multipart/binary，raw bytes 不編碼) → `{token, sha256, size}`；`GET /files/{token}`；`DELETE /files/{token}` |
| C | Token format | cryptographically random，opaque（不暴露 sha 或檔名）|
| D | Container session storage | `/tmp/docxmcp-sessions/<token>/<filename>` + TTL 1h + 1GB cap + LRU |
| E | Bundle cache | docxmcp 容器自管 named volume `docxmcp-cache:/var/cache/docxmcp/bundles/<sha>/`；可選；container 重啟 token 全清，但 sha cache 保留 |
| F | mcp-apps.json 形式 | URL only，無 host path、無 `-v` |
| G | Per-app transport switch | opencode mcp client 依 manifest 決定（docxmcp HTTP，其它仍 stdio）|
| H | Bind mount 禁令 | 容器啟動 `docker inspect <container> --format '{{.Mounts}}'` **資料目錄 bind mount 必須空**。IPC rendezvous dir bind mount 例外允許（窄條件：host 路徑符合 `~/.local/state/opencode/sockets/<app>/`、container 路徑 `/run/<app>/`、無資料 flags）。docker named volume 限定 `<app>-cache` 形式（DD-5）|
| I | Cutover policy | 一次性切換；不保留 stdio 反向相容路徑 |
| J | 上傳編碼 | multipart/binary raw bytes，**不**用 base64、**不**用 tar.gz（docx 已是 zip 無收益）|
| K | docxmcp repo 兩層 surface | Docker 內層（CLI + MCP server）+ 非 Docker 表層（bin-wrappers shell 腳本給 CLI 使用者）|
| L | wrapper 對 AI 不可見 | AI 一律走 HTTP MCP；wrappers 只給 CLI / ops / 腳本，避免工具表雙重入口 |
| M | wrapper 安裝路徑 | `install.sh` 把 `bin-wrappers/*` 鋪到 `~/.local/bin/docxmcp-tools/`，使用者自決加 PATH |
| N | Transport 走 Unix socket | host `/run/user/${UID}/opencode/sockets/docxmcp/docxmcp.sock` ↔ container `/run/docxmcp/docxmcp.sock`，dir 0700 + sock 0600。零 TCP port 衝突、檔案權限做 uid 隔離 |
| O | bind mount lint IPC 例外 | host 路徑符合 `^/run/user/\d+/opencode/sockets/[a-z0-9-]+/?$` AND container 路徑符合 `^/run/[a-z0-9-]+/?$` 才放行；其餘一律 reject（DD-13）|
| P | Per-user container model | 每個 system user 跑自己的 docxmcp container；compose project name `docxmcp-${USER}`；socket 在 XDG runtime dir；前提是所有要用的 user 在 `docker` group（DD-15）|
| Q | Streamable HTTP framing 保留 | mcp 標準 Streamable HTTP transport 跑在 UDS 上、不走 TCP。「放棄 http」是放棄 port，不是放棄協議（DD-16）|
| R | System-level service 留未來 | root-launched / 對外服務超出本 spec 範圍（DD-17）|

## Open Questions（待 designed 階段收斂）

- **OQ-1**：bundle 結果回傳格式 — base64 包進 tool result（單 round-trip 但訊息大）vs 留容器內 → 回另一 token → opencode 二次 GET（雙 round-trip 但訊息小）
- **OQ-2**：opencode 端是否需要 fallback 處理「docxmcp HTTP container 還沒起來」的啟動 race（compose health check + retry policy）
- **OQ-3**：docxmcp container 內 cache 跨容器重啟保活 — named volume vs 純 ephemeral
- **OQ-4**：token 命名規格（前綴、長度、編碼）— `tok_<base32>` 或 UUIDv7 或 sha256-prefix
- **OQ-5**：是否在 docxmcp HTTP server 加 minimal auth（`X-MCP-Token: <shared-secret>`）— localhost 信任邊界下可選
- **OQ-6**：multipart/binary 上傳的大檔 streaming 細節（Python starlette `request.stream()` 用法 + 100MB+ 處理）
- **OQ-7**：是否需要 `repo-incoming-attachments` spec 額外開一條 `revise` mode 把 DD-3/5/11/15/16 標 SUPERSEDED — 還是本 spec 自己交叉引用就好

## Cross-Cutting Security Policy: Bind Mount 全面禁令

**從本 spec 起 bind mount 升級為 opencode mcp 生態的安全紅線**，不限於 docxmcp。

**Trigger**：使用者明示「**事情完成之後要清查所有其他 mcp，不准有 bind mount 這種糾纏不清的行為。資安漏洞**」

**規範**：
- 所有 mcp-apps.json 內的 docker-based entry，`command` 不得包含 `-v <host-path>:<container-path>`、`--mount type=bind,src=<host>,dst=<container>` 或同義形式
- 違規 entry 必須：(a) 改走 HTTP MCP transport（本 spec 為標準範本）+ HTTP file API；(b) 改走 docker-managed named volume（host 不可見）；(c) 否則從 mcp-apps.json 移除
- 新加 mcp-app 時，daemon 啟動 / mcp-app register 流程加一條前置檢查：偵測到 bind mount 直接 reject + 結構化錯誤訊息引用本政策

**Follow-up scope（不在本 spec 範圍）**：
- 本 spec 落地後（state=living），開**新 spec** `mcp-bind-mount-audit-purge` 處理：
  1. 掃 `~/.config/opencode/mcp-apps.json` + `/etc/opencode/mcp-apps.json` 所有 entries
  2. 對每個 docker-based entry 列出實際 `Mounts` 結構（`docker inspect`）
  3. 違規清單 → 逐一遷移或移除
  4. 在 `~/.config/opencode/mcp-apps.json` schema 與 register API 端加入 lint check：寫入時發現 bind mount → reject

**為什麼是資安問題**：
- bind mount = host 在容器邊界戳洞、共享 inode
- 容器若被攻陷，hard-link、symlink、追蹤 inode 等手法可透過 mount 點影響 host 檔案系統
- DD-11 break-on-write / DD-15 EXDEV fallback 等是**症狀補丁**，不是根本解；只要 bind mount 存在，攻擊面就在
- 統一走 HTTP MCP + token API：容器邊界回歸 docker 預設零信任、host fs 完全不暴露

## Cross-Spec Relationship

- **Supersedes parts of `specs/_archive/repo-incoming-attachments/`**：DD-3 (mcp container only sees `/state`)、DD-5 (staging dir generic)、DD-11 (hard-link + break-on-write)、DD-15 (EXDEV fallback)、DD-16 (manifest.json integrity)。對應 phase 3 dispatcher 大部分邏輯撤除
- **Preserves**：DD-1 (fail-fast on no project)、DD-2 (jsonl history)、DD-6 (drift detection)、DD-7 (currentSha)、DD-8 (conflict-rename)、DD-12 (filename sanitize)、DD-13 (jsonl rotate)、DD-14 (result path rewriting — 仍然需要把 docxmcp 回的 path normalized)、DD-17 (AttachmentRefPart with repo_path)
- **Migration timing**：本 spec promote 到 `living` 同時，回頭去 `repo-incoming-attachments/design.md` 標記被 SUPERSEDED 的 DD 與 inline-delta 註記
