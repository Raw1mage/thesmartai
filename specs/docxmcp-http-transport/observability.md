# Observability: docxmcp-http-transport

## Events

Bus event 全 emit 在 daemon 程序內，由 web/TUI/telemetry 訂閱。沿用 `<subsystem>.<entity>.<action>` 命名。

### `incoming.dispatcher.http-upload-started`

**Emit**：dispatcher.before 開始 POST /files。
**Payload**：
```json
{
  "appId": "docxmcp",
  "toolName": "extract_text",
  "repoPath": "incoming/合約.docx",
  "sizeBytes": 12345
}
```

### `incoming.dispatcher.http-upload-succeeded`

**Emit**：POST /files 回 200。
**Payload**：
```json
{
  "appId": "docxmcp",
  "toolName": "extract_text",
  "repoPath": "incoming/合約.docx",
  "token": "tok_...",
  "sha256": "...",
  "sizeBytes": 12345,
  "durationMs": 120
}
```

### `incoming.dispatcher.http-upload-failed`

**Emit**：POST /files 失敗（網路錯、4xx、5xx）。
**Payload**：
```json
{
  "appId": "docxmcp",
  "toolName": "extract_text",
  "repoPath": "incoming/合約.docx",
  "errorCode": "DSP-3001 | DSP-3002 | ...",
  "httpStatus": 503,
  "message": "..."
}
```

### `incoming.dispatcher.bundle-published`

**Emit**：dispatcher.after 把 bundle 解碼寫到 repo 完成。
**Payload**：
```json
{
  "appId": "docxmcp",
  "sha256": "...",
  "bundleRepoPath": "incoming/合約",
  "fromCache": false,
  "bundleSizeBytes": 50000
}
```

### `incoming.dispatcher.token-cleanup-failed`

**Emit**：DELETE /files/{token} 失敗（best-effort）。
**Payload**：
```json
{
  "token": "tok_...",
  "errorMessage": "ECONNRESET"
}
```

### `mcp.transport.connected`

**Emit**：MCP client 連線成功。
**Payload**：
```json
{
  "appId": "docxmcp",
  "transport": "streamable-http",
  "socketPath": "/home/<user>/.local/state/opencode/sockets/docxmcp/docxmcp.sock",
  "toolCount": 21
}
```

### `mcp.store.bind-mount-rejected`

**Emit**：register API lint 偵測到違規（資料目錄 bind mount，非 IPC 例外）。
**Payload**：
```json
{
  "attemptedAppId": "evil-mcp",
  "evidence": ["-v", "/host/data:/x"],
  "ipcExceptionMatched": false,
  "policy": "specs/docxmcp-http-transport"
}
```

### `mcp.store.bind-mount-ipc-exception-allowed`

**Emit**：register API lint 偵測 bind mount 但符合 IPC 例外、放行（DD-13）。
**Payload**：
```json
{
  "appId": "docxmcp",
  "hostPath": "/home/<user>/.local/state/opencode/sockets/docxmcp",
  "containerPath": "/run/docxmcp",
  "rule": "ipc-rendezvous-dir"
}
```

### `mcp.store.bind-mount-audit`

**Emit**：audit endpoint 被呼叫。
**Payload**：
```json
{
  "violationCount": 0,
  "ipcExceptionCount": 1,
  "totalEntries": 3,
  "scannedAt": "2026-05-04T..."
}
```

### `docxmcp.token.evicted`

**Emit**：docxmcp 容器內 LRU eviction 觸發。
**Payload**：
```json
{
  "token": "tok_...",
  "reason": "ttl-expired | lru-pressure | size-cap",
  "ageMs": 3600000
}
```

---

## Metrics

容器外的 opencode daemon export：

| Metric | 類型 | 維度 | 用途 |
|---|---|---|---|
| `incoming.dispatcher.http_upload.count` | counter | `appId, status` | 上傳次數，按 success / failed |
| `incoming.dispatcher.http_upload.duration_ms` | histogram | `appId` | 上傳延遲分佈 |
| `incoming.dispatcher.http_upload.bytes` | counter | `appId` | 累計上傳位元組 |
| `incoming.dispatcher.bundle_published.count` | counter | `appId, fromCache` | bundle publish 次數，cache 命中比例 |
| `mcp.transport.connections.gauge` | gauge | `transport` | 當前 streamable-http / stdio 連線數 |
| `mcp.store.bind_mount_rejected.count` | counter | — | lint reject 累計數，理想 0 |
| `mcp.store.bind_mount_ipc_exception.count` | counter | — | IPC 例外通過次數（合法情況下會增）|

容器內 docxmcp export（structured stdout JSON line per minute）：

| Metric | 類型 | 維度 | 用途 |
|---|---|---|---|
| `docxmcp.tokens.active.gauge` | gauge | — | 當前 token 數 |
| `docxmcp.tokens.storage_bytes.gauge` | gauge | — | `/tmp/docxmcp-sessions/` 總體 size |
| `docxmcp.tokens.evicted.count` | counter | `reason` | TTL / LRU / cap |
| `docxmcp.tools.invoked.count` | counter | `tool, status` | tool call 次數 |
| `docxmcp.bundle_cache.hit_rate.gauge` | gauge | — | cache hit / (hit + miss) |

---

## Logs

結構化 log（JSON 一行一筆，含 `service`、`spec`、`level`）。

### opencode 端

- `service: "incoming.dispatcher"` — upload / publish / token cleanup
- `service: "mcp.client.streamable-http"` — connection, tool call routing
- `service: "mcp.store.lint"` — bind-mount 偵測（含 IPC 例外處理）

範例：

```json
{"ts":"...","level":"info","service":"incoming.dispatcher","spec":"docxmcp-http-transport","msg":"http upload started","repoPath":"incoming/合約.docx","sizeBytes":12345}
{"ts":"...","level":"info","service":"incoming.dispatcher","msg":"http upload succeeded","token":"tok_xxx","sha256":"abc","durationMs":120}
{"ts":"...","level":"warn","service":"incoming.dispatcher","msg":"http upload failed","errorCode":"DSP-3001"}
{"ts":"...","level":"info","service":"mcp.store.lint","msg":"ipc exception allowed","hostPath":"<...>/sockets/docxmcp","containerPath":"/run/docxmcp"}
{"ts":"...","level":"warn","service":"mcp.store.lint","msg":"bind-mount rejected (data dir)","attemptedAppId":"x","evidence":["-v","/host/data:/x"]}
```

### docxmcp 端

```
[docxmcp] [...] [info] {"service":"docxmcp.http","route":"POST /files","token":"tok_xxx","size":12345,"duration_ms":80}
[docxmcp] [...] [info] {"service":"docxmcp.tool","tool":"extract_text","token":"tok_xxx","exit_code":0}
[docxmcp] [...] [warn] {"service":"docxmcp.token","action":"evicted","token":"tok_xxx","reason":"ttl-expired"}
```

---

## Alerts

| Alert | 條件 | Severity | 行動 |
|---|---|---|---|
| `docxmcp_unreachable` | `mcp.transport.connections.gauge{appId="docxmcp"} == 0` 持續 60s | CRITICAL | 立即查 `docker compose ps`、socket 是否存在；可能容器死或 socket 路徑錯 |
| `bind_mount_data_dir_attempted` | `mcp.store.bind_mount_rejected.count > 0` 在 24h 內 | WARNING | 有人嘗試新加違規 entry；查來源 |
| `bind_mount_audit_violation` | audit endpoint 回非空 violations | WARNING | 既有 entry 含資料目錄違規 → 走 follow-up spec |
| `upload_failure_high` | `incoming.dispatcher.http_upload.count{status='failed'}` 在 1h 內 > 5 | WARNING | docxmcp container 不穩 |
| `cache_hit_rate_low` | `docxmcp.bundle_cache.hit_rate.gauge < 0.05` 跑 100+ calls 後 | INFO | cache 沒派上用場 |
| `token_storage_full_repeated` | `HTTP-1003` 在 1h 內 > 3 次 | WARNING | LRU 跟不上 burst |

---

## Audit Trail

雙寫到專屬 audit log（`~/.local/state/opencode/audit/mcp-bind-mount.log`，rotated daily）：

- 所有 register API 嘗試（含 reject / IPC 例外允許）
- 所有 audit endpoint 呼叫
- 所有 mcp-apps.json 寫入操作

audit log 不對 web UI 暴露；給合規 / 安全審計用。

---

## Tail commands（給使用者實測）

```bash
# 全 incoming + dispatcher 流動
tail -F ~/.local/share/opencode/log/debug.log | grep -E '"service":"(incoming|mcp\.client|mcp\.store)'

# 只看 bind-mount 政策事件
tail -F ~/.local/share/opencode/log/debug.log | grep '"service":"mcp\.store\.lint"'

# docxmcp 容器內事件
docker logs -f docxmcp-docxmcp-1 2>&1 | grep -E '"service":"docxmcp\.'

# 同時看兩邊
( tail -F ~/.local/share/opencode/log/debug.log | sed 's/^/[opencode] /' & docker logs -f docxmcp-docxmcp-1 2>&1 | sed 's/^/[docxmcp]  /' ) | grep -E '(incoming|docxmcp|mcp\.)'

# Unix socket 連線狀態
ls -la ~/.local/state/opencode/sockets/docxmcp/
ss -lx 2>/dev/null | grep docxmcp.sock
```
