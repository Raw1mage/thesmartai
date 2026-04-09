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

### 目標

opencode 在沒有 codex-provider plugin 的情況下正常運作。當 plugin 存在時，opencode 自動獲得 codex 能力。使用者只需在 config 加一行 `"plugin": ["@opencode-ai/codex-provider"]`。

### 問題拆解

Phase 2 拆成 7 個可獨立解決的工作項（WS = workstream）。依賴關係：

```
WS1 (models hook)  ─┐
WS3 (chat.params)   ├──→ WS2 (plugin loader) ──→ WS6 (file migration) ──→ WS7 (core cleanup)
WS4 (lifecycle hook)─┤
WS5 (compaction hook)┘
```

Phase 2a（無依賴，可並行）：WS1, WS3, WS4, WS5
Phase 2b（依賴 2a）：WS2, WS6
Phase 2c（依賴全部）：WS7

---

### WS1：正式化 `models()` hook

**問題**：plugin/index.ts 的 `discoverModels()` 已經在呼叫 `hook.models()`，但 `Hooks` 介面沒有定義這個 hook。是 ad-hoc cast (`HookWithModels`)。provider.ts 的 codex model 定義（L1257-1300）應該由 plugin 提供。

**現狀**：
- `discoverModels()` 存在且能用（plugin/index.ts:163-187）
- codex-auth.ts 沒有實作 `models()`
- model 定義硬編碼在 provider.ts

**修復**：
1. 在 `packages/plugin/src/index.ts` 的 `Hooks` 介面加 `models?: () => Promise<ModelDefinition[]>`
2. 定義 `ModelDefinition` type（對齊 `Provider.addDynamicModels()` 已接受的格式）
3. 在 codex-provider package 實作 `models()` hook，回傳 7 個 model 定義
4. 移除 provider.ts L1257-1300 的 codex 硬編碼

**解決硬接點**：#3, #6
**依賴**：無
**風險**：低 — 機制已存在，只是 type 缺失

---

### WS2：Plugin loader hook（model factory）

**問題**：`custom-loaders-def.ts` 硬 import `createCodex`，用 auth credentials 建立 `LanguageModelV2` instance。Plugin 應該自帶 model factory，不需要 core 知道怎麼建立 codex model。

**現狀**：
- `auth.loader()` 回傳 credentials（key/value），不回傳 model instance
- `CustomLoaderResult.getModel` 已經是 `unknown` type — core 不假設型別
- `applyCustomLoaders()` 已經把 `result.getModel` 存進 `modelLoaders[providerId]`

**Gap**：`@opencode-ai/plugin` 沒有 depend on `@ai-sdk/provider`，不能直接用 `LanguageModelV2` type。

**修復方案**：
- 方案 A：在 `Hooks` 加 `loader?: (options: Record<string, any>) => Promise<CustomLoaderResult>`，讓 plugin 回傳 `{ autoload, getModel, options }`。`getModel` 保持 `unknown`（runtime 是 `LanguageModelV2`，但 type 不強制）。**優點**：不改 plugin package 的 peerDep。**缺點**：type-unsafe。
- 方案 B：`@opencode-ai/plugin` 加 `@ai-sdk/provider` 為 peerDependency，`getModel` type 為 `(modelId: string) => LanguageModelV2`。**優點**：type-safe。**缺點**：plugin package 多了一個 peerDep。

**建議**：方案 A。`getModel` 保持 `unknown` 符合現有 `custom-loader.ts` 的設計（L3: `getModel?: unknown`）。

**修復步驟**：
1. `Hooks` 介面加 `provider?: { loader: (auth: AuthResult, provider: ProviderInfo) => Promise<{ autoload: boolean; getModel: unknown; options?: Record<string, any> }> }`
2. `plugin/index.ts` 的 provider 初始化流程改為：先呼叫 `hook.provider?.loader()`，結果注入 `customLoaders`
3. codex-provider package 實作 `provider.loader()`，內含 `createCodex()` 邏輯
4. 移除 `custom-loaders-def.ts` 的 codex 區段
5. `plugin/index.ts` 移除 codex-auth 硬 import，改為 config-based 動態載入

**解決硬接點**：#1, #2
**依賴**：WS1（model 定義先就位）
**風險**：中 — 改動 plugin 初始化流程，影響所有 plugin

---

### WS3：擴展 `chat.params` 覆蓋 provider options

**問題**：transform.ts 硬編碼 codex 的 `store=false`、`serviceTier=priority`、`promptCacheKey`。這些應該由 plugin 透過 `chat.params` hook 注入。

**現狀**：
- `chat.params` 已存在，output 有 `options: Record<string, any>`
- `ProviderTransform.options()` 先算 base options，`chat.params` hook 再 override
- 問題是 transform.ts 的 codex checks 在 `chat.params` **之前**執行

**修復**：
1. 在 codex-provider package 的 plugin entry 實作 `chat.params` hook
2. 在 hook 裡注入 `store=false`、`serviceTier=priority`、`promptCacheKey`
3. 移除 transform.ts 中 `providerId === "codex"` 的特殊判斷（L708, L741, L748）
4. 移除 transform.ts 中 `id.includes("codex")` 的 xhigh reasoning 判斷（L462, L533）— 改由 WS1 的 model capabilities 帶入
5. 移除 transform.ts 中 `id.includes("codex")` 的 textVerbosity 排除（L797）

**解決硬接點**：#5, #6（部分）
**依賴**：無
**風險**：低 — `chat.params` 機制成熟，只是搬邏輯

---

### WS4：Request/response lifecycle hooks

**問題**：llm.ts 硬編碼 codex delta 邏輯：送出前注入 `previousResponseId`（L657-679），收到後擷取 `responseId`（L761-777）。這是 provider-specific 的 request/response transform，不屬於任何現有 hook。

**現狀**：
- `chat.params` 只改 temperature/options，不能注入 arbitrary providerOptions nested fields
- `chat.headers` 只改 headers
- 沒有 post-response hook

**修復**：
1. `Hooks` 介面新增 `"chat.request.transform"?`：在 `streamText` 呼叫前，讓 plugin 修改 providerOptions（含嵌套欄位如 `codex.previousResponseId`）
2. `Hooks` 介面新增 `"chat.response.complete"?`：在 LLM response 完成後，讓 plugin 擷取 providerMetadata（如 responseId）
3. llm.ts 在對應位置呼叫這兩個 hook
4. codex-provider package 實作這兩個 hook，搬入 delta/continuation 邏輯
5. 移除 llm.ts 的 `codexSessionState` 和 `if (providerId === "codex")` 區塊
6. `ContinuationInvalidatedEvent` 搬進 plugin，由 `chat.response.complete` hook 內部管理

**Hook 簽名草案**：
```typescript
"chat.request.transform"?: (
  input: { sessionID: string; model: Model; provider: ProviderContext },
  output: { providerOptions: Record<string, any> },
) => Promise<void>

"chat.response.complete"?: (
  input: {
    sessionID: string; model: Model; provider: ProviderContext;
    finishReason: string; providerMetadata?: Record<string, any>;
    usage?: { inputTokens?: number; outputTokens?: number };
  },
  output: {},
) => Promise<void>
```

**解決硬接點**：#4, #8
**依賴**：無
**風險**：中 — 新增核心 hook，需謹慎設計不破壞其他 provider 的流程

---

### WS5：Server compaction hook

**問題**：compaction.ts 硬 import `codexServerCompact`（codex-compaction.ts）。Codex 的 server compaction 是 POST 到獨立端點，與其他 provider 的 LLM-based compaction 不同。

**現狀**：
- `experimental.session.compacting` hook 只修改 compaction prompt，不能替代整個 compaction 實作
- compaction.ts 的 codex path（L1016-1030）直接呼叫 `codexServerCompact()`

**修復**：
1. `Hooks` 介面新增 `"session.compact"?`：讓 plugin 提供完整的 server-side compaction 實作。回傳 compacted messages 或 null（null = fallback 到預設 LLM compaction）
2. compaction.ts 在 codex path 改為：先查有無 plugin 提供 `session.compact`，有則呼叫，無則走預設
3. codex-provider package 實作 `session.compact` hook，內含 `codexServerCompact` 邏輯
4. 移除 compaction.ts 對 `codex-compaction.ts` 的 import

**Hook 簽名草案**：
```typescript
"session.compact"?: (
  input: {
    sessionID: string;
    model: { providerId: string; modelID: string };
    messages: ConversationInput[];
    instructions: string;
    tools: ToolDefinition[];
  },
  output: {
    /** null = plugin 不處理，走預設 compaction */
    compacted: ConversationInput[] | null;
  },
) => Promise<void>
```

**解決硬接點**：#7
**依賴**：無
**風險**：中 — compaction 是關鍵路徑，需充分測試

---

### WS6：檔案搬遷

**問題**：`codex-auth.ts` 和 `codex-compaction.ts` 還在 opencode core 裡。

**修復**：
1. `codex-auth.ts` 的 OAuth 邏輯搬進 `@opencode-ai/codex-provider` package（auth.ts 已有部分，需合併）
2. `codex-compaction.ts` 搬進 `@opencode-ai/codex-provider` package
3. package 透過 WS2 的 loader hook 和 WS5 的 compaction hook 對外暴露能力
4. 移除 core 裡的兩個檔案

**解決硬接點**：#9, #10
**依賴**：WS2（loader hook 就位）、WS4（lifecycle hook 就位）、WS5（compaction hook 就位）
**風險**：低 — 純搬遷，邏輯不變

---

### WS7：Core cleanup + 驗證

**問題**：確認 opencode core 零 codex 硬編碼殘留。

**修復**：
1. `grep -r "codex" packages/opencode/src/ --include="*.ts"` — 只允許 string literal（如 `"codex"` provider ID 比對）
2. 從 `packages/opencode/package.json` 移除 `@opencode-ai/codex-provider` workspace dependency
3. `bun test` 全過
4. 啟動 daemon — 正常運作，無 codex 功能
5. 在 config 加 `"plugin": ["@opencode-ai/codex-provider"]`
6. 重啟 — codex 功能恢復

**解決硬接點**：全部
**依賴**：WS1-WS6 全部完成
**風險**：低 — 純驗證

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
