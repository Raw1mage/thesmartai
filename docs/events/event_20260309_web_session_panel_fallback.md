# Event: web session panel fallback

Date: 2026-03-09
Status: Done

## 需求

- 當 webapp 進入 `/{dir}/session` 且沒有自動進入最近 session 時，不要停在黑畫面。
- 改成主動顯示 `/session` 的 panel，讓使用者立即看到 session list / workspace panel。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260309_web_session_panel_fallback.md`

### OUT

- 本輪不修 recent-session autoselect root cause
- 不改 server session selection policy
- 不改 desktop layout 結構

## 任務清單

- [x] 釐清 `/{dir}/session` 無 active session 時的現況
- [x] 加入 mobile panel fallback
- [x] 驗證 typecheck 與 event 記錄

## Debug Checkpoints

### Baseline

- 目前 `navigateToProject(...)` 在找不到 remembered/latest session 時，會 fallback 到 `/{dir}/session`。
- `packages/app/src/pages/session.tsx` 在 `params.id` 不存在時，main pane 走 `NewSessionView`。
- 在 mobile / webapp 使用情境下，這條 fallback 會讓使用者感知成黑畫面，且看不到 session panel，UX 不佳。

### Execution

- 在 `packages/app/src/pages/session.tsx` 新增 route-level fallback：
  - 當進入 `/{dir}/session`
  - 且 `params.id` 不存在
  - 且目前為 non-desktop layout
  - 自動執行 `layout.mobileSidebar.show()`
- 這樣在 webapp/mobile 情境下，即使 recent-session autoselect 沒有命中，也不會讓使用者只看到主畫面空區；會直接看到 workspace/session panel。
- 本輪刻意不去修 `navigateToProject(...)` 的 recent-session 選擇策略，只補 UX fallback。

### Validation

- `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）⚠️
  - 目前 `packages/app/src/pages/session/helpers.test.ts` 存在既有型別錯誤：`SessionStatusSummary.debugLines` 缺失。
  - 本錯誤與本輪 `session.tsx` panel fallback 修改無直接關聯，屬 repo 既有 baseline noise。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅新增 mobile `/session` fallback UX，不改變 current-state architecture boundary 或 runtime topology。
