# Event: Auto Yes Slash Commands

Date: 2026-03-08
Status: Done

## 需求

- 移除 webapp prompt 對話框中的 auto-accept toggle 按鈕。
- 以 slash commands 取代該 UI 控件。
- 新增 `/auto-yes-enabled` 與 `/auto-yes-disabled` 兩個命令作為切換入口。
- 系統啟動後預設為 auto yes enabled。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/packages/app/src/context/permission.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/use-session-commands.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/prompt-input.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_auto_yes_slash_commands.md`

OUT:

- 後端 permission protocol 變更
- TUI 對應 UI 調整
- 新增參數式 slash parser

## 任務清單

- [x] 盤點現有 auto-accept toggle 與 slash command plumbing
- [x] 實作 `/auto-yes-enabled` 與 `/auto-yes-disabled`
- [x] 將 auto-accept 預設狀態調整為啟動後 enabled
- [x] 移除 prompt UI 的 toggle 按鈕
- [x] 驗證 slash command / 預設狀態 / UI 移除結果
- [x] 完成 Architecture Sync 檢查並記錄結果

## Debug Checkpoints

### Baseline

- `packages/app/src/components/prompt-input.tsx` 目前直接渲染 auto-accept toggle 按鈕。
- `packages/app/src/pages/session/use-session-commands.tsx` 有 `permissions.autoaccept` command，但沒有 slash trigger。
- `packages/app/src/context/permission.tsx` 目前僅在 permission config 為 `allow` 時，才自動將 directory-level auto-accept 預設成 true。

### Execution

- 在 `packages/app/src/pages/session/use-session-commands.tsx` 將單一 `permissions.autoaccept` toggle command 拆成兩個固定 slash commands：
  - `/auto-yes-enabled`
  - `/auto-yes-disabled`
- 在 `packages/app/src/context/permission.tsx` 新增 directory enable/disable helper，並將 directory-level auto-accept 預設初始化改為「首次載入目錄即 enabled」。
- 在 `packages/app/src/components/prompt-input.tsx` 移除 prompt 區右側的 auto-accept toggle 按鈕，保留 slash command 作為切換入口。
- 在 `packages/app/src/components/prompt-input/submit.ts` 補上 builtin slash submit 處理，讓使用者直接輸入 `/auto-yes-enabled` 或 `/auto-yes-disabled` 後送出時，也會直接觸發 command，而不會誤建 session。
- 在 `packages/app/src/components/prompt-input/submit.test.ts` 新增 builtin slash command submit 測試。

### Validation

- `bun test --preload ./happydom.ts ./src/components/prompt-input/submit.test.ts`（workdir: `packages/app`）
  - 通過，3 tests / 0 fail；包含 builtin slash command 不建立 session 的新案例。
- `bun run build`（workdir: `packages/app`）
  - 通過，Vite production build 成功。
- `grep "auto-yes-enabled|auto-yes-disabled" packages/app/src`
  - 通過，slash command 已註冊於 `use-session-commands.tsx`，測試亦覆蓋 submit 路徑。
- `grep "command\.permissions\.autoaccept|permissions\.autoaccept" packages/app/src/components/prompt-input.tsx`
  - 通過，無結果；prompt UI toggle 相關字樣已自該元件移除。
- `bun run typecheck`（workdir: `packages/app`）
  - 失敗，但屬環境問題：`@typescript/native-preview` 的 `tsgo` binary `EACCES`，非此次邏輯修改導致；已以單元測試與 build 補強驗證。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅調整 webapp 的 permission 切換入口與前端預設狀態，不涉及後端 protocol、session 架構、provider graph 或系統拓撲變更。
