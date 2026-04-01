# Event: Google Bindings System Accounts

**Date**: 2026-04-01
**Branch**: `cms`

## Scope

### IN
- 新增三組 Linux system account 與 Google email 綁定需求
- 確認 gateway 使用的 binding registry 位置與 schema
- 驗證主機是否可直接寫入 `/etc/opencode/google-bindings.json`

### OUT
- 變更 repo runtime/source code
- 新增綁定管理 UI
- 變更 Google OAuth token storage (`gauth.json`)

## Requested Bindings
- `jerryliao` -> `fly990314working@gmail.com`
- `raysu` -> `wl01631699@gmail.com`
- `cmchen` -> `sho1798@gmail.com`

## Key Decisions
- 權威綁定檔維持為 `/etc/opencode/google-bindings.json`
- 綁定 schema 依現行 runtime 實作維持 `{"google_email":"linux_username"}`
- 不引入任何 fallback 檔案或替代寫入路徑

## Debug Checkpoints

### Baseline
- 使用者要求將三組 system account 綁定到指定 Gmail
- 既有 architecture / event 文件指出 gateway 以 `/etc/opencode/google-bindings.json` 為權威 registry

### Instrumentation Plan
- 讀取 architecture 與既有事件確認權威路徑
- 讀取現行 registry 檔與 runtime 相關程式碼確認 schema
- 嘗試以提權方式寫入並重讀驗證

### Execution
- 已讀取 `specs/architecture.md` 與 `docs/events/event_20260325_gateway_google_login_binding.md`
- 已確認 runtime schema 來源：`packages/opencode/src/google-binding/index.ts` 與 `daemon/opencode-gateway.c:534`
- 已驗證 `sudo -n true` 可用，但對 `/etc/opencode/google-bindings.json` 實際寫入失敗，錯誤為 `OSError: [Errno 30] Read-only file system`

### Root Cause
- 阻塞點是主機 `/etc/opencode` 掛載為唯讀檔案系統，不是權限、schema、或 repo 程式邏輯問題

### Validation
- 重新讀取 `/etc/opencode/google-bindings.json` 後，三筆需求綁定仍不存在
- `stat` 顯示目標檔案為 `root:root 664`，但底層檔案系統唯讀導致即使 sudo 仍無法落盤
- Architecture Sync: Verified (No doc changes) — `specs/architecture.md` 已正確記載 `/etc/opencode/google-bindings.json` 與 `OPENCODE_GOOGLE_BINDINGS_PATH` 契約，無需修訂

## Remaining
- 需由主機層解除 `/etc/opencode` 唯讀，或提供可寫的 `/etc/opencode` 環境後，再重試寫入三筆 bindings
- 解除唯讀後，應再次驗證 registry 內容包含三筆 `google_email -> linux_username` 映射
