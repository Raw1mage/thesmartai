# Proposal: repo-incoming-attachments

## Why

- ~~目前 opencode 收到的對話上傳檔案，落在 `~/.local/state/opencode/attachments/<refID>.docx` —— 是不透明的內容定址快取~~（v1, SUPERSEDED 2026-05-03 — mental model 錯誤，無此檔案路徑）
- **(v2, ADDED 2026-05-03)** 目前 opencode 收到的對話上傳檔案，**整份內容 base64 包進 `SessionStorage.AttachmentBlob.content: Uint8Array`，存進該 session 的 storage backend**（LegacyStore 為 message-tree 下的 JSON envelope；SqliteStore 為 SQLite blob 欄）。使用者看不到、不存在於檔案系統、跨 session 完全無法重用（per-session row）、跟使用者所屬的「專案」沒有關聯、會把 session DB 撐肥。
- 文件不該是過水的暫存物。它是專案的一份子，應該歸位到專案資料夾，跟著專案一起走。
- 經過 mcp 工具拆解的中間產物（例如 docx 拆出來的 description.md / outline.md / media/）也不該丟。它是已花費的計算成果，後續編修、重組、查詢都會再用到。
- 既然這些檔案的內容會被工具改寫，「同一個檔名在不同時點是不同內容」會發生。需要一張**履歷表**追蹤每個檔案的內容指紋變遷，否則「同一檔名是否重複」這個簡單問題就答不準。

## Original Requirement Wording (Baseline)

> 我只是突然想到一件事，這種文件上傳不應該只是在 mcp 用 tmp 的方式處理後就拋掉。這些文件應該屬於 repo 的一部份，除了要依照使用者的要求完整安置他們在 repo 中所屬的位置之外，被 mcp 拆解出來的中間產物也應該留著做為後續處理的基礎。這樣才不會浪費一絲一毫的計算成果。

> 1. repo 就是 session 所屬 repo
> 2. 檔案進 repo 的時機就是透過對話上傳的時候一律放進 /incoming 或 /upload，而其被拆解的中間產物以同名資料夾存放
> 3. docker mcp 只針對 python runtime 做容器，但是它的外圍還是可以有系統層級的控制腳本存在……檔案安置這件事應該是 opencode runtime 的責任，還用不到外部 mcp。跟 mcp 溝通的是 opencode runtime。不是讓 mcp 去 mount 很大的範圍來寫檔。
> 4. 同樣 hash 的檔案可跨 session 重用。
> 5. 我不懂為什麼 attachment 要進 cache。沒有 mcp 處理的 raw data 放 cache 有意義嗎？

> 如果上傳檔案有被程式後處理而改變了 hash，要記錄新 hash。這樣第二次上傳原檔案才能被允許。

> 履歷表放在 `incoming/.history`。

## Requirement Revision History

- 2026-05-02 初稿（mode `new`）— 原始需求由 session 對話原樣記錄、白話文版確認後納入
- 2026-05-03 in-place 修正（implementing 中的 spec drift discovery，無正式 mode 轉換因為 revise mode 規則僅允許 `living → designed`）— phase 2 開工時發現原 spec 對 attachment 儲存層 mental model 錯誤：實際是 `SessionStorage.AttachmentBlob`（per-session SQLite blob 或 LegacyStore base64 envelope，存在 `["attachment", sessionID, refID]` storage key），**並非** `~/.local/state/opencode/attachments/<refID>.docx` 的 plain-file content-addressed cache。本檔 R10 / DD-10 / INC-3001-2 / TV-04 / TV-11 / tasks 2.5-2.6 全部標 SUPERSEDED 並補上正確段落（R10' / DD-17 等）。phase 1 寫好的 incoming/ 模組與本次 drift 無關，繼續有效。

## Effective Requirement Description

1. 對話中上傳的任何檔案，一律落到該 session 所屬專案根目錄下的 `incoming/`，並保留檔名（如有衝突另議）。
2. 該檔案的所有衍生產物（mcp 工具拆解結果、後續再處理結果）放在 `incoming/<檔名同名子資料夾>/` 下。原檔與其衍生資料夾並存。
3. 每個 incoming 檔案有一份履歷，紀錄歷次內容指紋變化，無論是上傳事件或工具改寫事件。履歷一檔一份，存於 `incoming/.history/<原檔名>.jsonl`，per-line append。
4. 重複偵測比對的是**現場目前的指紋**，不是歷史上看過的指紋。同名異內容、同名同內容、同內容異名各有不同處理規則。
5. ~~既有的「opencode attachment 內容定址快取」機制（`~/.local/state/opencode/attachments/<refID>.*`）就此功成身退；上傳事件直接寫入專案 `incoming/`，不再經過快取層。~~（v1, SUPERSEDED 2026-05-03 — 不存在此檔案路徑）

5'. **(v2, ADDED 2026-05-03)** 既有的「`SessionStorage.AttachmentBlob` 把上傳內容 base64 嵌入 session storage」做法就此終結。上傳事件直接寫入專案 `incoming/`，session storage 改存**輕量引用**（`refID`、`repoPath`、`sha256`、metadata），不再持有 `content: Uint8Array`。舊 session 的 AttachmentBlob row（含 base64 content）保留可讀，新 session 只寫引用。
6. mcp 容器（含未來其他語言的 mcp app）的掛載邊界不變：只看自家工作區（`/state`）。檔案搬運、專案語意理解、履歷管理皆是 opencode runtime 的職責。
7. 同內容跨 session 重用：當不同專案上傳了內容指紋相同的檔案，工具計算結果（例如 docxmcp bundle）可以查到並複用，不重算。

## Scope

### IN
- opencode 上傳處理路徑改寫：從寫入內容定址快取，改成寫入 session.project.path/`incoming/`。
- `incoming/.history/<filename>.jsonl` 履歷格式定義 + 寫入點植入。
- 工具派發層的指紋變遷 hook：當 Edit / Write / Bash / mcp 工具寫入 `incoming/**` 後，補一筆履歷。
- 「現場指紋」查詢的安全網：讀履歷時若 stat（mtime/size）對不上最新一筆，重算並補一筆 `source: drift-detected`。
- 衝突命名規則：同名異內容自動 suffix `(N)`。
- 跨 session 共用計算成果的 dispatcher 介面（hash 為 key 的 lookup）。
- docxmcp 與 opencode runtime 之間的呼叫合約調整 — docxmcp 仍然只認 `/state` 路徑，opencode 負責把 incoming 檔案 stage 進去、把產物搬出來。

### OUT
- 自動 `git add` / 自動 commit。incoming 檔案是否進 git 由使用者自決。
- attachment 內容定址快取的反向相容（既有快取檔案不遷移、不刪除；新流程不再寫入該位置）。
- mcp 容器邊界擴大、跨容器掛載、$HOME 大範圍 mount。
- mcp-idle-unload（process lifecycle，獨立 spec `mcp-idle-unload/` 暫存於 proposed 中）。
- 非 docxmcp 的其他 mcp app 的 stage/搬運實作 — 本 spec 只定義通用契約，docxmcp 是第一個落地的範例。

## Non-Goals

- 自動偵測使用者在 git working tree 之外手動修改檔案（範圍邊界僅限 incoming/）。
- 多人協作場景的 incoming 衝突解決（單人 daemon 視角）。
- 對 incoming 內容做即時防毒、AV 掃描、內容審查 — 那是另一條治理面向。

## Constraints

- 上傳路徑必須對 session 所屬專案 path 解析正確，否則整套會把檔案寫錯位置。需要明確 fail-fast：若無 session.project.path 則拒絕上傳並回覆使用者。
- 履歷格式必須 forward-compatible — 未來新增欄位不能讓舊履歷失效。每行一筆 JSON、每筆有 `version` 欄位。
- 同檔重複指紋判斷必須安全 — 任何疑慮（履歷不完整、stat 與 hash 不一致）一律重算，不要做樂觀假設。
- 不可破壞現有 attachment HTTP API 的回傳格式 — 客戶端（web、TUI）拿到的仍是「可下載的引用」，但 path 從快取轉成 `<repo>/incoming/<filename>`。

## What Changes

- 上傳事件處理：建立 `incoming/` 與 `incoming/.history/`（若不存在），原子寫入 `incoming/<filename>`，append 履歷一筆 `{ts, source: upload, sha256, sessionId, sizeBytes, mime}`。
- 工具派發層 hook：tool call 回傳後，若該 call 動到 `<repo>/incoming/**`，重算受影響檔案的 sha256，append 履歷一筆 `{ts, source: tool:<name>, sha256, sessionId}`。
- mcp app dispatcher：當 mcp tool 接受 `incoming/<filename>` 作為輸入時，opencode runtime 先 cp 到 `~/.local/state/docxmcp/staging/<sha>.<ext>`，呼叫 mcp 工具給的是這個 staging 路徑；產物落 `~/.local/state/docxmcp/bundles/<sha>/`，opencode runtime 負責 cp 回 `incoming/<filename-stem>/`。
- 同 hash 跨 session 共用：dispatcher 在呼叫 mcp 之前先檢查 `bundles/<sha>/` 是否存在；存在就略過 mcp、直接 publish。

## Capabilities

### New Capabilities

- `repo.incoming-folder`：對話上傳檔案歸位至專案 `incoming/`。
- `repo.attachment-history`：每檔履歷追蹤（upload / tool-write / drift-detected 三種來源事件）。
- `repo.bundle-coresidence`：mcp 拆解產物與原檔同處 `incoming/<filename-stem>/`。
- `runtime.hash-keyed-bundle-cache`：跨 session 計算成果共用，hash 為唯一鍵。
- `mcp-dispatcher.staging-stewardship`：opencode runtime 對 mcp 容器邊界外的搬運責任。

### Modified Capabilities

- 既有「對話上傳→attachment 內容定址快取」改為「對話上傳→專案 incoming/」。
- 既有「mcp tool input path 是快取路徑」改為「opencode runtime stage 後傳給 mcp 的是 staging 路徑」（對 mcp tool 端透明）。
- 既有「重複上傳依 hash 去重」改為「依**現場指紋**去重」（hash 履歷修正了原本的盲點）。

## Impact

- **影響的程式碼**
  - `packages/opencode/src/tool/attachment.ts` — 上傳寫入路徑、metadata 結構
  - `packages/opencode/src/server/routes/file.ts` 或對應上傳 API — request handling 改寫
  - `packages/opencode/src/tool/` 工具派發層 — incoming 路徑寫入後 hook
  - `packages/opencode/src/mcp/index.ts` — mcp tool dispatcher 加 staging/publish 步驟
  - 新增 `packages/opencode/src/incoming/` 模組（暫定）— 履歷格式 + 履歷 IO + 衝突命名 + drift 偵測

- **影響的 API**
  - 上傳 API 的回傳：attachment_ref 結構新增 `repoPath`、`sha256`、`historyVersion`，原有 `refID` 回退為相容欄位
  - 新增 `GET /api/v2/incoming/history?path=<...>` 讀取履歷（後續 web UI 用）

- **影響的 docs**
  - `specs/architecture.md` 增段：incoming/ 模型 + 履歷契約 + mcp dispatcher 邊界
  - 既有 docxmcp 文件 `HANDOVER.md`「不要重新討論」清單中「Bundle 預設落點：XDG_STATE + by-session」需標記 SUPERSEDED → 指向本 spec

- **影響的使用者**
  - 既有上傳到專案的檔案會立即出現在專案 `incoming/`；可被 git 看到（但不自動 add）
  - mcp tool 結果路徑使用者實際可見可讀
  - web UI 的 attachment 卡片或許需要展示 `<repo>/incoming/<filename>` 而非黑盒 ID

- **遷移**
  - 舊 `~/.local/state/opencode/attachments/` 內容物保留現狀，但 daemon 不再讀寫（讀舊 ref 時若沒 incoming 對應就明確報錯，符合 no-silent-fallback memory rule）
  - 新流程上線前已開啟的 session：仍指向舊快取的 attachment_ref 暫時可讀，但若該 ref 對應的真實檔案已被新流程取代則優先使用新版

## Decisions Locked-in

| # | 決定 | 預設值 / 細節 |
|---|---|---|
| A | 落地資料夾 | `incoming/` |
| B | git 行為 | 不自動 add（使用者自決）|
| C | 履歷位置 | `incoming/.history/<filename>.jsonl`（in-tree、per-file、每行一筆 JSON）|
| D | 同名異內容 | suffix `(2)`、`(3)`…，獨立 entry |
| E | 同名同內容 | dedupe，回現有 entry，但仍 append 履歷一筆（`source: upload-dedupe`）|
| F | 同內容異名 | 視為新檔處理，計算成果可透過 sha-keyed cache 共用 |
| G | hash 變更追蹤 | tool dispatcher hook（主路）+ stat-based drift 偵測（safety net）|
| H | 重複判斷 | 比對**現場目前指紋**，非歷史指紋 |
| I | mcp 容器邊界 | 不變，僅看 `/state`；搬運責任在 opencode runtime |

## Open Questions（待 designed 階段收斂）

- **OQ-1**：履歷 JSON 欄位的最終 schema（version、ts、source enum、sha256、sessionId、sizeBytes、mime、annotation）— `data-schema.json` 階段定稿。
- **OQ-2**：drift 偵測觸發點 — 每次讀履歷都驗、僅在 lookup-by-hash 時驗、抑或週期性驗。傾向「lookup 時 cheap stat」。
- **OQ-3**：staging 區命名 — `~/.local/state/docxmcp/staging/` vs 通用 `~/.local/state/opencode/mcp-staging/<app-id>/`。後者較通用，前者較直觀。
- **OQ-4**：bundle 跨 session 命中時是否 hard-link 而非 cp，避免重複佔空間。要評估 hard-link 在 bundle 後續被使用者改寫時的副作用。
- **OQ-5**：incoming 路徑包含特殊字元（如 emoji、控制字元）的命名 sanitization 規則。
- **OQ-6**：履歷 jsonl 的 rotation / size cap 規則 — 一個檔案改寫上千次會讓履歷膨脹。
