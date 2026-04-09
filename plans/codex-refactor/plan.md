# Codex Provider Refactor — 單一計畫書

版本：2026-04-09 rev3
狀態：施工中

---

## 一、背景

Codex provider 散布在 opencode core 多個檔案中（codex.ts 960 行、codex-websocket.ts 653 行、codex-native.ts 318 行），透過 fetch interceptor hack 注入 protocol 行為。需重構為獨立的 `@opencode-ai/codex-provider` package。

V1 重構失敗的根因：convert 層從 type definition 猜格式，沒對照舊 provider 實際輸出。結果 tool call 不是不能用就是用了之後沒內容——system prompt 放錯欄位導致 AI 沒 context、tool result stringify 導致 AI 看到空內容、tool-call StreamPart 缺失導致 tool 不執行、finishReason 永遠 "stop" 導致 tool loop 不繼續。V2 的核心原則：**以 codex-rs 的程式協定為主要參考來源（upstream 權威），AI SDK adapter（1733 行）為次要參考——僅在 codex-rs 資訊不足的空缺處補充。任何格式轉換必須對照 golden-request.json 驗證，不准猜。**

前置修復（已完成）：compact_threshold 動態化 + SessionSnapshot 廢除。

---

## 二、需求

1. Codex provider 重構為獨立 package
2. 實作 `LanguageModelV2` interface，直接對接 Responses API
3. **request body 必須與舊 provider 的 golden output 逐欄位一致**
4. **response event → StreamPart 映射必須與舊 AI SDK adapter（1733 行）行為一致**
5. WS transport + delta + continuation 在 package 內部完成
6. opencode 主程式零 codex 硬編碼
7. **error handling 必須覆蓋：WS 斷線 fallback、4xx/5xx、rate limit、token refresh**
8. **account rotation 時 WS reset + per-account continuation preserve**

---

## 三、規格文件

### 權威來源（優先級由高到低）

1. **codex-rs 程式協定**：`refs/codex/codex-rs/` — upstream 權威，request/response 格式、WS handshake、header 定義的第一來源
2. **官方 API 文件**：https://developers.openai.com/api/docs
3. **Golden reference**：`golden-request.json`（request）— 舊 provider 的實際輸出，用於逐欄位比對驗證
4. **AI SDK adapter**（次要）：`openai-responses-language-model.ts`（1733 行）— 僅在 codex-rs 資訊不足時參考，補充 LanguageModelV2 介面映射的空缺

所有實作細節在 **[datasheet.md](datasheet.md)**。

---

## 四、Package 結構與依賴

```
packages/opencode-codex-provider/src/

protocol.ts     常數（URL, originator, timeouts）
                輸出：CODEX_API_URL, CODEX_WS_URL, ORIGINATOR, 各種 timeout

types.ts        API types
                輸出：ResponsesApiRequest, ResponseStreamEvent, CodexCredentials, etc.

convert.ts      AI SDK prompt → request body
                輸入：LanguageModelV2Prompt（system/user/assistant/tool messages）
                輸出：{ instructions: string, input: ResponseItem[] }
                實作：datasheet §2（六種 input item 格式）
                依賴：types.ts

headers.ts      HTTP/WS headers builder
                輸入：accessToken, accountId, turnState, window, sessionId
                輸出：Record<string, string>
                實作：originator, ChatGPT-Account-Id, x-codex-turn-state, x-codex-window-id

auth.ts         OAuth PKCE + token refresh
                輸出：refreshTokenWithMutex, generatePKCE, exchangeCodeForTokens, extractAccountId

sse.ts          Response events → LanguageModelV2StreamPart
                輸入：ReadableStream<ResponseStreamEvent>
                輸出：ReadableStream<LanguageModelV2StreamPart> + responseId promise
                實作：datasheet §4（完整 event mapping）
                狀態：ongoingToolCalls, currentTextId, activeReasoning, hasFunctionCall

models.ts       Model catalog + compact_threshold
                輸出：getCompactThreshold(modelId), getMaxOutput(modelId)

continuation.ts File-backed WS continuation state
                輸出：getContinuation, updateContinuation, invalidateContinuation
                持久化：$STATE/ws-continuation.json

transport-ws.ts WS transport + delta + first-frame probe
                輸入：sessionId, accessToken, accountId, body, wsUrl
                輸出：ReadableStream<ResponseStreamEvent> | null
                行為：WS 優先 → 失敗則 sticky HTTP fallback
                      account switch → close WS + preserve per-account continuation
                      delta mode → previous_response_id + input trim

provider.ts     CodexLanguageModel（LanguageModelV2 實作）
                輸入：callOptions（prompt, tools, providerOptions, headers）
                行為：1. ensureValidToken
                      2. convertPrompt → instructions + input
                      3. 從 providerOptions 映射 API fields（datasheet §5）
                      4. tryWsTransport → 成功則 mapResponseStream
                      5. 失敗則 HTTP fetch → parseSSEStream → mapResponseStream
                依賴：所有其他模組

index.ts        Public exports
```

### 整合點

| 檔案 | 修改 | 傳遞什麼 |
|---|---|---|
| `custom-loaders-def.ts` | codex loader | credentials → `createCodex()` |
| `plugin/codex-auth.ts` | OAuth auth | credentials returned to SDK |
| `plugin/index.ts` | import | `CodexNativeAuthPlugin` |
| `provider/provider.ts` | model def | `npm: "@opencode-ai/codex-provider"` |
| `provider/transform.ts` | options | `store=false` for codex |
| `session/llm.ts` | headers | `session_id`, `x-opencode-session` |

---

## 五、施工清單

### 已完成且驗證

| 項目 | 驗證方式 | 結果 |
|---|---|---|
| Package 建立 | `bun -e "import { createCodex } from ..."` | ✅ import 成功 |
| 整合 wiring | daemon 啟動 + `[CODEX-WS] REQ` trace | ✅ 新 provider 被呼叫 |
| WS transport 連線 | WS frame trace | ✅ connected + 多輪 frame |
| WS delta | `inputItems < fullItems` | ✅ R2+ delta mode |
| Cache reporting | `cacheReadTokens > 0` | ✅ R2: 5632, R3: 19200 |
| Session context | `cacheKey` 含 sessionId | ✅ 穩定 key |
| Tool call dispatch | `tool-call` StreamPart emitted | ✅ from output_item.done |
| Tool result format | content parts array passed | ✅ golden test 通過 |
| System prompt placement | developer role in input[0] | ✅ golden test 通過 |
| Content parts format | user=input_text, assistant=output_text | ✅ golden test 通過 |
| Tool schema | strict:false | ✅ golden test 通過 |
| providerOptions mapping | store, service_tier, reasoning 送出 | ⚠️ 寫了但未驗證實際 request dump |

### 已寫但未驗證

| 項目 | 缺什麼 |
|---|---|
| providerOptions 完整性 | 需 dump 新 provider request 對照 golden |
| HTTP fallback path | 未測試 WS 失敗後 HTTP 是否正常工作 |
| Account switch | 未測試多帳號切換時 WS reset 行為 |
| Token refresh mid-session | 未測試 OAuth 過期後 refresh 是否不中斷 |
| Continuation 持久化 | 未測試 daemon 重啟後 continuation restore |
| WS headers 比對 | 未 dump 新 provider WS headers 對照舊 |

### 待修（datasheet §6 gap analysis）

| 優先 | 項目 | 影響 |
|---|---|---|
| **高** | finishReason = "tool-calls" | tool loop 不繼續，AI 只做一輪 tool call 就停 |
| **高** | text-end flush | 懸掛 text part，stream 不乾淨結束 |
| 中 | text-start 自動補發 | Copilot item_id 變動時 text 丟失 |
| 中 | response.incomplete finishReason | 不完整回覆的原因丟失 |
| 中 | max_output_tokens 傳遞 | 可能影響長回覆 |
| 低 | response.created → response-metadata | 缺 timestamp metadata |
| 低 | annotation → source events | URL/file citation 不顯示 |
| 低 | reasoning encrypted_content metadata | reasoning 回放 |
| 低 | reasoning summary_part.added (index > 0) | 多段 reasoning |

### 待清理

- [ ] 移除舊 codex.ts 中的 CodexNativeAuthPlugin
- [ ] 移除 codex-websocket.ts
- [ ] 移除 codex-native.ts
- [ ] 移除 codex-compaction.ts 引用
- [ ] `grep -r "codex" src/ | grep -v plugin/codex` 驗證零殘留

---

## 六、驗證方法

### Happy path

| # | 項目 | 判定 | 狀態 |
|---|---|---|---|
| 1 | Golden diff (request) | top-level fields 一致 | ✅ convert.test.ts 10/10 pass |
| 2 | Tool call + result | AI 讀檔 → 完整回報內容 | ✅ 已通過 |
| 3 | Multi-turn | 3+ 輪含 tool call 全部正常 | ✅ 已通過 |
| 4 | WS delta | R2+ inputItems < fullItems | ✅ 已通過 |
| 5 | Cache hit | R2+ cacheReadTokens > 0 | ✅ 已通過 |
| 6 | Abort zero | 整個 session 無 abort | ⚠️ fix 後未重測 |
| 7 | Tool loop | AI 自主多次 tool call | ✅ finishReason=tool-calls fix + unit test pass |

### Failure path

| # | 項目 | 判定 | 狀態 |
|---|---|---|---|
| 8 | WS 失敗 → HTTP fallback | response 正常回來 | ⚠️ bodyStr bug fixed, 待端對端測試 |
| 9 | Rate limit | error 正確 propagate | ⚠️ error event handling in sse.ts, 待端對端測試 |
| 10 | Token refresh | mid-session 不中斷 | ⚠️ ensureValidToken logic correct, 待端對端測試 |
| 11 | Account switch | WS reset + continuation preserve | ⚠️ 程式碼已寫, 待端對端測試 |
| 12 | Daemon restart | continuation restore from disk | ⚠️ setContinuationFilePath wired, 待端對端測試 |
| 13 | Golden diff (response) | event sequence 一致 | ✅ sse.test.ts 7/7 pass |

### 自動化測試覆蓋

| 測試檔案 | 測試數 | 覆蓋範圍 |
|---|---|---|
| sse.test.ts | 7 | finishReason, text-end flush, text-start auto, incomplete, tool-call args, usage |
| convert.test.ts | 10 | developer role, input_text, input_image, output_text, function_call, function_call_output, strict:false, conversation order |
| provider.test.ts | 1 | provider 實例化 |
| **合計** | **18** | **全部通過** |

---

## Phase 2：整合獨立（未開始）

### 設計原則

opencode 是殼（session 管理、tool 執行、UI、telemetry），provider 處理對話中的一切（request 格式、transport、response 解析、delta、compaction 方式）。Core 不應該知道任何 provider-specific 的邏輯。

opencode 已有完整的 plugin 機制（`@opencode-ai/plugin` 的 `Hooks` 介面），Phase 2 盡量延用現有架構，最小化改動。

### 目標

opencode 在沒有 codex-provider plugin 的情況下正常運作。當 plugin 存在時，opencode 自動獲得 codex 能力。使用者只需在 config 加一行 `"plugin": ["@opencode-ai/codex-provider"]`。

### 需要從 core 推回 provider 的三件事

**經分析，core 只有三個地方越權插手了 provider 的事：**

#### 1. ProviderOptions（store, serviceTier, promptCacheKey）

每個 provider 的 API 有自己的偏好設定。例如 codex 要 `store=false`（不讓 OpenAI 存對話到訓練資料庫）、`serviceTier=priority`（ChatGPT Plus 的優先通道）、`promptCacheKey`（讓 server 知道「這是同一個對話，用快取」）。這些是 codex 的商業/協定需求，跟 AI 能力無關。

**現狀**：transform.ts 硬編碼 `if (providerId === "codex")` 判斷。
**Phase 1 已解**：provider.ts 的 `doStream()` 已自己處理這些欄位。
**Phase 2 要做**：刪掉 transform.ts 裡殘留的 codex checks。或者用 `chat.params` hook 覆蓋。
**不需要新 hook**。

#### 2. Delta（previousResponseId / continuation）

Codex WS transport 支持 incremental delta：只送上次之後的新 input，server 用 `previous_response_id` 接續。這是 provider 內部的 transport 優化。

**現狀**：llm.ts 硬編碼 `codexSessionState`（L113-114）、送出前注入 previousResponseId（L657-679）、收到後擷取 responseId（L761-777）。
**但 provider 已經自己管了**：transport-ws.ts 內部有完整的 continuation 管理（getContinuation → 注入 previous_response_id → updateContinuation → 持久化磁碟）。llm.ts 的邏輯是舊 AI SDK adapter 時代的殘留，與 provider 內部重複。
**Phase 2 要做**：直接刪掉 llm.ts 的 codex delta 區塊。Provider 靜默處理，core 完全不知情。
**不需要新 hook**。

#### 3. Compaction（local vs server）

opencode 有 local compaction（SharedContext snapshot → LLM 摘要 → checkpoint）。何時壓縮由 core 決定（token 數超過 compact_threshold）。怎麼壓縮則應該可以由 provider 自己選擇。

Codex 有 server compaction：POST 到 `/responses/compact` 端點，server 回傳壓縮後的 opaque items，品質比 local LLM 摘要更好（因為 server 有原始 context）。

**現狀**：compaction.ts 硬 import `codexServerCompact`（codex-compaction.ts:L22）。
**Phase 2 要做**：讓 plugin 能回答「我有自己的壓縮方式」，回傳壓縮結果或 null（走預設 local compaction）。
**需要一個新 hook**：`session.compact` — 這是 Phase 2 唯一真正需要新增的 hook。

### 工作項

三件事拆成 4 個工作項。WS1 和 WS4 同時處理 codex + claude-cli，因為硬接模式完全一致。

#### WS1：刪除 transform.ts 的 provider 硬編碼（codex + claude-cli）

codex 要刪的：
- `providerId === "codex"` 的 store/serviceTier/promptCacheKey 判斷（L708, L741, L748）
- `id.includes("codex")` 的 xhigh reasoning 判斷（L462, L533）
- `id.includes("codex")` 的 textVerbosity 排除（L797）

claude-cli 要刪的：
- `providerId === "claude-cli"` 的 useMessageLevelOptions 判斷（L249, L268）
- `model.providerId === "claude-cli"` 的 cache_control 判斷（L318, L326）
- `model.providerId === "claude-cli"` 的 reasoning effort 判斷（L489）

這些已由各自 provider 的 `doStream()` 或 model capabilities 處理。
**不需要新 hook**。風險：低。

#### WS2：刪除 llm.ts 的 codex delta 邏輯（codex only）

- 刪除 `codexSessionState` map（L113-114）
- 刪除送出前 `previousResponseId` 注入（L657-679）
- 刪除收到後 `responseId` 擷取（L761-777）
- Provider 的 transport-ws.ts 已完整管理 delta/continuation，core 的邏輯是重複的
- claude-cli 無此問題（沒有 delta 機制）
- **不需要新 hook**。風險：低 — 但需驗證 provider 內部 delta 獨立運作正常。

#### WS3：新增 `session.compact` hook + 搬遷 codex-compaction.ts（codex only）

- `Hooks` 介面新增 `"session.compact"?`
- compaction.ts 改為：先問 plugin 有無 server compact，有就用，無就走預設 local compact
- codex-compaction.ts 搬進 `@opencode-ai/codex-provider` package，透過 hook 暴露
- 移除 compaction.ts 對 codex-compaction.ts 的 hard import
- claude-cli 無此問題（沒有 server compaction）；但未來任何 provider 若有 server compaction 都能用此 hook
- **唯一需要新增的 hook**

Hook 簽名草案：
```typescript
"session.compact"?: (
  input: {
    sessionID: string;
    model: { providerId: string; modelID: string };
    messages: ConversationInput[];
    instructions: string;
  },
  output: {
    /** null = plugin 不處理，走預設 local compaction */
    compacted: ConversationInput[] | null;
  },
) => Promise<void>
```

風險：中 — compaction 是關鍵路徑，需充分測試。

#### WS4：搬遷 auth plugin + core cleanup（codex + claude-cli）

codex：
- codex-auth.ts 搬進 `@opencode-ai/codex-provider` package
- plugin/index.ts 移除 codex hard import
- custom-loaders-def.ts 移除 codex 區段

claude-cli：
- claude-native.ts（已是獨立檔案）搬進 `@opencode-ai/claude-provider` package
- plugin/index.ts 移除 claude-cli hard import
- custom-loaders-def.ts 移除 claude-cli 區段

兩者改為 config plugin 動態載入。`auth.loader()` 回傳 getModel，不需要 core 硬 import createCodex / createClaudeCode。

model definitions 暫時保留在 provider.ts（跟其他 22 個 provider 的 legacy 共存）。

風險：低 — 純搬遷。

### claude-cli 硬接點對照表

| # | 硬接點 | 位置 | 對應 WS | 跟 codex 一樣？ |
|---|--------|------|---------|----------------|
| 1 | ClaudeNativeAuthPlugin hard import | plugin/index.ts:17,30 | WS4 | ✅ |
| 2 | createClaudeCode hard import | custom-loaders-def.ts:8,42 | WS4 | ✅ |
| 3 | model definitions 硬編碼 | provider.ts:1205-1240 | legacy 共存 | ✅ |
| 4 | useMessageLevelOptions | transform.ts:249,268 | WS1 | claude-cli 特有 |
| 5 | cache_control 判斷 | transform.ts:318,326 | WS1 | claude-cli 特有 |
| 6 | reasoning effort | transform.ts:489 | WS1 | claude-cli 特有 |
| 7 | User-Agent 硬編碼 | provider.ts:327 | WS4 | claude-cli 特有 |

### 不做的事

- 不重構 opencode 的 legacy model management（22 個 provider 都硬編碼，不在此 plan scope）
- 不改 `@opencode-ai/plugin` 的 peerDependency（除了新增 `session.compact` hook）
- 不動 codex / claude-cli 以外的 provider

### 驗證標準

- `grep -r "codex" packages/opencode/src/ --include="*.ts"` 只出現 `"codex"` string literal（provider ID 比對）和 model definitions（legacy 共存），不出現 import/硬編碼邏輯
- `grep -r "claude-cli" packages/opencode/src/ --include="*.ts"` 同上標準
- codex-provider package 零 opencode core dependency（只依賴 `@ai-sdk/provider` types）
- claude-provider package 同上標準
- daemon 正常運作，兩個 provider 功能正常

---

### 驗證標準

- `grep -r "codex" packages/opencode/src/ --include="*.ts"` 只出現 `"codex"` string literal（provider ID 比對），不出現 import/硬編碼邏輯
- 移除 `@opencode-ai/codex-provider` workspace dependency 後，`bun test` 全過、daemon 正常啟動（無 codex 功能）
- 加回 plugin config 後，codex 功能恢復

---

## 七、Revision History

| 日期 | 事件 |
|---|---|
| 2026-04-08 | 初始需求、upstream 分析、beta workflow、merge to main |
| 2026-04-08~09 | Hotfix 迭代 |
| 2026-04-09 | 計畫整併、datasheet（golden dump + 1733 行 adapter 分析 + 官方文件） |
| 2026-04-09 rev2 | Plan 重寫 |
| 2026-04-09 rev3 | Gap audit：§二加 error/account 需求、§四加依賴關係、§五分「已驗證/未驗證/待修」、§六分 happy/failure path + 狀態追蹤 |
| 2026-04-09 rev4 | 實作：sse.ts 5 修復、1948 行舊 codex 刪除、18 個自動化測試全過、IDEF0 3 層 21 圖完成 |
| 2026-04-09 rev5 | Phase 1 merged to main。tool result 修復（output vs result 欄位）、max_output_tokens 移除。Phase 2（整合獨立）計畫加入 |
| 2026-04-09 rev6 | Phase 2 拆成 7 個獨立 workstream（WS1-WS7），含 gap 分析、hook 簽名草案、依賴圖、風險評估 |
