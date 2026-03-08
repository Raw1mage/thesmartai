# Event: TUI Footer OpenAI Usage Refresh Fix

Date: 2026-03-08
Status: Done

## 1. 需求

- 補回 TUI prompt footer 的 OpenAI 用量更新機制。
- 避免背景持續輪詢；只在使用中或真正需要顯示時更新。
- 加入 1 分鐘 refresh gate，降低用量 API 請求頻率。

## 2. 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_tui_footer_openai_usage_refresh_fix.md`

### OUT

- 不修改 OpenAI quota backend fetcher / storage schema
- 不新增全域 timer-based quota polling
- 不調整 Web prompt footer 行為

## 3. 任務清單

- [x] 設計 TUI quota refresh gate
- [x] 實作 on-demand + 1 minute refresh policy
- [x] 更新 architecture contract
- [x] 執行 targeted validation

## 4. Debug Checkpoints

### Baseline

- RCA 已確認：TUI footer 的 OpenAI quota 在 2026-03-08 refactor 後只綁 `quotaRefresh`，而 `quotaRefresh` 只由 assistant turn completion 驅動。
- 若首次 fetch 失敗或回 `null`，footer 不會自行恢復，除非再完成一次 assistant turn。
- 使用者額外要求：不要用固定背景輪詢補救，應改成「使用中才更新」並用 1 分鐘快取/節流。

### Execution

- 在 `prompt/index.tsx` 新增 `OPENAI_QUOTA_REFRESH_MIN_MS = 60_000`。
- 新增 `lastQuotaRefreshAt` signal，統一記錄最近一次 TUI footer 主動觸發 quota refresh 的時間。
- 新增 `currentQuotaFamily` 與 `requestOpenAIQuotaRefresh()`：
  - 只在當前 provider family = `openai` 時允許刷新
  - 若距離上次刷新未滿 60 秒，直接跳過
- 保留 `lastCompletedAssistant` 事件驅動，但改為走上述 gate。
- 額外加上一個 provider relevance effect：當使用者切到 OpenAI model、footer 真的需要顯示 OpenAI 用量時，允許做一次 on-demand hydrate；但仍受 60 秒 gate 保護。
- `footerTick` 定時器保留給 elapsed/account label，不再承擔 quota 輪詢責任。
- 後續補強：使用者指出開啟 `/admin` 也屬於一次 quota 顯示需求，因此把 60 秒 display TTL 上提到 `packages/opencode/src/account/quota/openai.ts`，由 `OPENAI_QUOTA_DISPLAY_TTL_MS` 作為共享單一事實來源。
- `prompt/index.tsx` 改為直接使用共享 `OPENAI_QUOTA_DISPLAY_TTL_MS`，避免 footer 與 `/admin` 各自維護不同 refresh/cache 規則。
- `/admin` 本身既有的 `getQuotaHintsForAccounts(...)` 會落到 `getOpenAIQuotaForDisplay(...)`，因此開啟 `/admin` 現在會自然遵守同一套「60 秒內顯示 cache、超過 60 秒由下一次顯示請求觸發 refresh」規則。
- 使用者後續回報 `/admin` 仍可能出現部分帳號是 `--`；RCA 顯示某些帳號當次 fetch 失敗時，`quota: null` 也被放進 60 秒 display cache，導致後續顯示請求先吃到 `--`。
- 修正：`getOpenAIQuotaForDisplay()` 若發現 cached quota = `null`，不再把它視為完整 TTL 內可直接重用的成功快取；改為把這類 display request 視為 recoverable hydrate，直接走 `getOpenAIQuota(accountId, { waitFresh: true })` 嘗試同步補抓。
- 效果：成功值仍維持 60 秒 display cache；但 `--` 不再被當作等價成功結果長時間占住 `/admin` 與 footer 顯示。
- 再補強：`refreshOpenAIAccountQuota()` 在 token refresh 失敗 / usage fetch 非 2xx / fetch throw 時，不再無條件用 `null` 覆蓋已存在的 quota cache；若該帳號已有 last-known-good quota，就保留舊值並只更新 timestamp。
- 效果：`/admin` 與 footer 遇到偶發 OpenAI 查詢失敗時，優先維持最後一次成功值，而不是從數字退回 `--`。

### Validation

- `bunx tsc --noEmit -p packages/opencode/tsconfig.json`
  - 通過
- `bunx eslint packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
  - 通過
- `bunx tsc --noEmit -p packages/opencode/tsconfig.json`
  - 通過（共享 TTL 常數上提後複驗）
- `bunx eslint packages/opencode/src/account/quota/openai.ts packages/opencode/src/account/quota/index.ts packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx`
  - 通過
- `bun -e 'import { Account } from "./packages/opencode/src/account/index.ts"; import { getQuotaHintsForAccounts } from "./packages/opencode/src/account/quota/index.ts"; const accounts = await Account.list("openai"); const ids = Object.entries(accounts).filter(([,info]) => info.type === "subscription").map(([id]) => id); console.log(JSON.stringify(await getQuotaHintsForAccounts({providerId:"openai", accountIds: ids, format:"admin"}), null, 2));'`
  - 通過
  - 用於驗證 `/admin` 路徑會經由共享 display quota flow，且 `null` cache 不再直接被視為完整 TTL 內的終態
  - 觀察：本輪實機輸出中，`pincyluo` 已可從先前 `--` 恢復為數值；但另一次 live fetch 中 `yeatsluo@gmail.com` 仍可能出現 `--`，代表「不把舊 null 當長 TTL 成功快取」只能修正卡住問題，不能掩蓋當次即時 fetch 真失敗的情況
- `bunx eslint packages/opencode/src/account/quota/openai.ts`
  - 通過（last-known-good 保留邏輯）
- gate scenario simulation（以目前實作的條件做狀態機驗證）
  - `switch to openai after idle >60s` => 觸發 refresh
  - `assistant completes within 60s` => 不觸發 refresh
  - `assistant completes after 61s` => 觸發 refresh
  - `switch away from openai` => 不觸發 refresh
  - `switch back to openai within 60s` => 不觸發 refresh
  - 結論：符合「使用中才更新 + 1 分鐘 gate」需求
- 程式碼層驗證：
  - `codexQuota` 與 `/admin` account usage 都使用既有 `getOpenAIQuotaForDisplay()`，未破壞 backend stale-while-refresh 流程
  - quota refresh 不再依賴固定 timer；只在 OpenAI footer relevant 時的初次 hydrate 或新 assistant turn 完成時觸發
  - 同一套 OpenAI display TTL = 60 秒，同時約束 TUI footer 與 `/admin` 顯示請求，避免密集請求
  - 失敗態 (`quota = null`, UI 顯示 `--`) 不再與成功值共用相同 display cache 語意；新的 display request 會嘗試同步補抓最新值
  - 偶發 fetch 失敗時，若已有 last-known-good quota，現在會保留舊值而不是覆蓋成 `null`
- Architecture Sync: Updated
  - 已把 `docs/ARCHITECTURE.md` 的 TUI footer quota contract 改為 event-driven + 60s gate，並明確註記 footer timer 不做 quota polling
