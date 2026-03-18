# Event: Disable default sounds in webapp

Date: 2026-03-18
Status: Done

## 需求

將 webapp 中所有預設聲音效果改為 `none`。

## 範圍 (IN/OUT)

- IN:
  - `packages/app/src/context/settings.tsx` 中 `defaultSettings.sounds` 的初始值。
  - 修復因預設值變更而受影響的 e2e tests (`packages/app/e2e/settings/settings.spec.ts`)。
- OUT:
  - CLI 環境下的聲音效果（因題目僅限定 webapp）。
  - 既有使用者的已儲存設定（只改 defaultSettings 不影響 persisted data，這是合理的）。

## 任務清單

- [x] 修改 `packages/app/src/context/settings.tsx` 內的 `defaultSettings.sounds`。
  - 將所有的 `*Enabled` 設為 `false`。
  - 將所有的聲音 string 設為 `"none"`。
- [x] 更新 `packages/app/e2e/settings/settings.spec.ts` 內的測試斷言以符合新的預設值 `"none"`。

## Debug Checkpoints

- Baseline: 使用者希望取消 webapp 預設的聲音（通常會打擾人）。
- Execution: 修改 `defaultSettings.sounds` 中的 `agent`, `permissions`, `errors` 為 `"none"`。
- Validation: 確認修改後 webapp 型別檢查通過。

## Validation

- `bun run --cwd /home/pkcs12/projects/opencode/packages/app typecheck` ✅
- Architecture Sync: Verified (No doc changes). 這些只屬於 UI default state 改變，不影響系統架構。
