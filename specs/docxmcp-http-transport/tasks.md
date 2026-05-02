# Tasks: docxmcp-http-transport

執行清單。每個 phase（`## N.` block）是 implementing-state TodoWrite 一次載入的單位。phase 內 task ID 對應到 spec.md R / DD / AC / sequence.json scenario，方便 sync drift trace。

兩個 repo 同步動：
- **docxmcp Python**（`~/projects/docxmcp/`）：HTTP file API + 21 tool schema 改動 + bin-wrappers + install.sh
- **opencode**（`~/projects/opencode/`）：mcp client transport switch + dispatcher 重寫 + bind-mount lint

**禁令重申**：本 spec 落地 = 全 mcp 生態 bind mount 全清。**任何**新加的 docker 命令含 `-v <host>:<container>` 或 `--mount type=bind` 都是違規。

---

## 0. Prerequisite — docker group setup (system admin, manual)

- [ ] 0.1 系統管理員（root）一次性執行：對所有需要用 docxmcp 的 user 跑 `sudo usermod -aG docker <user>`
  - 對應 system accounts：pkcs12 / cece / rooroo / liam / yeatsluo / chihwei
- [ ] 0.2 受影響 user 重新 login（newgrp 生效）
- [ ] 0.3 驗證：每個 user 跑 `docker version` 應該不需要 sudo
- [ ] 0.4 install.sh 加 group 偵測 + 提示（task 4.x 一併寫）

**Stop gate**：此 phase 涉及修改系統 group membership（destructive system op），**必須使用者明示同意才執行**。本 spec 不主動跑 `usermod`。

## 1. Foundation — token store + file API skeleton (docxmcp Python)

- [ ] 1.1 在 `bin/_token_store.py` 實作 `TokenStore` class：内存 dict {token → {path, sha, mtime, size}}；`create()` 用 `secrets.token_hex` + base32 編碼產 `tok_<32-char>`（DD-3）
- [ ] 1.2 `TokenStore.put(file_stream, filename)` — streaming 寫到 `/tmp/docxmcp-sessions/<token>/<filename>`，回傳 `{token, sha256, size}`（R2-S1, DD-11）
- [ ] 1.3 `TokenStore.resolve(token) -> Path` — 回傳檔案 path；找不到 raise `TokenNotFoundError`（R3-S2）
- [ ] 1.4 `TokenStore.delete(token)` — 刪 fs + 移除 entry（R5-S2）
- [ ] 1.5 TTL 60 分鐘 + 1GB 總體 cap + LRU eviction 背景 task（threading.Timer 每 60s 檢查，DD-4）
- [ ] 1.6 `bin/mcp_server.py` 加 starlette routes：
  - `POST /files`：streaming multipart parse via `request.stream()` (DD-11)，呼叫 `TokenStore.put`，回 200 JSON
  - `GET /files/{token}`：回 raw bytes 200，找不到 404
  - `DELETE /files/{token}`：204
  - `GET /healthz`：200 `{ok: true}` for compose healthcheck
- [ ] 1.7 unit tests `tests/test_token_store.py`：put/resolve/delete/TTL/LRU 覆蓋；測 50MB streaming 不爆記憶體

## 2. Tool schema rewrite — 21 wrappers from path → token (docxmcp Python)

- [ ] 2.1 在 `bin/_mcp_registry.py` 加 `_token_arg_schema()` helper 回傳 `{type:"object", properties:{token:{type:"string", pattern:"^tok_[A-Z2-7]{32}$"}, ...}, required:["token", ...]}`
- [ ] 2.2 對 21 支 ToolSpec 一一改寫：
  - `extract_styles` `extract_outline` `extract_chapter` `rebuild_docx` `apply_styles` `build_toc` `merge_media` `extract_text` `explore_styles` `scaffold_doc` `unpack_docx` `pack_docx` `docx_to_images` `patch_paragraph` `chapter_page_break` `inline_images` `strip_cjk_ascii_space` `image_size` `dedupe_images` `table_widths` — 把 `source: <path>` / `doc_dir: <path>` schema 改為 `token: <string>`
  - `build_argv` 內部 `token_store.resolve(token)` → 取出 path，照舊塞 argv，**不動**底層 `bin/<tool>.py`
  - 第 21 支 docxmcp_decompose（軌 B 還沒實作的）skip 留 follow-up
- [ ] 2.3 加 token-not-found 統一錯誤路徑：catch `TokenNotFoundError` 回 `{ isError: true, content: [{type:"text", text:"token_not_found: <tok>; container restarted, please re-upload"}] }`（R3-S2）
- [ ] 2.4 unit tests `tests/test_tool_registry_token.py`：每支 tool 用 fake token 跑通 + token 失效時錯誤訊息正確

## 3. Container side — Dockerfile + compose (docxmcp)

- [ ] 3.1 `Dockerfile` 移除 `/state` 假設；確認 `/tmp/docxmcp-sessions/` 是 ephemeral；`EXPOSE 8080` 保留；加 `HEALTHCHECK CMD curl -f http://localhost:8080/healthz || exit 1`
- [ ] 3.2 `docker-compose.yml`：
  - 完整移除 `-v /home/...` 等資料目錄 bind mounts；只保留 IPC bind mount 與 named volume cache
  - 加 named volume `docxmcp-cache:/var/cache/docxmcp/bundles`（DD-5）
  - 加 IPC bind mount：`- "/run/user/${UID}/opencode/sockets/docxmcp:/run/docxmcp"`（DD-12 / DD-15）
  - **取消** `ports`（不開 TCP port，純 UDS）
  - uvicorn 啟動命令改為 `uvicorn ... --uds /run/docxmcp/docxmcp.sock`
  - `restart: unless-stopped`
  - `healthcheck` 改為「socket 是否存在」：`test: ["CMD", "test", "-S", "/run/docxmcp/docxmcp.sock"]`
  - compose project name 用 env：`name: docxmcp-${USER}`
- [ ] 3.3 build + 啟動：
  - 預先 `mkdir -p /run/user/$UID/opencode/sockets/docxmcp && chmod 700 /run/user/$UID/opencode/sockets/docxmcp`
  - `docker compose -p docxmcp-${USER} up -d`
  - `docker inspect docxmcp-${USER}-docxmcp-1` 驗 Mounts 列表只有：(a) `docxmcp-cache` named volume、(b) IPC bind mount 指向 `/run/user/$UID/opencode/sockets/docxmcp` → `/run/docxmcp`（AC-01）
- [ ] 3.4 啟動後 `curl --unix-socket /run/user/$UID/opencode/sockets/docxmcp/docxmcp.sock http://localhost/healthz` 200
- [ ] 3.5 多 user 並存驗證：cece 也跑 `docker compose -p docxmcp-cece up -d`，確認兩 container 並存、socket 各自隔離（R1-S3 / R10-S2 / AC-19）

## 4. Non-Docker surface — bin-wrappers + install.sh (docxmcp)

- [ ] 4.1 在 `bin-wrappers/` 寫 21 支 shell 腳本，模板：
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  host_path="$1"; shift
  container="${DOCXMCP_CONTAINER:-docxmcp-docxmcp-1}"
  basename=$(basename -- "$host_path")
  ctr_path="/tmp/incoming-$$-$basename"
  trap 'docker exec "$container" rm -f "$ctr_path" 2>/dev/null || true' EXIT
  docker cp "$host_path" "$container":"$ctr_path"
  docker exec "$container" python /app/bin/<TOOL>.py "$ctr_path" "$@"
  ```
  21 支差別只在 `<TOOL>` 替換（`extract_text` / `extract_outline` / ...）
- [ ] 4.2 所有 wrapper 加 docxmcp container 存活預檢：`docker inspect "$container" >/dev/null 2>&1 || { echo "docxmcp container not running; docker compose up -d" >&2; exit 1; }`（RK-6）
- [ ] 4.3 寫 `install.sh`：
  - 偵測當前 user 是否在 `docker` group → 缺失時明確 exit 1 + 提示 `sudo usermod -aG docker $USER`（R10-S1 / AC-18）
  - 建 `~/.local/bin/docxmcp-tools/`、symlink `bin-wrappers/*` 過去
  - 預建 `/run/user/$UID/opencode/sockets/docxmcp/`（mode 0700）
  - 印 `docker compose -p docxmcp-${USER} up -d` 引導命令
- [ ] 4.4 manual test：跑 `extract_text /home/pkcs12/projects/opencode/incoming/合約.docx`，驗 stdout 對 + 無新建 mount（AC-11 / R6-S1）

## 5. opencode mcp client — transport switch + lint (opencode)

- [ ] 5.1 在 `packages/opencode/src/mcp/manifest.ts` Manifest schema 加 `transport: z.enum(["stdio", "streamable-http", "sse"]).optional().default("stdio")` + `url: z.string().url().optional()`
- [ ] 5.2 在 `packages/opencode/src/mcp/index.ts` 加 transport switch：manifest.transport 為 `streamable-http` 時用 `StreamableHTTPClientTransport`，URL 支援 `unix:///<sock-path>:<http-path>` 形式（解析出 socketPath + http path、傳給 fetch via Bun `unix:` 機制 / undici socketPath）；其它仍 `StdioClientTransport`（DD-8, DD-12, DD-16 / R4-S1, R4-S2）
- [ ] 5.3 在 `packages/opencode/src/mcp/app-store.ts` `addApp()` 加 lint：
  - 掃 manifest.command 含 `-v` 或 `--mount type=bind`
  - 對每條 mount 套用 IPC 例外規則（DD-13）：host path 符合 `^/run/user/\d+/opencode/sockets/[a-z0-9-]+/?$` AND container path 符合 `^/run/[a-z0-9-]+/?$` → 放行
  - 不符例外 → throw `BindMountForbidden` 含 `policy: "specs/docxmcp-http-transport"`、`evidence: [...]`（R8-S1）
  - 同樣 lint 也對 `cloneAndRegister` 有效
- [ ] 5.4 在 `packages/opencode/src/server/routes/mcp.ts` 加 `GET /api/v2/mcp/store/audit-bind-mounts`：掃所有 entries 回 violations 陣列（R8-S2）
- [ ] 5.5 unit tests：lint 偵測 `-v /a:/b` / `--mount type=bind,src=...` / `-v` 在不同位置；audit endpoint 回正確結構

## 6. opencode dispatcher — HTTP uploader rewrite (opencode)

- [ ] 6.1 `packages/opencode/src/incoming/dispatcher.ts` **大刪**：
  - 整段 `bundleDirFor` / `appBundlesDir` / `appStagingDir` / `inContainerStagingPath` / `inContainerBundlesPath`
  - `verifyManifest` / `copyTreeWithFallback` / `linkTreeRecursive` / `breakHardLinkBeforeWrite`（DD-11 break-on-write 撤）
  - `stageFile` / sync version of stage logic
  - 關聯 Bus events `CrossFsFallback` `CacheHit` `CacheMiss` `CacheCorrupted`（容器自管 cache，不 emit 這些）
- [ ] 6.2 改寫 `before(toolName, args, appId, sessionID)`：
  - 仍走 `looksLikeRepoPath` 找 candidate path
  - 不再 stage、改 `await uploadToDocxmcp(repoRel)` → 收 token → 把 path replace 成 token
  - 改 ctx 結構：移除 stagedFiles，改 `uploadedTokens: Array<{repoPath, token, sha}>`
- [ ] 6.3 寫 `uploadToDocxmcp(repoPath, projectRoot)` helper：
  - 從 manifest 找 docxmcp HTTP base URL（`http://127.0.0.1:8080`）
  - 用 fetch + `FormData` multipart 把檔案上傳
  - 回 `{token, sha256, size}`
  - 失敗 emit `incoming.dispatcher.http-upload-failed` event
- [ ] 6.4 改寫 `after(result, ctx)`：
  - 看 `structuredContent.bundle_tar_b64`，base64 decode + tar extract → 寫到 `<repo>/<sourceDir>/<stem>/`（DD-10 / R5-S2）
  - best-effort `await deleteToken(token)` for each uploadedTokens
  - 仍呼叫 result path rewriting（DD-14 保留）
- [ ] 6.5 寫 `deleteToken(token)` helper — `DELETE /files/{token}`，吞 error
- [ ] 6.6 移除 `packages/opencode/src/incoming/index.ts` 中 `maybeBreakIncomingHardLink` export（不再需要）
- [ ] 6.7 移除 `packages/opencode/src/tool/edit.ts` `tool/write.ts` 中 `maybeBreakIncomingHardLink` 呼叫（hard-link 不存在了）
- [ ] 6.8 既有 dispatcher tests 砍 hard-link / break-on-write / cross-fs 相關 cases；新增 HTTP uploader cases（mock fetch）

## 7. mcp-apps.json 切換 + cutover (cross-repo)

- [ ] 7.1 docxmcp `mcp.json` 改寫為 URL form：`{ id:"docxmcp", url:"http://127.0.0.1:8080/mcp", transport:"streamable-http", ... }` （R7-S1）
- [ ] 7.2 git tag `pre-http-transport-cutover` 在 docxmcp + opencode 兩 repo（RK-8）
- [ ] 7.3 撤 docxmcp 從現有 mcp-apps.json：`DELETE /api/v2/mcp/store/apps/docxmcp`
- [ ] 7.4 重新註冊：`POST /api/v2/mcp/store/apps {path:"/home/pkcs12/projects/docxmcp", target:"user"}` — manifest 改寫後新 entry 應為 URL form
- [ ] 7.5 daemon 重啟（**需使用者明示同意**，呼叫 `system-manager:restart_self` MCP tool）
- [ ] 7.6 確認 docxmcp container `docker inspect` Mounts 為空（除 named volume）（AC-01）
- [ ] 7.7 確認 daemon 連 docxmcp 走 HTTP transport，21 tools 出現在 tool list（AC-07）

## 8. End-to-end smoke

- [ ] 8.1 上傳一個 docx：驗 `<projectRoot>/incoming/<file>` 出現、history jsonl 寫入（R9-S1）
- [ ] 8.2 AI 觸發 `docx_decompose(incoming/<file>)`：
  - 預期 daemon log 出現 `incoming.dispatcher.http` upload event
  - docxmcp container log 出現 POST /files
  - tool result 包含 base64 tar（DD-10）
  - opencode 把 bundle 寫到 `<projectRoot>/incoming/<stem>/`（R5）
- [ ] 8.3 同 session 再次呼叫 — 新 token 但 sha 命中容器內 cache（DD-5），mcp 回 `from_cache:true`
- [ ] 8.4 跨 session 跨 project（同 sha）— named volume cache 仍命中
- [ ] 8.5 docker restart docxmcp container — token 全失效；下次工具呼叫 dispatcher 重新 upload，從 named volume cache 命中（cache 跨重啟）
- [ ] 8.6 AC-13 驗證：`grep -r 'home/' ~/.config/opencode/mcp-apps.json` 應為空
- [ ] 8.7 AC-14 驗證：手動 POST 新 entry 含 `-v /tmp:/x` → 收到 400 + `bind_mount_forbidden`
- [ ] 8.8 AC-15 驗證：`GET /api/v2/mcp/store/audit-bind-mounts` 回 `{violations:[], totalEntries:N}`（已是空）
- [ ] 8.9 wrapper 驗證：`extract_text /tmp/test.docx` 跑通；`docker exec` 期間無新 mount

## 9. Sunset bind-mount in repo-incoming-attachments + docs sync

- [ ] 9.1 `specs/repo-incoming-attachments/design.md` 對 DD-3/5/11/15/16 做 inline-delta SUPERSEDED 標記，指向 `specs/docxmcp-http-transport/`（OQ-7 收斂為 inline-delta，不走 revise mode 避免狀態機複雜）
- [ ] 9.2 `specs/architecture.md` 「Incoming Attachments Lifecycle」段重寫：bind mount 模型 → HTTP transport 模型；加 cross-cutting bind-mount-ban 政策段
- [ ] 9.3 docxmcp `HANDOVER.md` 「不要重新討論」段：bind mount 那條改寫；DD-16 manifest sha 段標 SUPERSEDED（容器自管）；加新一條「兩層 surface」
- [ ] 9.4 docxmcp `HANDOVER.md` 加新章節「HTTP Transport 上線後」：HTTP endpoint 文件、token 行為、wrapper 安裝方式
- [ ] 9.5 開 `docs/events/event_<launch-date>_docxmcp-http-transport-launch.md` 紀錄：launch 時間、commit refs、清掉的舊機制清單、bind-mount 全清狀態

## 10. Verification + Promotion

- [ ] 10.1 全套 unit + integration tests 綠
- [ ] 10.2 17 條 AC 逐一勾過（AC-01 ~ AC-17）
- [ ] 10.3 `bun run scripts/plan-sync.ts specs/docxmcp-http-transport/` 跑一次最終 sync，無 drift
- [ ] 10.4 promote `verified`：`bun run scripts/plan-promote.ts specs/docxmcp-http-transport/ --to verified --reason "all 17 ACs pass; manual smoke OK; bind-mount audit empty"`
- [ ] 10.5 PR merge into baseBranch (兩 repo)
- [ ] 10.6 promote `living`：`--to living --reason "merged; bind-mount banned ecosystem-wide"`
- [ ] 10.7 開 follow-up spec `mcp-bind-mount-audit-purge`（lint guard 增強 + 周期性 audit + UI banner）
