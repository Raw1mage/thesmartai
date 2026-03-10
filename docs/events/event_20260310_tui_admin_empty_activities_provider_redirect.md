# Event: TUI Admin Empty Activities Provider Redirect

Date: 2026-03-10
Status: Done

## 1. 需求

- 為 TUI `/admin` 新增引導行為。
- 當 `Model Activities` 為空時（尤其首次安裝、尚無 favorites / recent / rate-limit 活動的使用者），開啟 admin panel 時不要停在空白活動頁。
- 改為直接帶使用者進入 providers page，方便立刻新增/管理 provider 與 account。

## 2. 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260310_tui_admin_empty_activities_provider_redirect.md`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`

### OUT

- 不調整 provider/account/model 的資料結構
- 不修改 Web admin 行為
- 不重做 `/admin` 整體分頁結構

## 3. 任務清單

- [x] 讀取 architecture 與既有 TUI 事件脈絡
- [x] 定位 `/admin` 預設 page / step 與 activities 空態來源
- [x] 實作 activities 為空時的首次進入自動跳轉
- [x] 執行相關驗證
- [x] 更新本 event 與 architecture sync 結論

## 4. Debug Checkpoints

### Baseline

- `/admin` 目前預設停在 `page = "activities"`。
- `activityData().stats.total === 0` 時畫面只顯示空狀態，對新使用者缺乏下一步引導。
- providers 實際上已存在於同一個 dialog 的第二個 page（`page = "providers"`），可以沿用，不需要新增新 panel。

### Instrumentation Plan

- 檢查 `dialog-admin.tsx` 的 `page` / `step` 初始值與 `goBack` / `goForward` 流程。
- 只在首次進入、且沒有 `targetProviderID` 深連結覆蓋時自動切頁。
- 避免做成持續 reactive 強制跳頁，保留使用者手動返回/切換的能力。

### Execution

- 已在 `dialog-admin.tsx` 增加一次性 auto-open gate，條件為：
  - 未指定 `targetProviderID`
  - `page === "activities"`
  - `step === "root"`
  - `activityData().stats.total === 0`
- 命中條件時自動切到 `providers` page。

### Root Cause

- 問題不在資料缺失，而在 `/admin` 的預設入口固定落在 activities page。
- 對空資料的新使用者，這個入口沒有提供可操作的下一步，因此需要入口層級的導頁補強。

### Validation

- `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/opencode`）
  - 通過
- `bun test /home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/component/dialog-admin-auto-open.test.ts`
  - 通過（5 tests / 0 fail）
- `git diff -- packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx docs/events/event_20260310_tui_admin_empty_activities_provider_redirect.md`
  - 通過；確認為最小變更，僅新增一次性 auto-open gate 與 event 記錄
- `git diff --stat -- packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx docs/events/event_20260310_tui_admin_empty_activities_provider_redirect.md`
  - 通過；runtime 變更僅 `dialog-admin.tsx` 13 行新增
- 額外測試結構：
  - 新增純函式 `packages/opencode/src/cli/cmd/tui/component/dialog-admin-auto-open.ts`
  - 新增單元測試 `packages/opencode/src/cli/cmd/tui/component/dialog-admin-auto-open.test.ts`
  - 理由：避免直接掛載 TUI JSX runtime，讓導頁條件可穩定驗證
- Architecture Sync: Verified (No doc changes)
  - 依據：本次只調整 `/admin` 既有 page 入口條件，未改變 TUI/admin 模組邊界、資料流或狀態機結構；`docs/ARCHITECTURE.md` 目前已有 TUI `/admin` provider operation pipeline 描述，無需改寫
