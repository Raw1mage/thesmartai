# Event: Web Quota Realtime Sync

Date: 2026-03-08
Status: In Progress

## 1. 需求

- 先釐清 TUI 對話框 footer bar 的 OpenAI 用量餘額更新機制。
- 將相同等級的即時性移植到 webapp 的用量顯示。
- 更新策略必須避免高 CPU / 高頻輪詢。

## 2. 範圍

### IN

- `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
- `packages/opencode/src/server/routes/account.ts`
- `packages/opencode/src/account/quota/openai.ts`
- `packages/app/src/components/prompt-input.tsx`
- 必要時同步 `docs/ARCHITECTURE.md`

### OUT

- 不修改 quota 後端資料來源或 OpenAI API 協定
- 不引入高頻全域輪詢
- 不處理與本次問題無關的 admin / provider UI 改版

## 3. 任務清單

- [x] 讀取 architecture 與相關程式碼路徑
- [x] 確認 TUI quota footer 的更新觸發條件
- [x] 比對 webapp 目前為何幾乎不更新
- [x] 以低 CPU 方式補齊 webapp 更新機制
- [x] 驗證行為並記錄結果
- [x] 檢查 Architecture Sync 是否需要更新

## 4. Debug Checkpoints

### Baseline

- 症狀：webapp prompt footer 的 quota hint 幾乎不更新，通常要 reload page 才會看到新值。
- 重現線索：`packages/app/src/components/prompt-input.tsx` 的 `createResource` 僅以 `${providerFamily}:${model.id}` 為 key；同 provider/model 不變時不會自動 refetch。
- 參考對照：TUI 在 `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx` 同時具備「完成一輪 assistant 後 refresh」與「低頻 interval tick」兩種機制。

### Execution

- 在 `packages/app/src/components/prompt-input.tsx` 新增 `quotaRefresh` / `lastQuotaRefreshMarker` 狀態。
- 參照 TUI：以 `lastCompletedAssistant()` 作為事件驅動 refresh 來源；每完成一輪 assistant 回覆即觸發一次 quota refetch。
- quota 更新策略改為條件式事件驅動：只有在「距離上次 quota 更新已超過 60 秒」且「偵測到新的 assistant 完成回合（代表使用者確實又發起了一輪 AI 互動）」時才 refresh。
- `quotaHint` resource key 由 `provider:model` 擴充為 `provider:model:quotaRefresh`，避免只有 reload 才會重新抓取。
- quota refresh 進一步限縮為只在 `openai` provider 啟動；非 openai（包含 antigravity）不啟動該 refresh 機制。
- 後續將 openai quota refresh 的判斷抽出為 `packages/app/src/components/prompt-input/quota-refresh.ts`，減少 `prompt-input.tsx` 內嵌條件判斷。

### Validation

- `bunx tsc --noEmit -p packages/app/tsconfig.json` ✅
- `bunx eslint packages/app/src/components/prompt-input.tsx packages/app/src/components/prompt-input/quota-refresh.ts` ✅
- `bun turbo typecheck --filter @opencode/app` ⚠️ 環境噪音：turbo binary `EACCES`
- `bun run typecheck` (packages/app) ⚠️ 環境噪音：`tsgo` binary `EACCES`
- Architecture Sync: Updated
  - 已將 TUI/Web prompt footer quota 更新原理、OpenAI quota SSOT、`/account/quota` 路徑與 cache/load-shedding contract 補入 `docs/ARCHITECTURE.md`。
