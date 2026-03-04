# Event: Add Architecture Doc Maintenance Gate

Date: 2026-03-04
Status: Done

## 1) 需求

- 使用者關注 `docs/events` 與 `docs/ARCHITECTURE.md` 的持續維護，要求將架構文件維護明文化為專案規範。
- 使用者補充：`docs/ARCHITECTURE.md` 不採累進式記錄，必須每次任務都嚴格同步程式架構全貌。
- 使用者要求：在專案 `AGENTS.md` 明確規定每開新 session 必讀 `docs/ARCHITECTURE.md`。

## 2) 範圍 (IN/OUT)

### IN

- 更新 `<repo>/AGENTS.md`：新增 Architecture 文件同步門檻與 release checklist 對應項。
- 更新 `<repo>/templates/AGENTS.md`：同步新增相同門檻，避免模板與專案規範漂移。

### OUT

- 不修改 `docs/ARCHITECTURE.md` 內容本身。
- 不調整 SYSTEM prompt 載入邏輯與 runtime 程式碼。

## 3) 任務清單

- [x] 在 `AGENTS.md` 新增 Architecture 文件同步門檻。
- [x] 在 `AGENTS.md` release checklist 新增 Architecture 維護檢查項。
- [x] 在 `templates/AGENTS.md` 同步新增對應規範。
- [x] 在 `AGENTS.md` 維護原則新增「新 session 必讀 `docs/ARCHITECTURE.md`」要求。
- [x] 補齊 debug checkpoints 與 validation 紀錄。

## 4) Debug Checkpoints

### Baseline

- 現況：`AGENTS.md` 已強制 `docs/events` 留痕與 checkpoint，但未將 `docs/ARCHITECTURE.md` 設為完成門檻。
- 風險：架構實作與架構文件可能長期漂移，後續維護成本上升。

### Execution

- 在 `AGENTS.md`「跨專案 SOP 基線」第 5 條改為 **全貌同步規範**，要求：
  - `docs/ARCHITECTURE.md` 採全貌同步，不採累進式變更流水帳。
  - 每次非瑣碎任務收尾前都要做 Architecture 同步檢查（必要時改寫文件章節）。
  - 若無文件差異，也需在 event Validation 註記 `Architecture Sync: Verified (No doc changes)` 與比對依據。
  - 未完成 Architecture 同步檢查與紀錄不得宣告完成。
- 在 `AGENTS.md`「Release 前檢查清單」新增對應檢查項。
- 在 `AGENTS.md`「維護原則」新增：每次開啟新 session（Main Agent）處理本專案前，必讀 `docs/ARCHITECTURE.md`。
- 在 `templates/AGENTS.md`「開發流程硬性框架」同步新增同條款。

### Validation

- 文檔變更完成，已確認以下檔案包含新規範：
  - `/home/pkcs12/projects/opencode/AGENTS.md`
  - `/home/pkcs12/projects/opencode/templates/AGENTS.md`
- 已確認 `/home/pkcs12/projects/opencode/AGENTS.md` 含「Session 啟動必讀 Architecture」條款。
- `Architecture Sync: Verified (No doc changes)`（本次僅調整流程規範，程式架構實作未變更，無需改寫 `docs/ARCHITECTURE.md` 內容）。
