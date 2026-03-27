# Event: Cron Mobile Task Selection Fix

**Date**: 2026-03-27
**Related Event**: `/home/pkcs12/projects/opencode/docs/events/event_20260326_scheduled-tasks-ui.md`

## Requirement

在手機版 web 的 `/system/tasks` cron task list 中，點開 task list 後無法點選想看的 task；點選動作無效。

## Scope

### IN
- 調查手機版 cron task list 點擊無效的 root cause
- 以最小修復調整 task sidebar 的 mobile navigation 行為
- 做最小必要驗證並留下 evidence

### OUT
- 不重做 desktop sidebar 行為
- 不重構 cron task detail/page layout
- 不新增 fallback 或額外互動模式

## Task List

1. 讀取 architecture 與既有 scheduled-tasks event，建立 debug baseline
2. 偵查手機版 task selection 失效 root cause
3. 修復 mobile sidebar selection/navigation 行為
4. 驗證並同步 event / architecture

## Debug Checkpoints

### Baseline
- 症狀：手機版 web 開啟 cron task list 後，點選 task 無反應
- 影響範圍：`/system/tasks` 行動版 task sidebar interaction
- 相關邊界：task sidebar item click → router navigation → mobile sidebar visibility

### Instrumentation Plan
- 檢查 `packages/app/src/pages/task-list/*` 的 sidebar item click wiring
- 比對 desktop sidebar API 與 mobile sidebar API 的使用是否一致
- 以 targeted grep / diff / typecheck 驗證修補範圍

### Execution
- 讀取 `task-sidebar.tsx` 與 task-list page 組成
- 確認修復後 diff 只集中於 `task-sidebar.tsx`
- 用 grep 確認不再殘留 `layout.sidebar.close()` / `layout.sidebar.opened()` 的舊用法於 task-list slice

### Root Cause
- 手機版 cron task sidebar 點擊後仍走 `layout.sidebar` 的 desktop-oriented closing path，而非 `layout.mobileSidebar` 的行動版側欄控制面。
- 這使得手機情境下點擊 task 後沒有正確關閉 mobile sidebar，也沒有產生預期的 detail 切換可見結果，使用者感知為「點選無效」。

## Changes

- `packages/app/src/pages/task-list/task-sidebar.tsx`
  - 將 mobile task selection / duplicate / create 後的 sidebar handling 改為 `layout.mobileSidebar.hide()`
  - 移除 task click 中對 `layout.sidebar.opened()` / `layout.sidebar.close()` 的依賴

## Verification

- `git diff -- packages/app/src/pages/task-list`
  - 變更僅集中於 `task-sidebar.tsx`
- `grep "mobileSidebar\\.hide\\(|layout\\.sidebar\\.close\\(|layout\\.sidebar\\.opened\\(" packages/app/src/pages/task-list/*.tsx`
  - 僅保留 `layout.mobileSidebar.hide()` 3 處；task-list slice 不再使用舊的 `layout.sidebar.close/opened` 路徑
- `bun x tsc -p packages/app/tsconfig.json --noEmit`
  - 可執行完成，未見新增 typecheck failure evidence

## Key Decisions

1. 採最小修復：只修正 task-list slice 的 mobile sidebar API 使用，不擴大到 layout 架構改寫。
2. 不引入 fallback 或雙寫 desktop/mobile sidebar state；手機互動直接使用既有 `layout.mobileSidebar` 單一路徑。

## Architecture Sync

Architecture Sync: Verified (No doc changes)

Basis:
- 此修復僅是既有 app layout control API 的正確使用修正。
- 無新增模組邊界、資料流、狀態機或 observability surface。

## Remaining

- 建議後續用實機或瀏覽器 responsive mode 做一次手機版 `/system/tasks` smoke test，確認選取 task 後 detail pane 顯示符合預期。
