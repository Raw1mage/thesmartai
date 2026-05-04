# Errors: docxmcp-http-transport

每個錯誤碼對應一個觸發場景、回給呼叫方的訊息與修復路徑。Code prefix：`HTTP-` (HTTP file API)、`MCP-` (mcp tool layer)、`DSP-` (opencode dispatcher)、`POL-` (cross-cutting policy)。

## Error Catalogue

### HTTP-1001 — `upload_too_large`

**Layer**：docxmcp `POST /files`
**HTTP status**：413
**Trigger**：上傳檔案超過 1 GB（DD-4 cap）。
**User-visible message**：「檔案超過 1 GB 上限。請分割或聯絡管理員調整 cap。」
**Recovery**：使用者拆檔重傳；管理員可在 docxmcp env 調 `DOCXMCP_MAX_UPLOAD_BYTES`。

---

### HTTP-1002 — `invalid_multipart`

**Layer**：docxmcp `POST /files`
**HTTP status**：400
**Trigger**：請求 body 不是合法 multipart/form-data。
**User-visible message**：「上傳訊息格式錯誤；需 multipart/form-data 含 `file` 欄位。」
**Recovery**：caller fix multipart 構造。

---

### HTTP-1003 — `session_storage_full`

**Layer**：docxmcp token store
**HTTP status**：507
**Trigger**：`/tmp/docxmcp-sessions/` 達到總體 size cap 但 LRU eviction 跟不上速度（極端 burst）。
**User-visible message**：「token 儲存區暫時已滿。稍候重試或減少並發。」
**Recovery**：自動 LRU 已啟動；若高頻 burst，重試 backoff。

---

### HTTP-1004 — `token_not_found`

**Layer**：docxmcp `GET /files/{token}` 或 token 解析路徑
**HTTP status**：404（HTTP）/ tool error（mcp）
**Trigger**：token 不在 store（已 TTL 過期、LRU 退出、container 重啟）。
**User-visible message**：「token 不存在或已過期；請重新上傳。container 重啟會清掉所有 token。」
**Recovery**：重新 `POST /files` 取得新 token。opencode dispatcher 自動處理 retry。

---

### HTTP-1005 — `token_storage_io_error`

**Layer**：docxmcp token store
**HTTP status**：500
**Trigger**：寫入 `/tmp/docxmcp-sessions/` 時 disk full / permission / inode 用盡。
**User-visible message**：「token 儲存區 IO 錯誤：`<errno>`。請檢查容器磁碟空間。」
**Recovery**：容器內運維、清 `/tmp`、重啟。

---

### MCP-2001 — `tool_token_not_found`

**Layer**：docxmcp `_mcp_registry` token resolution
**HTTP status**：N/A（mcp result.isError = true）
**Trigger**：tool call 收到的 token 不在 store。
**User-visible message**：「tool 呼叫的 token 已失效（container 可能重啟過）；caller 應重新 upload + retry。」
**Recovery**：opencode dispatcher 端**應該**catch 此錯誤並自動 retry（重 upload）。implementation 留 v1 簡單：直接把錯誤回給 LLM，由 LLM 看 message 決定（spec.md R3-S2 行為）。v2 可加 dispatcher auto-retry。

---

### MCP-2002 — `tool_failed`

**Layer**：docxmcp `_mcp_registry` subprocess wrapper
**HTTP status**：N/A
**Trigger**：底層 `bin/<tool>.py` exited non-zero。
**User-visible message**：「`<tool>` 執行失敗（exit `<code>`）：`<stderr>`。」
**Recovery**：依 stderr 内容；常見問題：docx 損毀、樣式不存在、template 沒 matched。

---

### DSP-3001 — `docxmcp_unreachable`

**Layer**：opencode dispatcher uploadToDocxmcp
**HTTP status**：N/A（throw to mcp client）
**Trigger**：fetch `POST /files` 連線失敗（ECONNREFUSED / timeout）。
**User-visible message**：「docxmcp 容器連不上。請檢查 `docker compose ps docxmcp` + healthz。」
**Recovery**：daemon 偵測後 emit Bus event；`docker compose up -d` 啟動 + healthcheck pass 後自動恢復。

---

### DSP-3002 — `upload_failed`

**Layer**：opencode dispatcher uploadToDocxmcp
**HTTP status**：N/A
**Trigger**：POST /files 回 4xx/5xx（多半是 HTTP-1001/1002/1003/1005）。
**User-visible message**：「檔案上傳失敗（status `<n>`）：`<docxmcp-error-code>`。」
**Recovery**：依 docxmcp 錯誤碼分類處理。dispatcher 對 1001/1002 直接報、對 1003/1005 retry。

---

### DSP-3003 — `bundle_decode_failed`

**Layer**：opencode dispatcher.after
**HTTP status**：N/A
**Trigger**：tool result 含 `bundle_tar_b64` 但 base64 decode 失敗 / tar extract 失敗。
**User-visible message**：「bundle decode 失敗。tool 結果結構可能損毀。」
**Recovery**：log full result 給 debug；不影響 tool 主要 stdout 回應給 LLM。

---

### DSP-3004 — `incoming_publish_failed`

**Layer**：opencode dispatcher.after
**HTTP status**：N/A
**Trigger**：bundle 寫到 `<repo>/<sourceDir>/<stem>/` 失敗（disk full / permission）。
**User-visible message**：「bundle 已從 docxmcp 取回，但寫到專案 incoming/ 失敗：`<reason>`。bundle 內容已留在記憶體，可從 result 結構自取。」
**Recovery**：使用者修權限 / 騰空間後重試。

---

### POL-4001 — `bind_mount_forbidden`

**Layer**：opencode `McpAppStore.addApp` lint (DD-13)
**HTTP status**：400（POST /api/v2/mcp/store/apps 回應）
**Trigger**：register 的 mcp-app entry command 含 `-v <host>:<container>` 或 `--mount type=bind`。
**User-visible message**：「mcp-app 註冊被拒：含 bind mount 違反安全紅線（spec: docxmcp-http-transport）。請改用 HTTP transport + content-addressed file API、或 docker named volume。」
**Recovery**：caller 改寫 manifest（移除 -v / --mount type=bind）後重 register。

---

### POL-4002 — `bind_mount_audit_violation`

**Layer**：opencode `GET /api/v2/mcp/store/audit-bind-mounts`
**HTTP status**：200（回應 body 含 violations 陣列）
**Trigger**：scan 既有 entries 發現含 bind mount（理論上 lint 會擋，但既有資料 / 手動編輯可能繞過）。
**User-visible message**：「偵測到 `<n>` 個 mcp-app 仍含 bind mount：`<list>`。請遷移或移除。」
**Recovery**：本 spec 範圍只偵測；purge 由 follow-up spec `mcp-bind-mount-audit-purge` 處理。
