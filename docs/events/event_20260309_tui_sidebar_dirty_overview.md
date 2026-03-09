# Event: TUI Sidebar Dirty Overview

Date: 2026-03-09
Status: Done

## 需求

- TUI sidebar 不再顯示一般 file tree / 無關清單。
- TUI sidebar 應比照 webapp `檔案異動`，只列出跟目前 session 相關、且目前仍 uncommitted 的檔案。
- 保留 dirty 概況可讀性，但避免 sidebar 內出現過多逐檔 diff 細節。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx`（僅確認資料來源，不預設改動）
- `/home/pkcs12/projects/opencode/docs/events/event_20260309_tui_sidebar_dirty_overview.md`

### OUT

- 不重做 backend `session.diff` contract
- 不擴大修改 webapp dirty bubble / review panel
- 不新增大型 sidebar 資訊區塊，只做最小 UX 收斂

## 任務清單

- [x] 確認 TUI sidebar 現行 diff 資料來源是否已是 session-owned dirty diff
- [x] 定義 TUI sidebar dirty overview 的最小顯示格式
- [x] 實作 UI 收斂，移除佔版面的檔案清單
- [x] 驗證型別/測試
- [x] 記錄 Architecture Sync 判定

## Debug Checkpoints

### Baseline

- 使用者回饋 TUI sidebar 不該顯示一般 sidebar file list。
- 使用者真正需要的是：像 webapp 一樣，只列出跟當前 session 有關、且目前仍 uncommitted 的檔案。
- 初步檢查顯示 TUI `sync.session.sync(sessionID)` 已呼叫 `sdk.client.session.diff({ sessionID })`，理論上可直接沿用 runtime-owned session diff。

### Execution

- 確認 TUI sidebar `diff` 來源為 `sync.data.session_diff[sessionID]`，而 `sync.session.sync(sessionID)` 會透過 `sdk.client.session.diff({ sessionID })` hydrate；因此資料來源本身已與 webapp 對齊到 runtime-owned session dirty diff contract。
- 本輪調整聚焦在 sidebar 呈現層：保留 session-owned uncommitted file list，但拿掉 `+/-` 逐檔數字與過度醒目的「Modified Files」語意，改為更貼近 webapp 的 `Uncommitted Files` 清單與 dirty count 概念。
- 依使用者後續回饋，再把區塊標題改為 `Changes`，並讓左側收折按鈕永遠顯示、預設收合，避免 sidebar 初始佔用過多高度。

### Validation

- 驗證指令：`bun run --cwd /home/pkcs12/projects/opencode/packages/opencode typecheck`
- 結果：passed
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅調整 TUI sidebar 的 session-owned dirty file 呈現文案與密度，未變更 `session.diff` runtime contract、資料流邊界或模組責任。
