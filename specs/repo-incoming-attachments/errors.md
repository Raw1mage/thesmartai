# Errors: repo-incoming-attachments

每個錯誤碼對應一個被觸發的場景、回給使用者的訊息、以及修復路徑。Code 用 `INC-XXXX` 前綴（INComing）。

## Error Catalogue

### INC-1001 — `no_session_project_path`

**Layer**：upload route
**HTTP status**：400
**Trigger**：上傳事件抵達時 `session.project.path` 解析不到（DD-1, R1-S2）。
**User-visible message**：「無法為這次上傳找到所屬專案。請先在對話 session 內指定 project path 後再試。」
**Recovery**：使用者建立 / 切換到有效的 session（具有 project path）後重新上傳。
**No-silent-fallback rule**：絕對不可退回舊 attachment cache 路徑。

---

### INC-1002 — `filename_path_traversal_rejected`

**Layer**：incoming.paths.sanitize
**HTTP status**：400
**Trigger**：上傳 filename 包含 `..` segment、leading `/`、`\0`、或 NFC normalize 後仍過長（>256 chars）。
**User-visible message**：「檔名包含禁止字元或路徑跳脫片段：`<filename>`。請改名後重傳。」
**Recovery**：客戶端改名後重傳。原始違規檔名不會落地，也不寫履歷（避免污染）。

---

### INC-1003 — `incoming_dir_uncreatable`

**Layer**：upload route
**HTTP status**：500
**Trigger**：`<repo>/incoming/` 不存在且 `mkdir` 失敗（permission、唯讀 fs、disk full）。
**User-visible message**：「無法建立 incoming 資料夾。請檢查專案路徑寫入權限。」
**Recovery**：daemon 端 log 含 errno；使用者修正權限後重試。

---

### INC-1004 — `history_write_failed`

**Layer**：incoming.history.appendEntry
**HTTP status**：500（若發生在 upload route）
**Trigger**：jsonl append 失敗（disk full、permission、advisory lock 取得逾時 > 5s）。
**User-visible message**：「履歷寫入失敗，上傳已 rollback。」
**Recovery**：daemon 嘗試 rollback：刪除剛 atomic-write 的 incoming 檔。若 rollback 也失敗，回 INC-1005。

---

### INC-1005 — `partial_state_after_failure`

**Layer**：upload route / dispatcher
**HTTP status**：500
**Trigger**：寫入過程中失敗且 rollback 不完整（極少見）。
**User-visible message**：「上傳處理過程出現部分失敗狀態，請檢查 incoming/ 是否有殘留檔案。Daemon 已記錄失敗點 `<uuid>`。」
**Recovery**：daemon log 含 uuid + 殘留 path；使用者手動清理或聯絡管理者。本碼意圖是「明確報告」而非自動修復，符合 destructive-tool-guard memory rule。

---

### INC-2001 — `dispatcher_stage_failed`

**Layer**：incoming.dispatcher.before
**HTTP status**：N/A（mcp tool call 內部）
**Trigger**：把 incoming 檔 cp 到 staging 區失敗（disk full、權限）。
**User-visible message**：「無法把檔案 stage 到 mcp 工作區。請檢查 ~/.local/state/opencode/mcp-staging/ 寫入權限。」
**Recovery**：tool call 直接失敗回給 LLM，LLM 可選擇回頭請使用者處理。

---

### INC-2002 — `dispatcher_publish_failed`

**Layer**：incoming.dispatcher.after
**HTTP status**：N/A
**Trigger**：把 staging bundle hard-link 回 `<repo>/incoming/<stem>/` 失敗（cross-device link、權限、目標已存在且 nlink=1）。
**User-visible message**：「mcp 計算成功但回傳到專案資料夾失敗：`<reason>`。產物保留在 staging 區可手動取回：`<staging path>`。」
**Recovery**：daemon 自動處理 — 偵測到 EXDEV 時 fallback 到 `cp -r`（DD-15）、emit `mcp.dispatcher.cross-fs-fallback` 不視為錯誤；本碼僅在 EXDEV 以外的失敗（permission、disk full）才實際冒泡到使用者。使用者可手動 `cp` staging 內容；daemon 日後重試會走 cache-hit 路徑。

---

### INC-2003 — `bundle_cache_corrupted`

**Layer**：incoming.dispatcher.lookupBundleCache
**HTTP status**：N/A
**Trigger**：cache 命中但 `manifest.json` 內 sha256 對不上目錄名（cache 被外部污染或破壞）。
**User-visible message**：「快取 bundle 完整性檢查失敗（sha 不一致），改走重算路徑。」
**Recovery**：dispatcher 自動 fall through 到 cache-miss 流程；同時 emit `mcp.dispatcher.cache-corrupted` event 與 daemon log，方便事後審計。本路徑**不是**靜默 fallback —— 它是明確的完整性違規處理，會留下審計記錄。

---

### ~~INC-3001 — `legacy_attachment_ref_not_found`~~ (v1, SUPERSEDED 2026-05-03)

~~**Trigger**：客戶端引用 `attachment://refID-XYZ` 但對應檔案在舊 cache 中已不存在~~

整段 SUPERSEDED — 不存在 plain-file cache 路徑。修正版見 INC-3001'。

---

### INC-3001' — `attachment_repo_file_missing` (v2, ADDED 2026-05-03)

**Layer**：`getAttachmentBlob` (session storage backend) — 對應 R10'-S3
**HTTP status**：404（若由 HTTP API 觸發）
**Trigger**：AttachmentBlob row 中 `repoPath` 指向 `<repo>/incoming/合約.docx`，但檔案實際不存在（使用者刪除、外部移動、跨 worktree session 等）。
**User-visible message**：「attachment_ref refID-XYZ 對應的 incoming/合約.docx 在專案中不存在。請重新上傳或更正 ref。」
**Recovery**：daemon 不退回任何 fallback、不去翻舊 base64-content 路徑（no-silent-fallback rule）。使用者重新上傳檔案；若該 ref 重要，可從備份還原 incoming/ 內容後重試。

---

### INC-3002 — `attachment_blob_malformed`

**Layer**：`getAttachmentBlob` (session storage backend)
**HTTP status**：500
**Trigger**：AttachmentBlob row 兩者皆缺（`repoPath` 與 `content` 都沒有）。
**User-visible message**：「attachment row malformed (refID-XYZ)：缺欄位、無法定位實際 bytes。請聯絡管理員或提供原始上傳。」
**Recovery**：daemon log 含 row 全內容供 audit；通常代表 schema migration bug。Implementation hint：phase 2.5' 寫入路徑必須保證至少一條欄位填滿，本錯誤是「絕不該發生」的 invariant 違反碼。

---

### INC-4001 — `break_on_write_violated`

**Layer**：phase 4 negative test 抓到的 contract violation
**HTTP status**：N/A（不該真的觸發到使用者；這是 dev-time 規則）
**Trigger**：偵測到某 tool 寫入 `incoming/<stem>/**` 後 cache 端 inode 改變。
**User-visible message**：N/A — 這是 build agent / CI 應該攔截的 contract violation。
**Recovery**：開發者修該 tool 的 hook，走 `incoming.dispatcher.breakHardLinkBeforeWrite()`。對應 RK-1 / DD-11。
