# Design: repo-incoming-attachments

## Context

opencode 對話上傳檔案目前走「內容定址快取 → tool 引用快取路徑」的不透明模型。本次設計把資料生命週期重排為「上傳即落 repo → 工具看 staging → 結果回 repo」，並加上履歷追蹤與跨 session sha-keyed bundle cache。

範圍邊界由 [proposal.md](proposal.md) 鎖定。本檔聚焦於**設計決策、風險、影響面**，不重複需求。

## Goals / Non-Goals

### Goals

- 對話上傳的檔案有確定且使用者可見的 repo 落點。
- 拆解產物與原檔同處一地，後續對話中 AI 用 Read 工具直接讀，不必走特殊 API。
- 同樣內容已被計算過的成果跨 session 重用，最大化計算回收率。
- mcp 容器邊界保持窄；複雜度盡量收進 opencode runtime。
- 履歷格式 forward-compatible，前提是任何時點寫入的紀錄日後仍可被讀懂。

### Non-Goals

- 廣義的 file-system observability / git-aware diff（履歷只記 incoming/**）。
- 多 daemon / 多人協作下的衝突解決。
- attachment cache 的反向遷移 — 既有檔案就讓它原地擱著。

## Decisions

### DD-1：上傳路徑解析錨定 session.project.path（fail-fast 原則）

**Decision**：上傳事件處理鏈第一步解析 session.project.path；解析不到立即 reject，不退路。

**Rationale**：把「沒專案落點」當合法狀況退回快取，等於把舊模型偷渡回來，違背 no-silent-fallback memory rule（[~/.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_no_silent_fallback.md](memory/feedback_no_silent_fallback.md)）。沒專案就是沒專案，使用者得到清楚錯誤訊息，比靜默退回好。

**Alternatives Considered**：
- (a) 退回 `~/.local/state/opencode/attachments/` —— 否決，違反 memory rule。
- (b) 落到 `~/incoming/` 全域 staging —— 否決，模糊了「檔案屬於哪個專案」這條核心線。

### DD-2：履歷格式 = jsonl + per-file + version 欄位

**Decision**：履歷一檔一份，存於 `incoming/.history/<filename>.jsonl`，append-only。每行一筆 JSON，必含 `version: <int>`。

**Rationale**：
- jsonl 對 append 寫入安全（line-atomic）、可不解析整檔尾巴 `tail -1` 取最新。
- per-file 比單檔聚合更可診斷、git blame 友善、避免大鎖競爭。
- `version` 欄位讓 schema 演進不必動既有紀錄；reader 用 default 補新欄位。

**Alternatives Considered**：
- (a) 單一 `incoming/.history.jsonl` 全 repo 聚合 —— 否決，read latency 隨檔案數線性增。
- (b) SQLite —— 否決，太重；對 dump diff、人工審視不友善；引入 DB 依賴。
- (c) 每事件一檔 `incoming/.history/<filename>/<ts>.json` —— 否決，inode 數會爆。

### ~~DD-3：mcp 容器邊界 vs 搬運責任~~ (v1, SUPERSEDED 2026-05-03 → `specs/docxmcp-http-transport/`)

DD-3 was superseded when bind mount itself became forbidden across the
mcp ecosystem. The replacement architecture (HTTP Streamable transport
over Unix domain socket + multipart `POST /files` + token-based tool
args) is documented in `specs/docxmcp-http-transport/design.md` DD-1,
DD-2, DD-9, DD-12. Original text retained below for archaeology.

### DD-3 (v1, SUPERSEDED)：mcp 容器邊界 vs 搬運責任

**Decision**：mcp 容器（任何語言）僅掛載 `/state`，由 opencode runtime 在每次 tool call 前後做 stage-in / publish-out。

**Rationale**：使用者明示「mcp 不該 mount 大範圍」。把搬運責任放 opencode runtime 換來：
- mcp.json 的 mount 永遠靜態
- mcp tool author 不必懂專案語意
- 安全邊界（容器寫不到 repo）天然成立
- 跨 mcp app（pdf、xlsx）可重用同一條 dispatcher 機制

**Alternatives Considered**：
- (a) per-call 動態 mount —— 否決，stdio transport 啟動就鎖定 mount，要動態就得 per-call 重啟容器，再次踩到 startup overhead。
- (b) HTTP transport + dynamic 子路徑 —— 否決，徒增複雜度；也仍要解 host→container path mapping。
- (c) 把整個 `<HOME>/projects` 掛 ro —— 否決，安全範圍過寬，跟使用者的明示矛盾。

### DD-4：sha256 為 bundle cache key

**Decision**：cross-session bundle cache 的 key 是檔案內容的 sha256，存放於 `~/.local/state/<staging-area>/bundles/<sha>/`。

**Rationale**：
- 內容定址正是 cross-session 共用的天然 key，與檔名解耦。
- sha256 抗碰撞、跨機器確定性（將來支援同步）。
- 已被既有 attachment 模型驗證可行；只是把 cache 從 raw input 移到 computed output，更合理。

**Alternatives Considered**：
- BLAKE3 / xxhash —— 否決，sha256 標準性與生態工具更廣。

### ~~DD-5：staging 區走通用結構~~ (v1, SUPERSEDED 2026-05-03 → `specs/docxmcp-http-transport/`)

The staging directory at `mcp-staging/<app-id>/` was tied to bind mount
delivery. After the transport switch the equivalent role is played by
`/tmp/docxmcp-sessions/<token>/` *inside* the docxmcp container — host
no longer sees it. Original text retained below.

### DD-5 (v1, SUPERSEDED)：staging 區走通用結構

**Decision** (2026-05-03 locked, 原 OQ-3 結束)：staging 區命名為 `~/.local/state/opencode/mcp-staging/<app-id>/{staging,bundles}/`，docxmcp 是第一個 app-id = `docxmcp`。未來 pdf-mcp、xlsx-mcp 等加入時不必再開新位置。

**Rationale**：使用者拍板「從一開始就用通用結構」，避免將來搬家。實作這條的成本很低（一個 path constant），收益很大（保護後續演化）。

### DD-6：drift 偵測觸發點 = lookup 時 cheap stat

**Decision**：每次外界讀 `currentSha256` 之前，先 stat 檔案；mtime 或 sizeBytes 與最末紀錄不一致就重算 hash + append `drift-detected`。不做 daemon 級 fs watcher。

**Rationale**：
- watcher 會引入 race condition、跨 platform 行為差異、跟 Bus event 模型脫節。
- lookup-time stat 成本低（O(μs)）、行為確定。
- 未被 lookup 的檔案漂移本來就不影響任何決策，等它被觸碰時再修正即可。

### DD-7：dedupe 比 currentSha256，不比 history 任何一筆

**Decision**：判斷重複只看「現場目前指紋」，履歷上其它紀錄不參與。

**Rationale**：使用者明示「上傳原檔 → 改寫 → 再上傳原檔」這條路徑必須允許。比 history 等於把回到舊版的權利剝奪了。

### DD-8：衝突命名 `合約 (2).docx`，每個分身有獨立履歷

**Decision**：同名異內容上傳時，新檔案另落 `合約 (2).docx`、`合約 (3).docx`…，每個分身建立獨立履歷。原檔履歷 append 一筆 `upload-conflict-rename` 紀錄重定向結果。

**Rationale**：
- `(N)` 後綴是常見 GUI 慣例，使用者直覺。
- 分身各有履歷比共用履歷簡單，避免「履歷該歸誰」的歧義。
- 在原檔履歷標 `redirectedTo` 也讓「為什麼這個 sha 沒進 currentSha256」可追蹤。

### DD-9：incoming 不自動 git add

**Decision**：incoming/ 下檔案以 untracked 狀態落地，daemon 不執行 git add。

**Rationale**：使用者自決優先。文件可能含敏感資訊；自動 stage 會誘使誤 commit。需要時使用者自己 add。

### ~~DD-10：舊 attachment cache 冷凍而非搬遷~~ (v1, SUPERSEDED 2026-05-03 → DD-17)

~~**Decision**~~：~~`~/.local/state/opencode/attachments/` 的舊內容不主動遷移、不主動清理；新流程不寫入該位置。舊 ref 讀失敗時明確報錯。~~

整段 SUPERSEDED — 該檔案路徑不存在；attachment 真正存在 SessionStorage 的 per-session row。修正版見 DD-17。

### ~~DD-11：cross-session bundle 用 hard-link + break-on-write 包裝~~ (v1, SUPERSEDED 2026-05-03 → `specs/docxmcp-http-transport/`)

Hard-link publish across the host/container boundary required bind
mount. Both gone after the transport switch. The host no longer shares
inodes with the container; bundle delivery now goes through
`structuredContent.bundle_tar_b64` in the mcp tool result (DD-10 of
the new spec). `breakHardLinkBeforeWrite` retired to a no-op stub.
Original text retained below.

### DD-11 (v1, SUPERSEDED)：cross-session bundle 用 hard-link + break-on-write 包裝

**Decision** (2026-05-03 locked, 原 OQ-4 結束)：publish 時用 hard-link 把 `bundles/<sha>/*` 連到 `<repo>/incoming/<filename-stem>/`。對 incoming 端的後續寫入必須先「斷鏈」（detach）再改，保護快取本體不被反向污染。

**Rationale**：使用者選擇省空間優先，接受 break-on-write 的實作成本。

**Break-on-write 強制性規範**（**任何**寫入 `incoming/<stem>/**` 路徑前必須執行）：
1. `stat` 目標檔案，比對 `st_nlink > 1`（代表還共享 inode）。
2. 若共享：`cp <target> <target>.tmp` → `rename <target>.tmp <target>` → 寫入動作。
3. 若已 nlink=1：直接寫入。
4. 此規則由 `incoming.dispatcher` 在 stage-out / publish-out 路徑包裝；`Edit` / `Write` / `Bash` tool 改寫 incoming 路徑時也走同一條檢查。

**Risk**：若有 tool 繞過 dispatcher 直接寫（例如未來新加的 mcp 工具忘了走 dispatcher），會無聲污染快取。Mitigation：planned 階段新增 `tool:write-bypass-detect` test vector — 故意繞過 dispatcher 後驗證 cache 內容是否變動，bundle manifest 留 sha 哈希做完整性自檢。

**Alternatives Considered**：
- (a) `cp -r`（純複製） — 否決，使用者已經拍板選 hard-link 省空間。
- (b) reflink / `cp --reflink` — 否決，依賴 btrfs/xfs 不是所有平台都有；fall-through 邏輯複雜。
- (c) 使用 symlink — 否決，break-on-write 偵測語意不對（symlink 寫入是寫到 target，需要 readlink 後再判斷）。

## Risks / Trade-offs

| # | 風險 | 影響 | 緩解 |
|---|---|---|---|
| RK-1 | 上傳路徑寫到使用者真實 repo，誤 commit 機敏資料 | 高 | DD-9 不自動 add；daemon 啟動時若偵測 incoming/ 在 .gitignore 之外、issue 一個 informational warning |
| RK-2 | 履歷 jsonl 在多 daemon process 同時寫入時 race | 中 | append-only + line-buffered + O_APPEND；同時加檔案層 advisory lock 兜底 |
| RK-3 | drift 偵測誤判（觸發 cheap stat 後仍漏掉 sub-second 修改）| 低 | 是 safety net 而非 source of truth；主路是 tool dispatcher hook，主路漏掉時才靠這條 |
| RK-4 | bundle cache 隨時間膨脹（user 上傳大量大檔） | 中 | implementation 階段加 LRU eviction（記載 lastAccessAt），預設 cap 由 tweaks.cfg 管理 |
| RK-5 | 跨 platform 路徑問題（macOS NFC vs NFD、Windows 路徑長度） | 中 | OQ-5 sanitization 規則；本 spec 範圍 Linux 為主，其他 platform 留作後續 |
| RK-6 | 既有 session 中 attachment_ref 結構改變，舊客戶端 break | 中 | API 回傳保留 `refID` 欄位作為 deprecated alias；新欄位疊加 |
| RK-7 | 大檔上傳時 sha256 計算阻塞請求 | 低 | 串流 hash（讀寫並行），不等寫入完成再開算；測試 vector 加大檔 case |

## Critical Files

新增 / 重構：
- 新增 `packages/opencode/src/incoming/` 模組
  - `paths.ts` — repo / incoming / .history 路徑解析、衝突命名
  - `history.ts` — jsonl IO、append、tail、stat-based drift
  - `dispatcher.ts` — mcp tool call 的 stage-in / publish-out 包裝
  - `index.ts` — public API
- 重構 `packages/opencode/src/tool/attachment.ts` — 上傳寫入路徑、metadata 結構
- 重構 `packages/opencode/src/server/routes/file.ts`（或對應 upload route）— 上傳 handler
- 重構 `packages/opencode/src/mcp/index.ts` — `convertMcpTool()` execute 包一層 dispatcher
- 重構工具派發層的多個 tool（`Edit` / `Write` / `Bash`）的 post-action hook，集中走 `incoming.history.touch(path)`

新增測試：
- `packages/opencode/test/incoming/upload.test.ts`
- `packages/opencode/test/incoming/history.test.ts`
- `packages/opencode/test/incoming/conflict.test.ts`
- `packages/opencode/test/incoming/drift.test.ts`
- `packages/opencode/test/incoming/dispatcher-cache-hit.test.ts`

文件：
- 更新 `specs/architecture.md` MCP / Attachment 兩段
- docxmcp repo `HANDOVER.md` 標 SUPERSEDED

## Cross-Cut Concerns

- **Observability**：每筆履歷 append 同時 emit `incoming.history.appended` Bus event；mcp dispatcher 命中 sha cache 時 emit `mcp.dispatcher.cache-hit`；miss 時 emit `mcp.dispatcher.cache-miss`。給 web UI 與 telemetry 使用。
- **Backward compat**：API attachment_ref 保留 `refID` 欄位作為 deprecated alias 至少一個 release。
- **Security**：incoming/ 不在 .gitignore 預設範圍。daemon 啟動時偵測若 incoming/ 包含可能機敏 mime（pdf/docx/keychain）並未被 .gitignore 涵蓋，TUI / web 顯示 informational warning。

### DD-12：檔名 sanitization 走標準清理

**Decision** (2026-05-03 locked, 原 OQ-5 結束)：上傳檔名走 NFC Unicode normalize → 剝除 control chars (U+0000-U+001F, U+007F-U+009F) → 限制 256 chars → reject path traversal (`..` segment, leading `/`, `\0`)。CJK、emoji、空白、標點全部保留。

**Rationale**：使用者明示「標準清理」。NFC 是跨 platform 最廣支援的形式（macOS NFD 例外，需 explicit 轉換）；256 chars 對應大多數檔系上限；保留 CJK/emoji 對中文用戶體驗友善。

**Note**：sanitize 後若與既有檔案衝突，走 D=a 的 `(N)` 後綴路徑（DD-8）。原始檔名（pre-sanitization）記錄在 history entry 的 `annotation` 欄位作為 audit trail。

### DD-17：新上傳不寫 attachments 表，repoPath 進 AttachmentRefPart JSON (2026-05-03，supersedes DD-10)

**Decision**：新上傳檔案不再呼叫 `upsertAttachmentBlob`，**不寫 attachments 表**。檔案 bytes 落 `<repo>/incoming/<filename>`，repoPath + sha256 直接塞進 `AttachmentRefPart` 訊息片段的 JSON 內：

```ts
// MessageV2.AttachmentRefPart — 既有結構 + 兩個新欄位
{
  id: "...",
  sessionID: "...",
  messageID: "...",
  type: "attachment_ref",
  ref_id: "...",
  mime: "...",
  filename: "...",
  byte_size: 12345,
  est_tokens: 3000,
  preview: "...",
  // 新增欄位（v2，本 spec）
  repo_path: "incoming/合約.docx",   // 相對 session.project.worktree
  sha256: "abc..."                     // 內容指紋
}
```

`AttachmentRefPart` 是 parts 表內一個 JSON-encoded payload，**新增欄位不需要動 SQL schema**——直接塞 JSON 即可。

`getAttachmentBlob(sessionID, refID)` 行為（雙路徑）：

```python
def get_attachment_blob(sessionID, refID):
    part = find_part_with_ref_id(sessionID, refID)
    if part and part.repo_path:
        # 新路徑：從 repo 讀
        bytes = read_file(<repo>/<part.repo_path>)
        if bytes is None:
            raise INC_3001_prime  # 不退回；no-silent-fallback
        return assemble_blob(part, bytes)
    # 舊路徑：去 attachments 表撈 base64 content（背向相容）
    return legacy_get_attachment_blob(sessionID, refID)
```

`upsertAttachmentBlob` 不再被新流程呼叫，但仍保留供舊資料 / 舊 reader 使用；本 spec 不刪不改。

**Rationale**：
- AttachmentRefPart 早已含全部 metadata（ref_id, mime, filename, byte_size, est_tokens, preview）。attachments 表的 row 本來就只有 content 是「不存在 part 的 JSON 裡」的東西。content 搬到 incoming/ 後，attachments 表對新流程**完全沒用**。
- JSON payload 加欄位是 schema-free。SQL schema、SQL migration、SQLite ALTER TABLE 全部不需要。daemon 升級不會碰 schema、rollback 路徑天然乾淨。
- 舊 attachments 表 row 自然 phase out — 沒有新 row 寫進去，舊 row 跟舊 session 一起終老。

**Migration**：完全不遷移、不清理、不動 schema。舊 session 的 attachment_ref 走舊路徑、新 session 走新路徑、daemon 同時支援兩條。

**Risk**：part JSON 內加欄位若 client 端有嚴格 schema 校驗會 reject。Mitigation：`AttachmentRefPart` 用 `.passthrough()` zod 規則（既有 attachment_ref schema 就是這樣），未識別欄位被忽略不被 reject。Phase 2 task 加一條校驗。

**對 phase 2 任務的影響**：原 2.5' / 2.5'' 任務（演進 schema、加 column）整條取消。改為 2.5\*：在 AttachmentRefPart zod schema 加 `repo_path` + `sha256` 欄；2.5\*\*：在 attachment.ts 的 reader 加雙路徑判斷。

### DD-13：履歷 jsonl 1000 行 rotate

**Decision** (2026-05-03 locked, 原 OQ-6 結束)：`incoming/.history/<filename>.jsonl` 行數達 1000 行時，rename 為 `incoming/.history/<filename>.<unix-ts>.jsonl`，當前檔重置為空。lookup `currentSha256` 時依 `<filename>.jsonl`（最新）→ 找不到再 fallback 讀最新一份 rotated 檔。

**Rationale**：使用者選擇「保留歷史 + rotation」而非 ring buffer。1000 行是 trade-off — 對絕大多數檔案永遠不會碰到，重度編輯場景每 1000 行 rotate 一次代價可接受。

**Implementation hint**：rotation 是一個 atomic rename，與 append 並行時用 advisory lock 防 race。

### DD-14：mcp tool 結果路徑反向映射 — scoped string replacement

**Decision** (2026-05-03 amend，補 P0-1)：`incoming.dispatcher.after()` 在拿到 mcp tool result 後，對整份 result body（不論 text 或 JSON）做兩條 scoped string replacement：
1. `/<staging-host-path>/bundles/<sha>/` → `<repo>/incoming/<stem>/`
2. `/state/bundles/<sha>/` → `<repo>/incoming/<stem>/`

兩條都是 dispatcher 自己控制的路徑前綴，匹配範圍受限、不會誤觸不相關文字。同樣對 `staging/<sha>.<ext>` 形式的暫存路徑反向映射回原 `incoming/<filename>`。

**Rationale**：
- 替代方案 (a) 「每個 ToolSpec 宣告 `pathFields`」需要修改 mcp 協議或自定 metadata，跨 mcp app 推不動。
- 替代方案 (b) 「naive 全文 replace」未限定範圍，對 result 內含獨立路徑文字的 case（例如 docx 內容裡剛好寫了某個 path）會誤觸。
- 此 scoped 方式介於兩者之間：由 dispatcher 自己已知的、唯一的、長路徑前綴做完全字串匹配，誤觸風險極低、實作簡單。

**Implementation hint**：dispatcher 在 stage 時記下 `(stagingPath, repoPath)` pair；after-hook 用這對做替換，不需要任何 mcp app 端配合。

**Risk**：若 mcp tool 在 result 裡 base64 encode 路徑（罕見但可能），string replace 抓不到。Mitigation：documented limitation；若日後遇到，個案加 ToolSpec metadata 補丁。

### ~~DD-15：跨 fs hard-link EXDEV 自動退回 cp~~ (v1, SUPERSEDED 2026-05-03 → `specs/docxmcp-http-transport/`)

EXDEV cross-fs fallback was a symptom of bind-mount-based delivery; no
longer relevant. Original text retained below.

### DD-15 (v1, SUPERSEDED)：跨 fs hard-link EXDEV 自動退回 cp

**Decision** (2026-05-03 amend，補 P0-2)：`incoming.dispatcher.publish()` 嘗試 `link()` 前先比對 `<repo>` 與 `<staging>` 的 device id（`stat.st_dev`），不同就直接走 `cp -r` 路徑、不打 link 失敗。同 device 才嘗試 `link()`，仍失敗時自動退回 `cp -r`。任一退回路徑 emit `mcp.dispatcher.cross-fs-fallback` event with `{appId, sha256, reason: "EXDEV" | "diff-st_dev"}`。

**Rationale**：使用者選 hard-link 是為省空間，但前提同 fs。跨 fs 強行用 link 會直接失敗、UX 災難。fallback 到 cp 是 graceful degradation：失去快取省空間優勢、但功能完全不受影響。break-on-write 規則對 cp 後的檔案天然成立（nlink=1 從一開始就成立）。

**Risk**：使用者可能不知道為何快取對某些 repo 沒省到空間。Mitigation：observability metric `mcp.dispatcher.cross_fs_fallback.count` + 啟動時 log warning if `<repo>` 與 staging 不同 fs。

### ~~DD-16：cache integrity 透過 docxmcp-side `manifest.json` 驗證~~ (v1, SUPERSEDED 2026-05-03 → `specs/docxmcp-http-transport/`)

Host-side manifest sha integrity check protected against a host that
shared inodes with the container. After the transport switch the
container fully owns its bundle cache (named volume,
host-invisible) — there is no host-side cache to verify. Original text
retained below.

### DD-16 (v1, SUPERSEDED)：cache integrity 透過 docxmcp-side `manifest.json` 驗證

**Decision** (2026-05-03 amend，補 P0-3)：v1 docxmcp 必須在每個 `bundles/<sha>/` 寫入 `manifest.json`，schema 同 [data-schema.json:BundleManifest](data-schema.json) — 至少含 `sha256`（與目錄名一致）、`appId`、`appVersion`、`createdAt`。

dispatcher 在 cache-hit publish 前先讀 `manifest.json`，比對 `manifest.sha256 == 目錄名 sha`。
- 一致：正常 publish。
- 不一致：emit `mcp.dispatcher.cache-corrupted`（INC-2003），fall through 到 cache-miss 重算路徑。
- `manifest.json` 不存在：log warning，**v1 視為信任**直接 publish（漸進保護，不擋功能）。未來 v2 可改為 strict reject。

**Rationale**：完整性檢查需要對照組。manifest 是最便宜的對照來源。docxmcp 端只需多寫一個 5 行 JSON 檔，是已 acceptable 的合約成本。

**Cross-repo task**：tasks.md phase 5 加一條「驗證 docxmcp 寫了 manifest.json with sha」；phase 6.x docs sync 時把這條 contract 寫進 docxmcp `HANDOVER.md`「不要重新討論」清單。

**Risk**：manifest.json 也是 cache 內檔案、可被破壞 → 完整性檢查也跟著失效。Mitigation：使用者直接動 cache 內檔案是「明確侵入行為」，不在本 spec 防禦範圍。

## Open Questions

P1 級議題，implementing 過程中持續關注，目前不擋進度：

- **OQ-7（P1-1）**：multi-tool 寫同 `incoming/<stem>/` 的命名空間規約。docx_decompose 寫 `description.md / outline.md / media/`、docx_grep 寫 `grep_results.json`、未來 docx_to_images 寫 `pages/`。約定每個 tool 用自己的 sub-namespace（例 `incoming/<stem>/grep/`、`incoming/<stem>/pages/`），core docx_decompose 仍寫 root（向後相容）。tasks.md phase 5 / 6 補一條約定文件。
- **OQ-8（P1-2）**：break-on-write 應從 per-tool hook 集中為 daemon-level fs adapter wrapper（`packages/opencode/src/util/fs.ts`？）。所有 `fs.writeFile / appendFile / copyFile` 走 wrapper、wrapper 自動偵測 `incoming/**` 路徑套用 break-on-write。比 per-tool hook 更耐未來新增 tool。implementing 中若發現 hook 漏點可隨時切過去。
- **OQ-9（P1-3）**：concurrent upload 同名 race。當前 spec 假設 daemon 單流；多 client 同時 POST 同名上傳會踩 `incoming/合約.docx` rename collision。implementing 加 per-filename advisory lock 即可解；若上線後從未踩到，可降級為 rare edge case 文件化即可。
