# Implementation Spec

## Goal

- 為 codex provider 啟用 OpenAI Responses API 的 6 項 server-side 效能優化，將長對話 token 消耗降低 50-90%

## Scope

### IN

- Phase 1: prompt_cache_key + sticky routing（HTTP, 立即可用）
- Phase 2: encrypted reasoning reuse + zstd compression（HTTP, 中等難度）
- Phase 3: WebSocket transport + incremental delta + prewarm（高價值高難度）
- Phase 4: server-side compaction（/responses/compact）

### OUT

- 其他 provider 的效能優化
- C library WebSocket（用 Bun 原生 WebSocket）
- client-side compaction 改進

## Assumptions

- OpenAI Responses API 接受 `prompt_cache_key` 欄位（codex-rs 已使用）
- `x-codex-turn-state` header 會由 server 回傳且接受 replay（codex-rs 已使用）
- WebSocket endpoint 支援 `previous_response_id` 做 incremental delta（codex-rs 已使用）
- Bun 原生 WebSocket client 能連接 OpenAI WebSocket endpoint

## Stop Gates

- **SG-1**: 如果 `prompt_cache_key` 被 server 忽略（quota 沒有下降），暫停並分析 packet
- **SG-2**: 如果 WebSocket handshake 被 server 拒絕，停留在 HTTP SSE 路徑
- **SG-3**: 如果 encrypted reasoning 造成 request body 過大（超過 context window），需要 truncation 策略

## Critical Files

- `packages/opencode/src/session/llm.ts` — LLM call orchestration, turn state
- `packages/opencode/src/plugin/codex.ts` — custom fetch, header injection
- `packages/opencode/src/provider/provider.ts` — codex CUSTOM_LOADER
- `packages/opencode/src/provider/codex-language-model.ts` — C transport bridge
- `packages/opencode-codex-provider/src/main.c` — C binary request handling
- `packages/opencode-codex-provider/src/transport.c` — HTTP transport
- `packages/opencode/src/session/compaction.ts` — compaction integration point

## Structured Execution Phases

### Phase 1: Prompt Cache + Sticky Routing（低風險高回報）

HTTP-only，只加 request field 和 header。不改 transport 層。

1. 在 codex provider 的 request body 注入 `prompt_cache_key: session_id`
2. Capture `x-codex-turn-state` from response headers
3. Replay `x-codex-turn-state` in subsequent requests within same turn
4. Per-session state 管理（turn_state lifecycle）
5. 驗證：比較加 cache key 前後的 `cached_input_tokens` 數值

### Phase 2: Reasoning Reuse + Compression（中等難度）

1. 從 response 的 reasoning items 中提取 `encrypted_content`
2. 在下一次 request 的 input 中回傳 reasoning item（含 encrypted_content）
3. 接收 `x-reasoning-included: true` header 確認 server 已處理
4. 實作 zstd request body compression（ChatGPT 模式）
5. 驗證：比較 reasoning_output_tokens 是否下降

### Phase 3: WebSocket Transport（最大效能提升）

1. 建立 Bun WebSocket client 連接 codex endpoint
2. 實作 WebSocket handshake（OpenAI-Beta header）
3. 實作 prewarm（generate: false）
4. 實作 incremental delta（previous_response_id + delta input）
5. 實作 transport fallback（WebSocket 失敗 → HTTP SSE）
6. 整合到 CodexLanguageModel.doStream()
7. 驗證：比較 incremental vs 全量的 input_tokens

### Phase 4: Server-side Compaction

1. 呼叫 `/responses/compact` endpoint 做 server 端摘要
2. 整合到 opencode 的 compaction trigger（context overflow 時）
3. 驗證：compaction 後 context 大小顯著縮減

## Validation

### Phase 1
- [ ] Request 帶 `prompt_cache_key` 欄位（packet capture 驗證）
- [ ] `cached_input_tokens` > 0 在第二次 turn（log 驗證）
- [ ] `x-codex-turn-state` 被 capture 並 replay（log 驗證）
- [ ] 無 regression：codex provider 正常對話

### Phase 2
- [ ] Reasoning encrypted_content 在下次 request 中出現（packet capture）
- [ ] Response header `x-reasoning-included: true`（log 驗證）
- [ ] Request body 有 `Content-Encoding: zstd`（packet capture）
- [ ] 壓縮率 > 2x（log size before/after）

### Phase 3
- [ ] WebSocket connection 建立成功（log）
- [ ] Prewarm request 不消耗 output tokens（usage 驗證）
- [ ] Incremental delta 只送新增 items（packet capture）
- [ ] `input_tokens` 顯著低於全量（比較 log）
- [ ] WebSocket 失敗時自動 fallback 到 HTTP SSE

### Phase 4
- [ ] `/responses/compact` 呼叫成功（log）
- [ ] Compaction 後 conversation history 縮減（token count 比較）

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
- Wire protocol reference: `plans/codex-auth-plugin/diagrams/codex_a4_protocol_ref.json`
- 重要：每個 Phase 獨立可交付，Phase 1 完成即有價值。
