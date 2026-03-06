# Event: web status sidebar sync with TUI session state

Date: 2026-03-07
Status: In Progress

## 需求

- 修正 webapp session status sidebar 中 todo / task monitor 與 TUI 同一 session 狀態不同步
- 將 status sidebar 內 task monitor / todo list 的顯示順序提高到第 2、3 順位
- 維持 cms 現有 session/web runtime 架構，不做高風險重構

## 範圍

### IN

- `packages/app/src/context/sync.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/tool-page.tsx`
- `packages/app/src/pages/session/session-status-sections.tsx`

### OUT

- 不調整 backend event protocol
- 不改動 TUI 本身 monitor/todo 呈現
- 不處理與本次 sidebar 無關的其他 status 面板內容

## 任務清單

- [x] 追查 web status sidebar 的 todo / monitor 資料流
- [x] 修正 session / todo force refresh 與 sidebar polling
- [x] 調整 task monitor / todo list 顯示順序
- [x] 驗證 typecheck
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- web status sidebar 的 todo 目前只在 `sync.data.todo[sessionID] === undefined` 時抓取一次，之後缺少主動 refresh。
- status sidebar 的 task monitor 雖然會定時呼叫 `session.top(...)`，但 monitor 組裝仍依賴 `sync.data.session_status` 與 session/message 快取，若 web store 未 refresh，會與 TUI 同 session 狀態脫節。
- `packages/app/src/context/sync.tsx` 的 `session.sync(sessionID, { force: true })` 目前只略過 early return，但在 `hasSession/hasMessages/hydrated` 已成立時仍不會真正 refetch，force 語意不完整。
- `SessionStatusSections` 目前順序為 servers / mcp / lsp / plugins / todo / monitor，未符合使用者要求的第 2、3 順位。

### Execution

- `packages/app/src/context/sync.tsx`
  - 修正 `session.sync(sessionID, { force: true })` 的 force 語意：現在 force 會真正重新抓取 session 與 message hydration，而不是只跳過 early return。
  - `session.todo(...)` 新增 `force` 支援，讓 status sidebar 可以定期重新抓取最新 todo。
- `packages/app/src/pages/session/session-side-panel.tsx`
  - status sidebar 開啟時，對 active session 每 2 秒執行一次 `sync.session.sync(..., { force: true })` 與 `sync.session.todo(..., { force: true })`。
  - monitor 原有 `session.top(...)` polling 保留，因此 sidebar 會同時刷新 monitor raw data 與 web store 狀態。
  - monitor section 改成使用 `initialized` 門檻：只在首次尚未取得任何結果前顯示 loading；後續輪詢即使資料為空，也不再反覆閃出 `Loading monitor...`。
- `packages/app/src/pages/session/tool-page.tsx`
  - mobile / tool route 版本同步套用相同 polling 策略，避免 status tool page 與 desktop sidebar 行為漂移。
  - monitor 改為和 sidebar 一樣使用 store + 2 秒輪詢，而不是只在 route 進入時抓一次。
  - 同步套用 `initialized` 邏輯，只保留首次無資料載入時的 loading，避免空 monitor 在輪詢時重複閃爍。
- `packages/app/src/pages/session/session-status-sections.tsx`
  - 顯示順序調整為：`servers` → `monitor` → `todo` → `mcp` → `lsp` → `plugins`。
  - 因此 task monitor / todo list 現在是第 2、3 順位。
  - 重新對齊 LSP section 與 TUI 語意：空狀態改為依 `config.lsp` 顯示 disabled / activate-on-read 訊息，列表內容改顯示 `id + root`，而非 web 原本僅顯示 `name || id`。
  - 各大區塊改為可收折（servers / monitor / todo / mcp / lsp / plugins），使 web session status sidebar 的互動模型向 TUI 靠攏。

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Targeted diff confirms this round changed:
  - `packages/app/src/context/sync.tsx`
  - `packages/app/src/pages/session/session-side-panel.tsx`
  - `packages/app/src/pages/session/tool-page.tsx`
  - `packages/app/src/pages/session/session-status-sections.tsx`
  - `docs/events/event_20260307_web_status_sidebar_sync.md`
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪只修正 web status sidebar/session tool page 的 refresh 策略與 section 排序，未變更 runtime 架構邊界、API contract 或 provider/session ownership 模型。
