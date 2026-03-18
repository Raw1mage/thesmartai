# Event: Console BYOK add-account name input

## 需求

- 使用者在 webapp（console workspace BYOK）新增/編輯 provider account 時，缺少 account name 輸入框。
- 需補上 name textbox，且儲存時 name 需寫入後端。

## 範圍 (IN / OUT)

- **IN**: `packages/console/app/src/routes/workspace/[id]/provider-section.tsx` 新增 name 欄位與送出參數。
- **IN**: `packages/console/core/src/provider.ts` 與 `provider` schema 支援 `name`。
- **IN**: DB migration 新增 `provider.name` 欄位並補舊資料。
- **IN**: i18n 文案新增 name 欄位標題與 placeholder（en/zh/zht）。
- **OUT**: TUI / packages/app 的 provider connect dialog 流程（本次不變更）。

## 任務清單

- [x] 定位缺少 name textbox 的實際 webapp 路徑（console workspace provider-section）。
- [x] 在 UI 新增 name textbox 並顯示現有 name。
- [x] `saveProvider` action 改為 name 必填，並送入 core `Provider.create`。
- [x] core schema / service 增加 `name` 欄位。
- [x] 新增 migration：`provider` 表增加 `name` 欄位，舊資料回填 provider key。
- [x] 補 i18n keys：`workspace.providers.namePlaceholder`、`workspace.providers.table.name`。
- [x] 執行 typecheck 驗證。

## Debug Checkpoints

- **Baseline**: BYOK form 在編輯/新增時僅有 API key input，無 account name input。
- **Instrumentation Plan**: 檢查 console app route 與 core provider create payload，確認是否支援 name。
- **Execution**:
  - 在 `provider-section.tsx` 增加 name 欄位（獨立欄位 + table header）。
  - action 驗證 `name`，並傳給 `Provider.create`。
  - core `ProviderTable` / `Provider.create` 增加 `name`。
  - migration 新增 `name` 欄位並回填既有資料。
- **Root Cause**: console BYOK 流程的資料模型只有 `credentials`，UI 與後端都未建模 account name。
- **Validation**:
  - `bun turbo typecheck --filter=@opencode-ai/console-app --filter=@opencode-ai/console-core` ✅

## 變更檔案

- `packages/console/app/src/routes/workspace/[id]/provider-section.tsx`
- `packages/console/app/src/routes/workspace/[id]/provider-section.module.css`
- `packages/console/app/src/i18n/en.ts`
- `packages/console/app/src/i18n/zh.ts`
- `packages/console/app/src/i18n/zht.ts`
- `packages/console/core/src/provider.ts`
- `packages/console/core/src/schema/provider.sql.ts`
- `packages/console/core/migrations/0056_worried_molecule_man.sql`
- `packages/console/core/migrations/meta/_journal.json`

## Verification

- Typecheck passed for console app/core.
- Architecture Sync: Verified (No doc changes). 本次為 console BYOK 表單與資料欄位擴充，未改變全域架構邊界。

## Cross-Reference / 分流註記

- 本事件為 **Console BYOK（`packages/console`）** 的帳號名稱欄位實作。
- 後續使用者回報的「連線 gemini-cli 對話框沒有名稱欄位」屬於 **App Connect Dialog（`packages/app`）** 路徑，已另立 RCA：
  - `docs/events/event_20260318_gemini_connect_name_input_rca.md`
- 兩者是不同產品面與不同部署面，請勿混用結論。
