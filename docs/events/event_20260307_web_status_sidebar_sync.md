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
- [x] 將 web todo list 對齊為 TUI-style checkbox list
- [x] 將 monitor 更新策略改為事件驅動 + debounce + 低頻 fallback
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
  - 移除先前粗暴的 `2s force sync/todo` 輪詢，todo 改為只依賴現有 event stream + `todo.updated` store 更新；首次缺資料時才補抓一次 `session.todo(...)`。
  - todo section 改為復用 TUI 語意的 checkbox list，而非彩色圓點卡片，且改回直接使用 store 原始順序，不再額外依 status 排序。
  - monitor 改為共用 `useStatusMonitor(...)` hook，由 event stream 驅動 refresh；僅在 monitor 相關事件與 busy 狀態時 debounce 更新，並保留低頻 fallback poll。
- `packages/app/src/pages/session/tool-page.tsx`
  - mobile / tool route 同步復用 `StatusTodoList` 與 `useStatusMonitor`，避免 desktop/mobile status 行為漂移；todo 也改回使用原始順序。
- `packages/app/src/pages/session/session-status-sections.tsx`
  - 顯示順序調整為：`servers` → `monitor` → `todo` → `mcp` → `lsp` → `plugins`。
  - 因此 task monitor / todo list 現在是第 2、3 順位。
  - 重新對齊 LSP section 與 TUI 語意：空狀態改為依 `config.lsp` 顯示 disabled / activate-on-read 訊息，列表內容改顯示 `id + root`，而非 web 原本僅顯示 `name || id`。
  - 各大區塊改為可收折（servers / monitor / todo / mcp / lsp / plugins），使 web session status sidebar 的互動模型向 TUI 靠攏。
- `packages/app/src/pages/session/status-todo-list.tsx`
  - 新增 web 版 todo checkbox list 呈現元件，對齊 TUI `TodoItem` 的 `[ ] / [•] / [✓] / [✗]` 語意。
  - 後續再修正為固定寬度 checkbox 方框，避免 `[]` 與 `[✓]` 文寬不一致造成視覺抖動。
- `packages/app/src/pages/session/use-status-monitor.ts`
  - 新增低負載 monitor hook：
    - 依賴既有 `sdk.event.listen(...)` 事件流
    - 對 `session.status` / `session.updated` / tool part lifecycle 做 debounce refresh
    - 不再只在 busy 狀態才接受 monitor relevant event；改成任何相關事件都可觸發，但透過 debounce + `MIN_REFRESH_MS` 控制頻率
    - 加入 page visibility gating：背景分頁不刷新、回到前景立即 refresh
    - fallback poll 調整為 `15s/90s`，仍遠低於固定 2 秒輪詢的負載
- `packages/app/src/pages/session/use-status-todo-sync.ts`
  - 新增 web 專用 todo sync hook：
    - 以 `todo.updated` 為主，不做持續輪詢
    - 在 status 面板開啟且該 session 尚未載入時補抓一次
    - 在 `session.status` 轉移、尤其進入 `idle` 時做一次校正抓取
    - 在頁面回到前景時做一次校正抓取，補上 web SSE 可能漏掉的時窗
- `packages/app/src/pages/session/monitor-helper.ts`
  - 補上與 TUI 對齊的 monitor 細節：
    - `idle` label 改為空字串
    - title 補上 agent suffix（若存在）
    - 隱藏和主狀態重複的 tool status（例如 `working + running`、`pending + pending`）

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Targeted diff confirms this round changed:
  - `packages/app/src/context/sync.tsx`
  - `packages/app/src/pages/session/session-side-panel.tsx`
  - `packages/app/src/pages/session/tool-page.tsx`
  - `packages/app/src/pages/session/session-status-sections.tsx`
  - `packages/app/src/pages/session/status-todo-list.tsx`
  - `packages/app/src/pages/session/use-status-monitor.ts`
  - `docs/events/event_20260307_web_status_sidebar_sync.md`
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪只修正 web status sidebar/session tool page 的 refresh 策略與 section 排序，未變更 runtime 架構邊界、API contract 或 provider/session ownership 模型。
