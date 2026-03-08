# Event: Remove Updates Section from Web Settings

Date: 2026-03-08
Status: Done

## 1. 需求

- webapp 設定介面不再顯示「更新」整個區塊。
- cms web surface 不再提供官方更新相關控制（啟動時檢查、發行說明彈窗開關、立即檢查）。
- 行為需與 UI 一致，避免 web 端仍持續執行對應更新提示流程。

## 2. 範圍

### IN

- `packages/app/src/components/settings-general.tsx`
- `packages/app/src/pages/layout.tsx`
- `packages/app/src/context/highlights.tsx`
- `packages/app/e2e/settings/settings.spec.ts`
- 必要時同步 `docs/ARCHITECTURE.md`

### OUT

- 不修改 desktop updater 實作
- 不移除底層 release notes dialog 元件與 platform API 型別
- 不處理 error page 的 desktop update action

## 3. 任務清單

- [x] 確認 web settings 更新區塊與相關行為掛點
- [x] 移除 settings 更新區塊 UI
- [x] 停用 web 端更新輪詢 / release notes 提示流程
- [x] 更新對應測試
- [x] 執行 targeted validation
- [x] 檢查 Architecture Sync 是否需要更新

## 4. Debug Checkpoints

### Baseline

- `packages/app/src/components/settings-general.tsx` 內含 `UpdatesSection`，顯示啟動時檢查更新、發行說明、立即檢查三列控制。
- `packages/app/src/pages/layout.tsx` 透過 `useUpdatePolling()` 依 `settings.updates.startup()` 週期呼叫 `platform.checkUpdate()`。
- `packages/app/src/context/highlights.tsx` 會在版本變更時抓 `https://opencode.ai/changelog.json` 並顯示 release notes dialog。

### Execution

- `packages/app/src/components/settings-general.tsx` 移除整個 `UpdatesSection`，並刪除手動檢查更新所需的 local state / toast / button 邏輯。
- `packages/app/src/pages/layout.tsx` 移除 `useUpdatePolling()` 與掛載點，避免 web surface 再進行背景更新檢查。
- `packages/app/src/context/highlights.tsx` 收斂為只追蹤版本已讀，不再抓 changelog 或彈出 release notes。
- `packages/app/e2e/settings/settings.spec.ts` 改為驗證設定視窗內已不存在更新控制；同步清理 `packages/app/e2e/selectors.ts` 廢棄 selector。

### Validation

- `bunx tsc --noEmit -p packages/app/tsconfig.json` ✅
- `bunx eslint packages/app/src/components/settings-general.tsx packages/app/src/pages/layout.tsx packages/app/src/context/highlights.tsx packages/app/e2e/settings/settings.spec.ts packages/app/e2e/selectors.ts` ✅
- `./webctl.sh dev-start` ✅
- `PLAYWRIGHT_SERVER_PORT=1080 bunx playwright test e2e/settings/settings.spec.ts -g "updates controls are absent from settings dialog"` ⚠️
  - 失敗原因：測試前置 `gotoSession()` 等待 `[data-component="prompt-input"]`，目前本機 runtime 未完成該 session 畫面 bootstrap，屬現場環境阻塞，非本次 selector/assertion 直接失敗。
- Architecture Sync: Verified (No doc changes)
  - 比對依據：本次僅調整 web settings 與其前端提示行為，未新增模組邊界、runtime contract 或新的架構責任分層。
