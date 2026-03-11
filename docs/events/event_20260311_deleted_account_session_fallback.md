## Requirements

- 當已註冊 account 被系統移除後，重新進入原本使用該 account 的 session，不可顯示失效帳號或錯誤值。
- 進入 session 時需檢查 session-local `{ providerId, modelID, accountId }` 的有效性。
- fallback 規則：
  1. 優先保留同 provider/model，改選同 provider 的其他有效 account
  2. 若同 provider 已無可用 account，退到其他有效 provider/model
  3. 若完全沒有可用 provider/model，顯示空值而不是失效帳號

## Scope

### In

- Web session local model resolver
- TUI session local model resolver
- 刪除 account 後 session hydrate / 顯示一致性

### Out

- 後端 migration
- accounts.json 自動清理舊 session message

## Task List

- [x] 釐清 Web/TUI session 進入時的 model hydrate 邊界
- [x] 實作刪除 account 後的 session-local account validity fallback
- [x] 驗證不再顯示失效帳號值
- [x] 記錄 architecture sync 結論

## Baseline

- 使用者回報：若某 session 原本使用的 account 已從系統移除，再切回該 session 會發生錯誤或顯示失效帳號值。
- 預期行為應是進入 session 當下自動做 validity 檢查與安全 fallback，而不是保留壞掉的 accountId。

## Instrumentation / Evidence

- `packages/app/src/context/local.tsx`
  - Web `resolveScopedSelection()` 原本只驗 `providerID/modelID` 是否存在與已連線，**沒有驗證 accountID 是否仍在 `account_families` 中**。
- `packages/opencode/src/cli/cmd/tui/context/local.tsx`
  - TUI `resolveScopedModel()` / `getFirstValidModel()` 原本同樣只看 model/provider 可用性，**沒有驗證 accountId 是否仍有效**。
- `packages/app/src/pages/session.tsx`
  - session page 會把 last user / last assistant 的 persisted `accountId` 持續同步回 local session selection；若不在 resolver 層做 validity 檢查，刪除後的失效 account 會一直被重灌回 UI。

## Root Cause

1. session-local model selection 的 resolver 原本只檢查 model/provider 是否可用。
2. account 被刪除後，persisted session selection 與 last message 中的 `accountId` 仍可能存在。
3. 因為 resolver 沒有 account validity 檢查，UI 仍會讀到已失效的 accountId，造成錯誤顯示或後續流程異常。

## Execution / Decisions

- Web (`packages/app/src/context/local.tsx`)
  - 新增 `availableAccountIds()` / `replacementAccountID()` / `sanitizeModel()`
  - 規則：
    - 若 account 仍存在，保留
    - 若同 provider 尚有其他 account，改用 active account 或第一個可用 account
    - 若該 provider 已無任何 account，回傳 `undefined`，交由後續 fallback candidate（recent/default/其他 provider）接手
- TUI (`packages/opencode/src/cli/cmd/tui/context/local.tsx`)
  - 新增 `availableAccountIds()` / `replacementAccountId()` / `sanitizeModelIdentity()`
  - 以相同策略在 `getFirstValidModel()` 前先校正失效 account
- 設計重點：將校正放在 resolver 層而不是 scattered UI 層，讓 Web/TUI 進入 session 時都能用同一套 fallback 邏輯，且不顯示錯誤值。

## Validation

- `bunx eslint /home/pkcs12/projects/opencode/packages/app/src/context/local.tsx /home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/local.tsx /home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx` ✅
- `bunx tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit` ✅
- `bunx tsc -p /home/pkcs12/projects/opencode/packages/opencode/tsconfig.json --noEmit` ✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪只是替既有 session-local selection contract 補上 account validity fallback，不改變長期模組邊界與 execution identity 契約。
