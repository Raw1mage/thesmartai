# Observability: repo-incoming-attachments

## Events

Bus event 全 emit 在 daemon 程序內、由 web/TUI/telemetry 訂閱。命名沿用既有 `<subsystem>.<entity>.<action>` 慣例。

### `incoming.upload.received`

**Emit**：upload route 完成 atomic write 之後（失敗時不 emit）。
**Payload**：
```json
{
  "sessionId": "...",
  "repoPath": "incoming/合約.docx",
  "sha256": "abc...",
  "sizeBytes": 12345,
  "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "status": "uploaded | deduped | conflict-renamed",
  "redirectedTo": null
}
```
**Consumers**：web UI 上傳卡片更新、telemetry session 計數。

### `incoming.history.appended`

**Emit**：每次 `history.appendEntry` 成功後。
**Payload**：
```json
{
  "repoPath": "incoming/合約.docx",
  "source": "upload | upload-dedupe | upload-conflict-rename | tool:<name> | drift-detected | bundle-published",
  "sha256": "...",
  "historyVersion": 5,
  "sessionId": "..."
}
```
**Consumers**：web UI 履歷檢視即時更新。

### `mcp.dispatcher.cache-hit`

**Emit**：dispatcher 偵測到 `bundles/<sha>/` 已存在、決定跳過 mcp tool 時。
**Payload**：
```json
{
  "appId": "docxmcp",
  "toolName": "docx_decompose",
  "sha256": "...",
  "repoPath": "incoming/合約.docx",
  "publishedAt": "incoming/合約/"
}
```
**Consumers**：web UI 顯示「從快取載入」標記。telemetry 用此 event 估算「重複計算節省率」。

### `mcp.dispatcher.cache-miss`

**Emit**：dispatcher 走完整 mcp tool 計算路徑時。
**Payload**：同 cache-hit + `durationMs`。
**Consumers**：telemetry。

### `mcp.dispatcher.cache-corrupted`

**Emit**：cache 命中但 `manifest.json` 完整性檢查失敗（INC-2003）。
**Payload**：
```json
{
  "appId": "docxmcp",
  "sha256": "...",
  "expectedSha": "...",
  "actualSha": "...",
  "bundlePath": "..."
}
```
**Consumers**：daemon log（CRITICAL level）+ telemetry alerting。

### `mcp.dispatcher.cross-fs-fallback`

**Emit**：dispatcher 偵測到 `<repo>` 與 staging 不同 fs（`stat.st_dev` 不同），或 `link()` 回 EXDEV，自動退回 `cp -r` 路徑時。
**Payload**：
```json
{
  "appId": "docxmcp",
  "sha256": "...",
  "reason": "diff-st_dev | EXDEV",
  "repoFsId": "<dev_id_repo>",
  "stagingFsId": "<dev_id_staging>"
}
```
**Consumers**：daemon log + telemetry。本事件**不是**錯誤、是 graceful degradation 的明確標記。telemetry 用此計算「跨 fs repo 比例」、評估快取省空間實際效益。

### `incoming.dispatcher.publish-failed`

**Emit**：bundle hard-link 回 incoming/ 失敗（INC-2002）。
**Payload**：
```json
{
  "sha256": "...",
  "repoPath": "incoming/合約",
  "stagingPath": "...",
  "errno": "EXDEV | EACCES | ..."
}
```
**Consumers**：web UI 錯誤訊息呈現 + daemon log。

---

## Metrics

下列計數 / 直方圖由 daemon export，目前以 in-memory counter 形式存在；未來 Prometheus exporter 接上後同名 metric 即可。

| Metric | 類型 | 維度 | 用途 |
|---|---|---|---|
| `incoming.upload.count` | counter | `status` | 上傳量按結果（uploaded / deduped / conflict-renamed） |
| `incoming.upload.bytes` | counter | — | 累計上傳位元組（不含 dedupe） |
| `incoming.upload.duration_ms` | histogram | — | 上傳處理時間分佈（含 sha256 計算） |
| `incoming.history.append.count` | counter | `source` | 履歷寫入頻率，按 source 分桶（upload / tool:* / drift-detected / bundle-published） |
| `incoming.history.rotate.count` | counter | — | 履歷 rotate 次數（DD-13 觸發） |
| `incoming.history.drift_detected.count` | counter | — | drift 安全網被觸發的次數，理想值是 0；偏高代表 tool hook 漏洞 |
| `mcp.dispatcher.cache_hit.count` | counter | `appId` | cross-session 計算節省事件 |
| `mcp.dispatcher.cache_miss.count` | counter | `appId` | 真實 mcp tool 呼叫 |
| `mcp.dispatcher.cache_hit_rate` | gauge | `appId` | hit / (hit + miss)，目標 ≥ 0.3 表示 cache 有用 |
| `mcp.dispatcher.cache_corruption.count` | counter | `appId` | INC-2003 觸發次數，理想值 0 |
| `mcp.dispatcher.cross_fs_fallback.count` | counter | `appId, reason` | DD-15 fallback 觸發次數；reason ∈ {diff-st_dev, EXDEV}。高代表使用者 repo 多在外接磁碟 |
| `mcp.dispatcher.duration_ms` | histogram | `appId` × {hit, miss} | 兩條路徑的延遲對比 |
| `incoming.bundle.publish_failed.count` | counter | `errno` | INC-2002 |

---

## Logs

結構化 log（JSON，每條附 `service`、`spec`、`level`）。

- `service: "incoming"` — paths / history / dispatcher 模組共用
- `service: "mcp.dispatcher"` — cache lookup / stage / publish 子流程
- 每條重要 log 含 `requestId`（與 upload HTTP request 對齊）+ `sessionId`

範例：

```json
{"ts":"...","level":"info","service":"incoming","spec":"repo-incoming-attachments","requestId":"r-1","sessionId":"s-1","msg":"upload received","repoPath":"incoming/合約.docx","sha256":"abc...","status":"uploaded"}
{"ts":"...","level":"warn","service":"incoming","msg":"drift detected","repoPath":"incoming/合約.docx","priorSha":"B","observedSha":"C"}
{"ts":"...","level":"info","service":"mcp.dispatcher","msg":"cache hit","appId":"docxmcp","sha256":"abc...","durationMs":3}
{"ts":"...","level":"error","service":"mcp.dispatcher","msg":"bundle publish failed","sha256":"abc...","errno":"EXDEV"}
```

---

## Alerts

下列條件**應**進 telemetry alerting（具體閾值由運維拍板）：

| Alert | 條件 | Severity | 行動 |
|---|---|---|---|
| `mcp_cache_corruption` | `mcp.dispatcher.cache_corruption.count > 0` 在 1h 內 | CRITICAL | 立即追查；可能有 tool 繞過 break-on-write |
| `history_drift_high` | `incoming.history.drift_detected.count` 在 1h 內 > 上週同期 5x | WARNING | tool dispatcher hook 可能有漏洞，補強 phase 4 hook 點 |
| `bundle_publish_failed` | `incoming.bundle.publish_failed.count > 5` 在 1h 內 | WARNING | 多半是 cross-device link（EXDEV）— 確認 staging 區與 repo 在同 fs |
| `cache_hit_rate_low` | `mcp.dispatcher.cache_hit_rate < 0.05`（跑了 ≥ 100 次後） | INFO | 不算錯，可能 sha 鍵命中率天然就低；但若為 0% 表示快取機制可能根本沒運作 |

---

## Audit Trail

雙寫到專屬 audit log（`~/.local/state/opencode/audit/incoming.log`，rotated daily）：

- 所有上傳事件（含 dedupe / conflict-renamed）
- 所有 dispatcher cache-corruption 事件
- 所有 break-on-write 主動 detach 事件
- 所有 legacy attachment ref miss

audit log 不對 web UI 暴露，僅供事後合規 / 安全審計使用。
