# Event: Web model manager submit-based session selection

## 需求

- 模型管理員中的 provider / account / model 任一點選都不應立即提交。
- 模型管理員中的 provider / account / model 任一點選都不應立即顯示 toaster。
- 只有在模型管理員右上角的 `Submit` 被按下時，才將目前 draft 選擇提交給系統。
- `Submit` 僅在 draft 與目前 session committed selection 有差異時顯示。
- 提交必須遵循 **per-session based** 規則，更新當前 session execution identity，而不是全域 active account。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/components/dialog-select-model.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.test.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/i18n/en.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/i18n/zht.ts`

### OUT

- 不改動 global active account route contract
- 不改動 rotation3d / fallback policy
- 不改動 session route schema

## 任務清單

- [x] 盤點模型管理員現有即時提交行為
- [x] 改為 provider/account/model 全部先寫入 draft state
- [x] 加入 dirty-aware Submit 按鈕
- [x] 只在 Submit 時提交當前 session execution
- [x] 補上純函式測試與驗證

## Debug Checkpoints

### Baseline

- 先前模型管理員存在混合語意：
  - 點 account 會顯示成功 toaster，但實際只是不穩定地非同步更新 session-local selection
  - 點 model 會立即提交 `{ providerId, modelID, accountId }`
- 使用者明確要求改成：任何變動都先不提交、也不顯示 toaster，統一由 `Submit` 觸發提交。

### Implementation

- `packages/app/src/components/dialog-select-model.tsx`
  - 新增 draft model key state，provider / account / model 點選全部只更新 dialog 內 draft。
  - 移除 account click / model click 的立即提交與 success toaster。
  - 新增 `hasPendingChanges` 比較 draft selection 與 committed session selection。
  - 右上角新增 `Submit` 按鈕，只有 dirty 時顯示。
  - `Submit` 按下時才呼叫 `local.model.set(..., { recent: true, interrupt: true, syncSessionExecution: true }, params.id)`，將 `{ providerID, modelID, accountID }` 一次提交到目前 session。
  - 提交成功後顯示單一 toaster，內容含 provider / account / model。
- `packages/app/src/components/model-selector-state.ts`
  - 新增 `pickSelectedModel()` 與 `sameModelSelectorSelection()`，將 draft/current dirty 判斷抽成純函式。
- `packages/app/src/components/model-selector-state.test.ts`
  - 新增 draft model 保留、fallback 到 committed model、selection equality 判斷測試。
- `packages/app/src/i18n/en.ts`, `zht.ts`
  - 新增 Submit 成功 toaster 文案。

### Root Cause

- 原問題的核心不是單一 API 壞掉，而是模型管理員將「點選草稿」與「正式提交」混在一起：
  - account click 給了成功感，但提交語意不完整
  - model click 才真正提交 session execution
- 本次改為 **draft-first / submit-once**，讓 UI 與實際提交邊界一致：
  - 點選 = 草稿
  - Submit = 真正提交

### Validation

- `bun test /home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.test.ts` ✅
- `bun test /home/pkcs12/projects/opencode/packages/app/src/components/prompt-input/submit.test.ts` ✅
- `bun run typecheck` (workdir=`/home/pkcs12/projects/opencode/packages/app`) ✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅調整 web model manager 的前端提交契約與 UI 行為，未改變長期架構邊界、session execution schema 或 provider/account runtime contracts。
