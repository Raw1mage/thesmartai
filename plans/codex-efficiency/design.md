# Design

## Context

- codex provider 已上線，走 AI SDK Responses API + custom fetch interceptor
- C binary (`codex-provider`) 已建好 stdio bridge，但目前用 AI SDK fallback 路徑
- 每次 LLM call 全量送 conversation history，沒有任何 server-side cache 機制
- 使用者回報 token 消耗極高（一小時燒一週配額）

## Goals / Non-Goals

**Goals:**

- 啟用全部 6 項 Responses API server-side 優化
- 每個 Phase 獨立交付、獨立驗證
- graceful degradation — server 不支援時不影響功能
- 優先做 ROI 最高的（Phase 1 = prompt cache + sticky routing）

**Non-Goals:**

- 不改其他 provider
- 不做 client-side 演算法優化（context truncation 等）
- 不做 UI 層的 cache 狀態顯示

## Decisions

### DD-1: Phase 1 走 AI SDK custom fetch path（不動 C transport）

**Decision**: prompt_cache_key 和 sticky routing 透過 custom fetch interceptor 注入，不需要 C binary。

**Rationale**: 這兩個只是 request field 和 header，在 fetch interceptor 裡加幾行就好。不需要 rebuild C binary。

### DD-2: Turn state 管理放在 session processor 層

**Decision**: `x-codex-turn-state` 的 capture/replay lifecycle 放在 `session/llm.ts` 的 per-turn state 裡，不放在 provider 層。

**Rationale**: Turn state 跨多次 tool-call loop 的 request，需要 session-level 的 state management。Provider 層每次 getLanguage() 都是 stateless 的。

### DD-3: Reasoning encrypted_content 存在 conversation history 裡

**Decision**: 當 response 包含 reasoning item with encrypted_content 時，原封不動存入 conversation history。下次構建 input 時自然包含。

**Rationale**: 不需要額外的 state 管理——conversation history 已經是 SSOT。只要不 strip encrypted_content（目前有些地方可能會 strip），就能自動 replay。

### DD-4: WebSocket 用 Bun 原生 WebSocket client

**Decision**: Phase 3 的 WebSocket 在 TypeScript 層實作（Bun 原生），不在 C binary 裡。

**Rationale**:
- Bun 的 WebSocket client 是 first-class 支援，API 簡潔
- 不需要 libwebsockets 的複雜度
- 與 ReadableStream 的整合更自然
- C binary 的 WebSocket 留到 Phase 2 of codex-auth-plugin plan

### DD-5: Compression 用 Bun 內建 zstd

**Decision**: 用 `Bun.gzipSync` 或 `CompressionStream` 做 zstd 壓縮，不依賴外部 zstd library。

**Rationale**: Bun 內建壓縮支援，不需要 native dependency。如果 Bun 不支援 zstd，fallback 到不壓縮。

### DD-6: Server compaction 作為 client compaction 的替代路徑

**Decision**: 當 provider 是 codex 且 context 超限時，優先嘗試 `/responses/compact`。失敗時 fallback 到 client-side compaction。

**Rationale**: Server compaction 不消耗 client token，且結果更精確（server 有完整 context）。但不是所有 endpoint 都支援，所以需要 fallback。

## Data / State / Control Flow

### Turn State Lifecycle

```
Turn Start (new user message)
  │ turn_state = null
  │ response_id = null
  │
  ▼ First LLM request
  │ headers: no x-codex-turn-state
  │ body: prompt_cache_key = session_id
  │
  ▼ First response
  │ capture: x-codex-turn-state from header
  │ capture: response_id from completed event
  │ capture: reasoning encrypted_content from items
  │
  ▼ Tool call → follow-up request (same turn)
  │ headers: x-codex-turn-state = captured value
  │ body: includes previous reasoning encrypted_content
  │
  ▼ Turn End
  │ response_id saved for next turn (incremental delta)
  │ turn_state cleared (new turn = fresh routing)
```

### WebSocket Session Lifecycle (Phase 3)

```
Session Start
  │ ws = new WebSocket(endpoint, { headers })
  │
  ▼ Prewarm (optional)
  │ send: { type: "response.create", generate: false, input: [...] }
  │ receive: response_id, x-codex-turn-state (cache warm, no output)
  │
  ▼ User sends message
  │ Compute delta: current_input - last_response.items
  │ send: { type: "response.create", previous_response_id, input: delta }
  │
  ▼ Stream events
  │ receive: text_delta, item_done, completed
  │ capture: response_id for next delta
  │
  ▼ Session End / Error
  │ ws.close()
  │ fallback to HTTP if ws fails
```

## Risks / Trade-offs

- **R1: prompt_cache_key 被 server 忽略** → 功能正常但沒有 cache 效益。Mitigation: 檢查 cached_input_tokens 確認 cache hit
- **R2: WebSocket endpoint 變更** → `OpenAI-Beta` header 版本綁定。Mitigation: 版本從 config 讀取，可更新
- **R3: encrypted reasoning 造成 body 膨脹** → 長 reasoning chain 的 encrypted content 可能很大。Mitigation: 設定 max reasoning items 保留數量
- **R4: zstd 壓縮在 Bun 中不支援** → Bun 可能沒有 zstd encoder。Mitigation: fallback 到 gzip 或不壓縮
- **R5: server compaction endpoint 不存在** → 404 或 unsupported。Mitigation: fallback 到 client compaction

## Critical Files

- `packages/opencode/src/session/llm.ts` — turn state management, request construction
- `packages/opencode/src/plugin/codex.ts` — custom fetch interceptor, header injection
- `packages/opencode/src/provider/codex-language-model.ts` — C transport bridge
- `packages/opencode/src/session/compaction.ts` — compaction trigger integration
- `packages/opencode/src/provider/provider.ts` — codex CUSTOM_LOADER options
- `plans/codex-auth-plugin/diagrams/codex_a4_protocol_ref.json` — wire protocol reference
