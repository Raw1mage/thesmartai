## Requirements

- 緊急解除目前錯誤擴散的 cooldown，讓所有 model 先回到可選狀態。
- 保留指定帳號 `miatlab.api@gmail.com`（account id: `openai-subscription-miatlab-api-gmail-com`）為倒數 2 小時 30 分重置。
- 追查 429 是否來自「所見非所得」：session 顯示選到 A 帳號，但實際執行/限流記帳落到 B 帳號。

## Scope

### In

- OpenAI cooldown / rotation-state 緊急止血
- session -> prompt -> processor -> llm accountId 傳遞鏈
- 429 / auth failure rate-limit judge 呼叫點

### Out

- release / push
- provider 策略重寫

## Task List

- [x] 建立 baseline 與現況證據
- [x] 緊急清理錯誤 cooldown
- [x] 修正 account/provider 參數掉包
- [x] 修正 prompt -> processor -> llm accountId 漏傳
- [x] 修正 OpenAI `usage_limit_reached` 分類
- [x] 驗證 session 選定 account 是否正確傳到 runtime
- [x] 更新 architecture sync 結論

## Baseline

- 目前 `rotation-state.json` 出現多個 OpenAI 帳號都被 5 小時 provider-level cooldown 鎖住。
- 使用者觀察到：手動切到有餘額帳號後可正常使用，因此懷疑先前的 cooldown 連鎖與實際執行帳號不一致。
- 調查 `packages/opencode/src/session/llm.ts` 發現：`RateLimitJudge.recordAuthFailure(...)` 與 `RateLimitJudge.judge(...)` 的呼叫參數順序疑似把 `accountId` 與 `providerId` 傳反。
- 進一步調查發現：即使 user message 已持久化 `model.accountId`，`packages/opencode/src/session/prompt.ts` 呼叫 `processor.process(...)` 時仍未把 `accountId` 傳進 stream input，導致 `LLM.stream()` 可回退到全域 active account。

## Instrumentation / Evidence

- `docs/ARCHITECTURE.md`
  - session execution identity 的權威座標為 `{ providerId, modelID, accountId? }`
  - session-local selection 與 global active account 應明確分離
- `packages/app/src/components/prompt-input/submit.ts`
  - 前端送出 prompt 時，會把 `local.model.selection(params.id)?.accountID` 寫入 `model.accountId`
- `packages/opencode/src/session/prompt.ts`
  - `PromptInput` schema 接受 `model.accountId`
  - `createUserMessage()` / `SessionProcessor.create()` 會保留 `lastUser.model.accountId`
  - 但修補前 `processor.process({...})` 未把 `accountId` 明確帶入 stream input，造成下游 `LLM.stream()` 仍可能 fallback 到 active account
- `packages/opencode/src/session/processor.ts`
  - pre-flight rate-limit check 優先使用 `streamInput.accountId ?? input.accountId`
- `packages/opencode/src/session/llm.ts`
  - runtime 會把 `x-opencode-account-id` 帶進 request header
  - 但 onError 內對 `RateLimitJudge` 的兩個呼叫順序疑似錯置
- `/home/pkcs12/.local/share/opencode/log/debug.log`
  - `rotation.error` 與 `rotation.judge` 顯示同一次失敗中，實際 provider error 的 `accountId` 與被 markRateLimited 的 `accountId` 曾不一致
  - 同批 OpenAI 錯誤是明確 `status: 429` / `message: "The usage limit has been reached"`，不是純虛構 rate-limit
- `packages/opencode/src/account/rotation/backoff.ts`
  - 修補前未將 OpenAI `usage_limit_reached` / `insufficient_quota` 解析為 `QUOTA_EXHAUSTED`，導致真 429 被歸類成 `UNKNOWN`
- `/home/pkcs12/.local/state/opencode/rotation-state.json`
  - 修補前 openai 多個帳號皆被 provider-level `UNKNOWN` cooldown 鎖住

## Execution / Decisions

- 2026-03-10T18:39:25.809Z 建立事件檔並進入 emergency hotfix 流程。
- 緊急止血：先前曾保留單一 `miatlab` cooldown；本輪最終改為直接備份後清空所有 OpenAI cooldown / daily counters，避免既有污染狀態繼續影響驗證。
- 根因調查：`packages/opencode/src/session/llm.ts` 的 `onError` 內，`RateLimitJudge.recordAuthFailure(...)` 與 `RateLimitJudge.judge(...)` 原本把 `(providerId, accountId, modelId)` 誤傳成 `(accountId, providerId, modelId)`。
- 第二個實際 root cause：`packages/opencode/src/session/prompt.ts` 呼叫 `processor.process(...)` 時未傳 `accountId: lastUser.model.accountId`，因此即使 session user message 已攜帶 accountId，`LLM.stream()` 仍可能回退到 `Account.getActive(...)`，形成「user message 是 A、實際執行變成 B」的 WYSIYG 破口。
- 429 真實性確認：debug log 中 OpenAI 錯誤為明確 `status: 429` 與 `The usage limit has been reached`；因此不是空泛誤判成 rate limit，而是「真 429 + 錯帳號歸因 + 錯 reason 分類」疊加。
- 分類修正：`packages/opencode/src/account/rotation/backoff.ts` 將 OpenAI `usage_limit_reached` / `insufficient_quota` 正規化為 `QUOTA_EXHAUSTED`，避免真 quota exhaustion 落成 `UNKNOWN`。

## Validation

- Emergency state verified:
  - 已建立 backup：`/home/pkcs12/.local/state/opencode/rotation-state.backup-1773169360704.json` ✅
  - `node` 檢查 `/home/pkcs12/.local/state/opencode/rotation-state.json`，目前不再殘留任何 OpenAI cooldown / OpenAI daily counter ✅
- Regression test:
  - `bun test /home/pkcs12/projects/opencode/packages/opencode/test/session/llm-rate-limit-routing.test.ts` ✅
  - 驗證 `RateLimitJudge.judge()` 收到的參數為 `{ providerId: "openai", accountId: "openai-subscription-pincyluo-gmail-com", modelId: "gpt-5.4" }`
  - `bun test /home/pkcs12/projects/opencode/packages/opencode/test/session/prompt-account-routing.test.ts` ✅
  - 驗證 session-scoped `accountId` 會從 `SessionPrompt.prompt(...)` 實際傳到 `LLM.stream(input.accountId)` ✅
  - `bun test /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/backoff.test.ts` ✅
  - 驗證 `usage_limit_reached` 會被分類成 `QUOTA_EXHAUSTED` ✅
- Lint:
  - `bun x eslint /home/pkcs12/projects/opencode/packages/opencode/src/session/prompt.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/backoff.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/backoff.test.ts /home/pkcs12/projects/opencode/packages/opencode/test/session/prompt-account-routing.test.ts /home/pkcs12/projects/opencode/packages/opencode/test/session/llm-rate-limit-routing.test.ts` ✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪修的是 runtime account propagation、error-account mapping、與 reason classification，未改變長期模組邊界；`docs/ARCHITECTURE.md` 既有的 session execution identity contract 仍成立。
