# Spec: docxmcp-http-transport

行為規格。每條 Requirement 含一條以上 Scenario（GIVEN/WHEN/THEN）。Acceptance Checks 是必要驗收條件，逐條對應到 `test-vectors.json`（在 planned 階段定稿）。

---

## Purpose

把 docxmcp 與 host 的耦合從 docker bind mount 切換為 HTTP transport + content-addressed token API。容器邊界回歸 docker 預設零信任、檔案傳遞走 multipart raw bytes、本機與遠端 AI 路徑統一。docxmcp repo 同時生出非 Docker 表層（bin-wrappers）給 CLI 使用者。Bind mount 升級為跨 mcp 生態安全紅線。

---

## Requirements

### Requirement: R1 docxmcp 容器 mount 邊界（資料 bind mount 全禁、IPC dir 例外）

docxmcp container 啟動時掛載列表中：**資料目錄 bind mount 必須空**；只允許 (a) `docxmcp-cache` named volume、(b) IPC rendezvous dir bind mount（host `~/.local/state/opencode/sockets/docxmcp/` ↔ container `/run/docxmcp/`，dir 內僅 socket inode、無資料）。

#### Scenario: R1-S1 容器 inspect 確認 mount 規範

- **GIVEN** docxmcp 透過 docker compose 啟動
- **WHEN** 執行 `docker inspect <docxmcp-container> --format '{{range .Mounts}}{{.Type}}:{{.Source}}->{{.Destination}}{{"\n"}}{{end}}'`
- **THEN** 所有 `bind:` type entry 必符合 IPC 例外（host source 在 `~/.local/state/opencode/sockets/<app>/`、container target 在 `/run/<app>/`）
- **AND** `volume:` entry 僅限 `docxmcp-cache`（DD-5）
- **AND** 完全沒有 bind mount Source 指向 user repo / `/home/`、`/Users/`、`/etc/`、`/var/lib/` 等資料目錄

#### Scenario: R1-S2 IPC dir 內容物審計

- **GIVEN** docxmcp container 已運行（user pkcs12，uid 1000）
- **WHEN** `ls -la /run/user/1000/opencode/sockets/docxmcp/`
- **THEN** 只有 `docxmcp.sock`（type s, mode 0600）
- **AND** dir mode 為 0700
- **AND** 沒有任何 regular file、symbolic link、或其它類型 inode

#### Scenario: R1-S3 Per-user container 隔離

- **GIVEN** user pkcs12（uid 1000）與 user cece（uid 1003）都跑自己的 docxmcp
- **WHEN** 各自 `docker compose -p docxmcp-${USER} up -d`
- **THEN** 兩個 container：`docxmcp-pkcs12-docxmcp-1`、`docxmcp-cece-docxmcp-1`
- **AND** pkcs12 的 socket 在 `/run/user/1000/opencode/sockets/docxmcp/docxmcp.sock`
- **AND** cece 的 socket 在 `/run/user/1003/opencode/sockets/docxmcp/docxmcp.sock`
- **AND** 兩個 socket file mode 0600 owner 為對應 uid
- **AND** pkcs12 進程**無法**連到 cece 的 socket（檔案權限拒絕）

### Requirement: R2 HTTP file API（multipart raw upload）

docxmcp HTTP server 暴露 `POST /files` 接 multipart/binary，回 token；`GET /files/{token}`、`DELETE /files/{token}` 對稱存在。

#### Scenario: R2-S1 上傳 docx 取 token

- **GIVEN** docxmcp 在 `127.0.0.1:8080` 運行、token store 空
- **WHEN** client 對 `POST /files` 發 multipart 包含 `field=file, filename=合約.docx, body=<raw docx bytes>`
- **THEN** server 回 200 + JSON `{ token: "tok_<32-char base32>", sha256: "<hex>", size: <int> }`
- **AND** token 是 cryptographically random，每次不同
- **AND** server 把 bytes 寫到 `/tmp/docxmcp-sessions/<token>/合約.docx`（容器內）
- **AND** 上傳訊息**不經 base64**（驗證方式：上傳 50 MB 檔測 wall-clock 與 raw size 比例）

#### Scenario: R2-S2 token 回讀

- **GIVEN** R2-S1 完成
- **WHEN** client 對 `GET /files/{token}` 取檔
- **THEN** 回 200 + body 等於原始 bytes（sha256 比對通過）

#### Scenario: R2-S3 token 失效時 tool call 報錯

- **GIVEN** docxmcp container 重啟、token store 已清空
- **WHEN** client 用舊 token 呼叫任一 tool（如 `extract_text`）
- **THEN** server 回 mcp tool error `token_not_found: <tok>; container restarted, please re-upload`

### Requirement: R3 21 支 mcp tool 改吃 token

所有原 `source: <path>` / `doc_dir: <path>` 參數改為 `token: <string>`。

#### Scenario: R3-S1 extract_text 接 token

- **GIVEN** R2-S1 上傳完成、token=`tok_xyz`
- **WHEN** client 對 `/mcp` 呼叫 `tools/call extract_text { token: "tok_xyz" }`
- **THEN** server 解析 token → `/tmp/docxmcp-sessions/tok_xyz/合約.docx` → 跑 `python /app/bin/extract_text.py` → 回工具 stdout
- **AND** 既有 `bin/extract_text.py` 程式碼**不動**（只動 mcp wrapper schema）

#### Scenario: R3-S2 token 不存在時 tool 報錯

- **GIVEN** token=`tok_invalid` 不在 store
- **WHEN** 任一 tool 帶該 token 呼叫
- **THEN** mcp result `isError: true`、錯誤訊息含 `token_not_found`

### Requirement: R4 opencode mcp client 切 HTTP transport

opencode 對 docxmcp 一律使用 `StreamableHTTPClientTransport`（per-app switch；其它 mcp app 保留 stdio）。

#### Scenario: R4-S1 docxmcp 走 HTTP 連線

- **GIVEN** mcp-apps.json 中 docxmcp entry 為 `{ url: "http://127.0.0.1:8080/mcp", transport: "streamable-http" }`
- **WHEN** opencode daemon 觸發 `connectMcpApps`
- **THEN** docxmcp 連線使用 `StreamableHTTPClientTransport`（不是 `StdioClientTransport`）
- **AND** 連線存活；`tools/list` 回 21 個工具

#### Scenario: R4-S2 其它 mcp app 仍走 stdio

- **GIVEN** gmail / google-calendar 等 entry 仍為 binary command 形式
- **WHEN** daemon 連線
- **THEN** 它們仍走 `StdioClientTransport`（per-app switch 沒影響它們）

### Requirement: R5 dispatcher 重構為 HTTP uploader

opencode `incoming/dispatcher.ts` 把 `before()` 從「stage 到 bind mount」改成「multipart POST /files → 取 token → 改寫 args」。

#### Scenario: R5-S1 incoming/foo.docx 上傳

- **GIVEN** AI 觸發 `extract_text incoming/合約.docx`
- **WHEN** dispatcher.before 執行
- **THEN** 對 docxmcp `POST /files` 上傳檔案
- **AND** 收到 `{token: "tok_abc"}`
- **AND** rewrittenArgs 為 `{token: "tok_abc"}`，不再含 `incoming/合約.docx` path
- **AND** **不**有任何 hard-link 寫入、**不**有 `mcp-staging/` 目錄被觸碰

#### Scenario: R5-S2 完成後清 token

- **GIVEN** mcp tool 跑完回結果
- **WHEN** dispatcher.after 處理結果
- **THEN** 對 `DELETE /files/{token}` 清掉 token（best-effort，失敗不阻擋）
- **AND** 容器內 `/tmp/docxmcp-sessions/<token>/` 在 server side 被清

### Requirement: R6 bin-wrappers 給 CLI 使用者，不進 AI 工具表

docxmcp repo 出貨 `bin-wrappers/<toolname>` shell 腳本 21 支，由 `install.sh` 鋪到 `~/.local/bin/docxmcp-tools/`。AI 工具表**不**含這 21 個 wrapper，AI 一律走 HTTP MCP。

#### Scenario: R6-S1 wrapper 直接呼叫

- **GIVEN** `install.sh` 已執行；PATH 含 `~/.local/bin/docxmcp-tools/`；docxmcp container 已啟動
- **WHEN** CLI 使用者執行 `extract_text /home/pkcs12/projects/foo/incoming/合約.docx`
- **THEN** wrapper 內部執行：
  1. `docker cp /home/pkcs12/projects/foo/incoming/合約.docx docxmcp:/tmp/incoming-<rnd>-合約.docx`
  2. `docker exec docxmcp python /app/bin/extract_text.py /tmp/incoming-<rnd>-合約.docx`
  3. `docker exec docxmcp rm -f /tmp/incoming-<rnd>-合約.docx`
- **AND** 終端輸出 docxmcp tool stdout
- **AND** 整段過程**不**經 host bind mount（docker cp 用 tar stream）

#### Scenario: R6-S2 wrapper 不在 AI 工具表

- **GIVEN** opencode daemon 已連 docxmcp HTTP
- **WHEN** AI 列出可用工具
- **THEN** 工具表含 `mcpapp-docxmcp_extract_text`（HTTP MCP）
- **AND** 工具表**不**含 `extract_text` 或任何 wrapper-only entry
- **AND** AI 沒辦法直接呼叫 wrapper（沒這條路）

### Requirement: R7 mcp-apps.json schema 改 URL

mcp-apps.json 中 docxmcp entry 完全不寫 host path、不寫 `-v`。

#### Scenario: R7-S1 entry 結構（Unix socket URL）

- **GIVEN** 切換完成
- **WHEN** 檢查 `~/.config/opencode/mcp-apps.json` 中 docxmcp entry
- **THEN** entry 為類似：
  ```json
  {
    "id": "docxmcp",
    "url": "unix:///run/user/1000/opencode/sockets/docxmcp/docxmcp.sock:/mcp",
    "transport": "streamable-http",
    "enabled": true,
    ...
  }
  ```
- **AND** url scheme 為 `unix://`，無 TCP port
- **AND** url 中的 uid 反映當前 daemon 的 user uid（每個 user 的 mcp-apps.json 各自寫各自的 uid）
- **AND** entry 可能含 docker compose 啟動命令的 reference（`source.path` 指向 docxmcp repo）

### Requirement: R8 跨 mcp 生態 bind mount 全面禁止（含 IPC 例外）

mcp-apps.json 寫入 / register API 加 lint：偵測到 docker `-v` / `--mount type=bind` 預設 reject。**例外**：host 路徑符合 `^${HOME}/.local/state/opencode/sockets/[a-z0-9-]+/?$` AND container 路徑符合 `^/run/[a-z0-9-]+/?$`、且無資料 flags 時放行（DD-13）。

#### Scenario: R8-S1 register API 拒絕資料目錄 bind mount

- **GIVEN** 使用者 / script 嘗試 `POST /api/v2/mcp/store/apps` 含 `command: ["docker","run","-v","/home/x:/y","..."]`
- **WHEN** opencode daemon 處理
- **THEN** 回 400 + 錯誤訊息 `bind_mount_forbidden: -v /home/x:/y violates data-dir bind mount ban (specs/docxmcp-http-transport)`
- **AND** mcp-apps.json **未被寫入**

#### Scenario: R8-S1b register API 接受 IPC dir bind mount

- **GIVEN** 使用者註冊新 mcp app 含 `command: ["docker","run","-v","/run/user/1000/opencode/sockets/myapp:/run/myapp","..."]`
- **WHEN** lint 檢查
- **THEN** 通過（符合 IPC exception 條件：host path `^/run/user/\d+/opencode/sockets/[a-z0-9-]+/?$` + container path `^/run/[a-z0-9-]+/?$`）
- **AND** mcp-apps.json 寫入

#### Scenario: R8-S2 既有 entry 掃描

- **GIVEN** 多個 mcp app 已註冊
- **WHEN** 執行健康檢查 `GET /api/v2/mcp/store/audit-bind-mounts`（本 spec 範圍只實作偵測，不主動修；purge 留 follow-up spec）
- **THEN** 回 JSON 列出含**非 IPC 例外** bind mount 的 app id（理想為空陣列）
- **AND** 符合 IPC 例外的 bind mount 不算違規（不出現在 violations）

### Requirement: R9 既有 repo-incoming-attachments 行為保留

opencode `incoming/` 模組 paths / history / sanitize / rotate 全保留。AttachmentRefPart 仍含 repo_path + sha256。

#### Scenario: R9-S1 上傳 docx 仍落 incoming/

- **GIVEN** opencode HTTP transport 切換完成
- **WHEN** 使用者拖 docx 進對話
- **THEN** 檔案仍寫到 `<repo>/incoming/<filename>`、history jsonl 寫一筆 upload entry
- **AND** AttachmentRefPart 仍含 `repo_path` + `sha256` 兩欄
- **AND** AI 仍能在訊息中看到 repo_path 路徑提示

#### Scenario: R9-S2 dispatcher 從 repo_path 上傳

- **GIVEN** AI 觸發 docxmcp tool
- **WHEN** dispatcher.before 執行
- **THEN** 從 `<repo>/<repo_path>` 讀檔 → multipart POST → 取 token
- **AND** **不**經過 `~/.local/state/opencode/mcp-staging/`（已不存在）

---

### Requirement: R10 docker group prerequisite + multi-user setup

所有要用 docxmcp 的 system user 必須在 `docker` group 裡；安裝步驟必檢查並提示。

#### Scenario: R10-S1 install.sh 偵測 docker group

- **GIVEN** docxmcp `install.sh` 執行
- **WHEN** 檢查 `groups | grep docker`
- **THEN** 若未在 group → 印明確提示「系統管理員需執行 `sudo usermod -aG docker $USER` 並重 login」並 exit 1
- **AND** 若在 group → 繼續安裝、印 `docker compose -p docxmcp-${USER} up -d` 命令引導

#### Scenario: R10-S2 多 user 並存

- **GIVEN** pkcs12 與 cece 都是 docker group 成員
- **WHEN** 兩 user 各自 `docker compose -p docxmcp-${USER} up -d`
- **THEN** 兩 container 同時運行、互不影響
- **AND** `docker ps` 列出 `docxmcp-pkcs12-docxmcp-1` 與 `docxmcp-cece-docxmcp-1`

## Acceptance Checks

| AC# | 條件 | 對應 R |
|---|---|---|
| AC-01 | docxmcp container `docker inspect` Mounts 為空（或僅 named volume + IPC dir） | R1-S1 |
| AC-02 | POST /files 回 `{token, sha256, size}`、bytes 寫到容器 `/tmp/docxmcp-sessions/<token>/` | R2-S1 |
| AC-03 | GET /files/{token} 回原始 bytes（sha 比對過）| R2-S2 |
| AC-04 | container 重啟後舊 token 走任一 tool 失敗，明確錯誤碼 `token_not_found` | R2-S3 |
| AC-05 | 21 支 tool 都接受 `token` 入參，內部解 token → path、轉呼叫既有 CLI | R3-S1 |
| AC-06 | 不存在 token 呼叫 tool 時 mcp result isError 帶 `token_not_found` | R3-S2 |
| AC-07 | docxmcp 連線用 StreamableHTTPClientTransport，tools/list 回 21 個工具 | R4-S1 |
| AC-08 | gmail / google-calendar 等 mcp app 仍走 stdio，未受影響 | R4-S2 |
| AC-09 | dispatcher.before 對 incoming 檔案走 multipart POST、無 hard-link 與 mcp-staging 寫入 | R5-S1 |
| AC-10 | dispatcher.after 在工具完成後 best-effort DELETE token | R5-S2 |
| AC-11 | wrapper `extract_text foo.docx` 在 CLI 跑通且 docker inspect 過程無新建 bind mount | R6-S1 |
| AC-12 | AI 工具表沒有 wrapper-only entry，所有 docxmcp tool 都來自 HTTP MCP | R6-S2 |
| AC-13 | mcp-apps.json docxmcp entry 含 url + transport，不含 host path | R7-S1 |
| AC-14 | register API 對含 `-v <host>:<container>` 的 command reject 並回 `bind_mount_forbidden` | R8-S1 |
| AC-15 | audit endpoint 對掃描現有 entries 回違規清單（理想為空） | R8-S2 |
| AC-16 | 上傳行為仍生 incoming/、history、AttachmentRefPart 含 repo_path + sha256 | R9-S1 |
| AC-17 | dispatcher 從 repo_path 上傳，不經 mcp-staging（mcp-staging 目錄不再被建立或寫入） | R9-S2 |
| AC-18 | install.sh 偵測 docker group 缺失時明確 exit 1 並提示 | R10-S1 |
| AC-19 | 兩 user 並存運行各自 container、各自 socket、互不可連對方 socket | R1-S3 / R10-S2 |
| AC-20 | bind mount lint IPC 例外正則涵蓋 `/run/user/\d+/opencode/sockets/<app>/`，非該模式一律 reject | R8-S1b |
