# Spec: repo-incoming-attachments

行為規格。每條 Requirement 含一條以上 Scenario（GIVEN/WHEN/THEN）。Acceptance Checks 是必要驗收條件，逐條對應到 `test-vectors.json`（在 planned 階段定稿）。

---

## Purpose

讓對話上傳的檔案歸位至 session 所屬專案的 `incoming/`，並建立每檔履歷追蹤；mcp 工具的拆解產物與原檔同處 `incoming/<filename-stem>/`；計算結果以 sha256 為鍵跨 session 共用；既有 attachment 內容定址快取功成身退。

---

## Requirements

### Requirement: R1 上傳即落 repo

對話上傳的檔案直接寫入 session 所屬專案根目錄下的 `incoming/`，不經任何中介快取。

#### Scenario: R1-S1 在有效 session 內上傳

- **GIVEN** session 的 project path 為 `/home/pkcs12/projects/foo`
- **AND** 該 session 內 `incoming/` 不存在
- **WHEN** 使用者上傳一份 `合約.docx`，內容指紋為 `sha256:abc...`
- **THEN** opencode 建立 `/home/pkcs12/projects/foo/incoming/`
- **AND** 原子寫入 `/home/pkcs12/projects/foo/incoming/合約.docx`
- **AND** 建立 `/home/pkcs12/projects/foo/incoming/.history/`
- **AND** 在 `incoming/.history/合約.docx.jsonl` append 一筆 `{ts, source:"upload", sha256:"abc...", sessionId, sizeBytes, mime, version:1}`
- **AND** 上傳 API 回傳含 `repoPath`、`sha256`、`historyVersion` 的 attachment_ref

#### Scenario: R1-S2 無 session.project.path 時拒絕

- **GIVEN** 當前 session 沒有解析出 project path
- **WHEN** 使用者上傳檔案
- **THEN** opencode **拒絕**上傳並回覆「無 session project path 可作為上傳落點」
- **AND** 不寫入舊 attachment 快取作為退路（符合 no-silent-fallback rule）

### Requirement: R2 每檔履歷

每個 incoming 檔案一份 `incoming/.history/<filename>.jsonl`，記載歷次內容指紋變化。

#### Scenario: R2-S1 上傳後查詢履歷

- **GIVEN** R1-S1 已完成
- **WHEN** 客戶端 `GET /api/v2/incoming/history?path=合約.docx`
- **THEN** 回傳 `{currentSha256, transitions: [{ts, source, sha256, ...}]}`
- **AND** `currentSha256` 等於 jsonl 最末一筆的 sha256

#### Scenario: R2-S2 履歷格式 forward-compatible

- **GIVEN** 一份履歷 jsonl 內含 `version:1` 的舊紀錄
- **WHEN** 新 daemon 讀取
- **THEN** 舊紀錄不被視為錯誤
- **AND** 缺欄位以 schema-defined default 補齊（`mime: null`、`annotation: null` 等）

### Requirement: R3 拆解產物與原檔同處

mcp 工具拆解結果落 `incoming/<filename-stem>/`，與原檔並存。

#### Scenario: R3-S1 docx 拆解後資料夾結構

- **GIVEN** `incoming/合約.docx` 已存在
- **AND** `~/.local/state/docxmcp/bundles/<sha>/` 不存在
- **WHEN** AI 在對話中觸發 `docx_decompose(incoming/合約.docx)`
- **THEN** opencode runtime stage 檔案到 `~/.local/state/<staging-area>/<sha>.docx`
- **AND** 呼叫 docxmcp tool，input path 指向 staging
- **AND** docxmcp 寫產物到 `~/.local/state/docxmcp/bundles/<sha>/`
- **AND** opencode runtime publish 到 `incoming/合約/`
- **AND** `incoming/合約.docx` 與 `incoming/合約/` 並存

### Requirement: R4 sha-keyed bundle cache 跨 session 共用

同一份內容（指紋相同）已被計算過的拆解結果，在另一個 session / 另一個專案內也應該命中、不重算。

#### Scenario: R4-S1 跨專案命中

- **GIVEN** 專案 A 已將 `合約.docx`（sha=abc）拆解，bundle 存在於 `~/.local/state/docxmcp/bundles/abc/`
- **AND** 專案 B 上傳了完全相同內容的 `重要文件.docx`，sha 也是 abc
- **WHEN** AI 在專案 B session 內觸發 `docx_decompose(incoming/重要文件.docx)`
- **THEN** opencode runtime 偵測到 `bundles/abc/` 已存在
- **AND** 跳過 mcp tool 呼叫
- **AND** 直接 publish 到 `B/incoming/重要文件/`

#### Scenario: R4-S2 bundle cache miss

- **GIVEN** `bundles/<新 sha>/` 不存在
- **WHEN** dispatcher 進行 lookup
- **THEN** 正常呼叫 mcp tool 計算

### Requirement: R5 去重比現場指紋

判斷重複用「現場目前指紋」，不用「歷史上看過的指紋」。允許「使用者上傳原檔 → 工具改寫 → 再次上傳原檔」這條合理路徑。

#### Scenario: R5-S1 再上傳原檔（內容已被改寫）

- **GIVEN** `incoming/合約.docx` 履歷為 `[A(upload), B(tool:docx_recompose)]`，`currentSha256 = B`
- **AND** 現場硬碟上的 `合約.docx` 確實是 B
- **WHEN** 使用者重新上傳一份內容指紋為 A 的 `合約.docx`
- **THEN** 因 A ≠ currentSha256(B)，**不視為重複**
- **AND** 落地為 `incoming/合約 (2).docx`（D 規則：suffix）
- **AND** 為 `合約 (2).docx` 建立新履歷 `[A(upload)]`
- **AND** `合約.docx` 履歷 append `{ts, source:"upload-conflict-rename", sha256:"A", redirectedTo:"合約 (2).docx"}`

#### Scenario: R5-S2 上傳完全沒變過的同檔

- **GIVEN** `incoming/合約.docx` 履歷為 `[A(upload)]`，`currentSha256 = A`
- **WHEN** 使用者再次上傳指紋為 A 的 `合約.docx`
- **THEN** 因 A == currentSha256(A)，**視為 dedupe**
- **AND** 不覆寫硬碟檔案
- **AND** 履歷 append 一筆 `{ts, source:"upload-dedupe", sha256:"A"}`
- **AND** API 回傳 `{status:"deduped", repoPath:"incoming/合約.docx"}`

### Requirement: R6 工具改寫補履歷

任何 opencode tool（Edit/Write/Bash/mcp）寫入 `incoming/**` 後，必須補一筆履歷。

#### Scenario: R6-S1 mcp tool 改寫原檔

- **GIVEN** `incoming/合約.docx` 履歷為 `[A(upload)]`
- **WHEN** AI 觸發 `docx_recompose(...)`，tool dispatcher 把產物寫回 `incoming/合約.docx`
- **THEN** opencode 在 tool call return 後重算 sha
- **AND** 履歷 append `{ts, source:"tool:docx_recompose", sha256:"B", sessionId}`
- **AND** `currentSha256` 變為 B

#### Scenario: R6-S2 Edit / Write tool 改寫

- **WHEN** AI 用 `Write` tool 直接覆寫 `incoming/紀錄.md`
- **THEN** dispatcher 同樣補一筆 `{source:"tool:Write", sha256:"<new>"}`

### Requirement: R7 drift 偵測安全網

讀履歷的 `currentSha256` 之前，cheap stat 比對 mtime + sizeBytes；對不上就重算 hash 並 append `{source:"drift-detected"}`。

#### Scenario: R7-S1 外部編輯器修改後查履歷

- **GIVEN** `incoming/合約.docx` 履歷尾巴為 `{sha:B, mtime:T1, sizeBytes:S1}`
- **AND** 使用者用外部編輯器把它改成內容 C，mtime 變 T2
- **WHEN** opencode 讀履歷
- **THEN** stat 顯示 mtime != T1
- **AND** 重算 sha 得到 C
- **AND** append `{ts, source:"drift-detected", sha256:"C", sizeBytes:S2, mtime:T2}`
- **AND** `currentSha256` 變為 C

### Requirement: R8 mcp 容器邊界不變

mcp 容器（含 docxmcp）只看 `/state`，不掛載 `<repo>` 或 `$HOME`。所有檔案搬運由 opencode runtime 完成。

#### Scenario: R8-S1 容器 mount 列表審計

- **WHEN** 啟動 docxmcp container
- **THEN** docker run command 中只有 `-v <staging>:/state`（或同等）
- **AND** **無**任何 host repo path、`<HOME>`、`<HOME>/projects` 出現在 mount 列表

### Requirement: R9 incoming 不自動 git add

incoming/ 下檔案是否進 git 由使用者自決，daemon 不自動 stage / commit。

#### Scenario: R9-S1 上傳後 git 狀態

- **GIVEN** 專案是 git repo
- **WHEN** 使用者上傳 `合約.docx`
- **THEN** `git status` 顯示 `incoming/合約.docx` 為 `untracked`
- **AND** daemon 不執行 `git add`

### ~~Requirement: R10 舊 attachment 快取冷凍~~ (v1, SUPERSEDED 2026-05-03)

~~新流程不再寫入 `~/.local/state/opencode/attachments/`；舊資料保留現狀但 daemon 不主動讀寫。~~

~~#### Scenario: R10-S1 未遷移的舊 ref~~ (整段 SUPERSEDED — 並無此 cache 檔路徑)

### Requirement: R10' AttachmentBlob 內嵌 content 不再寫入；舊 row 保持可讀 (v2, ADDED 2026-05-03)

新流程上傳時，`SessionStorage.AttachmentBlob` 不再儲存 `content: Uint8Array`（base64 嵌入），而是改存 `repoPath: string` + `sha256: string` 的輕量引用，bytes 落在 `<repo>/incoming/<filename>`。舊 session 已有的 AttachmentBlob row（仍含 `content`）保留**可讀**，daemon 不主動清理、不主動遷移。

#### Scenario: R10'-S1 新上傳寫輕量引用、不寫 content

- **GIVEN** 一份新上傳事件
- **WHEN** opencode 寫 AttachmentBlob row 到 session storage
- **THEN** row 含 `refID, sessionID, mime, filename, byteSize, estTokens, createdAt, repoPath, sha256`
- **AND** row **不含** `content` 欄位（或設為 `undefined` / 空 Uint8Array — 由 schema 演進決定）
- **AND** 實際 bytes 只存在 `<repo>/incoming/<filename>`

#### Scenario: R10'-S2 舊 row 仍可讀（背向相容）

- **GIVEN** 舊 session 中有 AttachmentBlob row 帶 `content: Uint8Array(...)`、無 `repoPath`
- **WHEN** `attachment` tool / message renderer 呼叫 `getAttachmentBlob({ sessionID, refID })`
- **THEN** daemon 檢測 `repoPath` 缺、`content` 在 → 走 legacy path 直接回 content bytes
- **AND** 行為與舊版完全相同
- **AND** 不嘗試把舊 row 遷移到 incoming/

#### Scenario: R10'-S3 新 row 走新路徑

- **GIVEN** 新 session 中有 AttachmentBlob row 帶 `repoPath: "incoming/合約.docx", sha256: "abc..."`、無 `content`
- **WHEN** `getAttachmentBlob({ sessionID, refID })` 被呼叫
- **THEN** daemon 檢測 `repoPath` 在 → 從 `<repo>/incoming/合約.docx` 讀 bytes
- **AND** 比對 stat 的 size 與 `byteSize` 一致；若不一致 emit warning 並仍以實際 bytes 為準（drift safety net）
- **AND** 若 repo file 不存在 → 明確報錯「attachment_ref refID-XYZ 對應的 incoming/合約.docx 不存在」、**不**回退到 base64-content 路徑（no-silent-fallback rule）

---

## Acceptance Checks

對應 Requirements，所有條目 verified 階段必須過：

| AC# | 條件 | 對應 R |
|---|---|---|
| AC-01 | 在有效 session 上傳建立 `incoming/` + `.history/`，原子寫入原檔，履歷一筆 upload | R1-S1 |
| AC-02 | 無 session.project.path 上傳被拒絕、不退回快取 | R1-S2 |
| AC-03 | history API 回傳結構符合 `data-schema.json` | R2-S1 |
| AC-04 | 舊 version 履歷可被新 daemon 讀取無錯 | R2-S2 |
| AC-05 | docx 拆解後 `incoming/<stem>.docx` 與 `incoming/<stem>/` 並存 | R3-S1 |
| AC-06 | bundle cross-session 命中時不呼叫 mcp tool | R4-S1 |
| AC-07 | bundle miss 時正常 spawn mcp、結果 publish 回 incoming/ | R4-S2 |
| AC-08 | 已被改寫的檔案再上傳原版時走 conflict-rename，不被誤 dedupe | R5-S1 |
| AC-09 | 真正的同 hash 重複上傳走 dedupe，不重寫硬碟 | R5-S2 |
| AC-10 | mcp tool 寫 incoming/ 後履歷 append `tool:<name>` 一筆 | R6-S1 |
| AC-11 | Edit/Write/Bash tool 寫 incoming/ 後履歷 append | R6-S2 |
| AC-12 | drift 偵測在外部修改後讀履歷時觸發、補一筆 | R7-S1 |
| AC-13 | docxmcp container 啟動 mount 列表不含 host repo / HOME | R8-S1 |
| AC-14 | 上傳後 incoming/ 檔案在 git 中為 untracked，daemon 不自動 add | R9-S1 |
| ~~AC-15~~ | ~~引用舊 attachment cache ref 時失敗訊息明確、不退回~~ | ~~R10-S1~~ (v1, SUPERSEDED 2026-05-03) |
| AC-15a | 新上傳的 AttachmentBlob row 不含 `content` 欄位、含 `repoPath` + `sha256` | R10'-S1 |
| AC-15b | 含 `content` 的舊 row 仍能透過 `getAttachmentBlob` 讀回完整 bytes（背向相容） | R10'-S2 |
| AC-15c | 含 `repoPath` 的新 row 透過 `getAttachmentBlob` 從 repo 讀 bytes；repo 檔案不存在時明確報錯不退回 | R10'-S3 |
