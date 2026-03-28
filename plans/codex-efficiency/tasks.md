# Tasks

## 1. Prompt Cache + Sticky Routing（HTTP, 立即可用）

- [ ] 1.1 在 codex custom fetch 中注入 `prompt_cache_key: session_id` 到 request body — 從 session context 取 session ID，在 body transform 時加入
- [ ] 1.2 在 codex custom fetch 中 capture response header `x-codex-turn-state` — 從 fetch response headers 讀取，存入 per-request state
- [ ] 1.3 建立 per-turn state storage — 在 session/llm.ts 或 provider 層維護 `{ turnState, responseId }` per session
- [ ] 1.4 在 codex custom fetch 中 replay `x-codex-turn-state` header — 從 per-turn state 讀取，注入到下一次 request headers
- [ ] 1.5 Turn state lifecycle：新 user message 時清除 turnState（fresh routing），tool-call loop 時保留
- [ ] 1.6 驗證：送 2 個 turn，確認第二個 turn 的 `cached_input_tokens > 0`（log 比較）
- [ ] 1.7 驗證：tool-call loop 中確認 `x-codex-turn-state` header 被 replay（packet capture 或 log）

## 2. Encrypted Reasoning Reuse + Compression

- [ ] 2.1 確認 conversation history 保存 reasoning items 時不 strip `encrypted_content` 欄位 — 追蹤 history 構建路徑，確保 encrypted_content 被保留
- [ ] 2.2 在 request input 構建時，保留之前 turn 的 reasoning item（含 encrypted_content）— 確認 AI SDK 的 message→input 轉換不丟棄 reasoning
- [ ] 2.3 從 response headers 讀取 `x-reasoning-included: true` — 當 server 確認已處理 reasoning 時，跳過 client-side reasoning token 估算
- [ ] 2.4 實作 zstd request body compression — 在 custom fetch 中，ChatGPT 模式下對 body 做 zstd 壓縮，設 `Content-Encoding: zstd`
- [ ] 2.5 Compression fallback — 如果 Bun 不支援 zstd，嘗試 gzip；都不行則不壓縮
- [ ] 2.6 驗證：比較連續 turn 的 reasoning_output_tokens（有 encrypted replay 時應為 0 或顯著降低）
- [ ] 2.7 驗證：確認壓縮率 > 2x（log body size before/after compression）

## 3. WebSocket Transport + Incremental Delta + Prewarm

- [ ] 3.1 建立 Bun WebSocket client module — 連接 `wss://chatgpt.com/backend-api/codex/responses` 或對應 endpoint
- [ ] 3.2 WebSocket handshake headers — 注入 `OpenAI-Beta: responses_websockets=2026-02-06`、`Authorization`、`chatgpt-account-id`、`originator` 等全部 14 種 headers
- [ ] 3.3 WebSocket message 發送 — 序列化 `{"type":"response.create", ...}` 為 text frame
- [ ] 3.4 WebSocket event 接收 — parse text frames 為 JSONL events，dispatch 到 LanguageModelV2StreamPart
- [ ] 3.5 Prewarm 實作 — session 開始時發送 `generate: false` request，capture response_id 和 turn_state，不消耗 output tokens
- [ ] 3.6 Incremental delta 實作 — 比較 current request vs last response，如果只有 input 追加則送 delta + `previous_response_id`
- [ ] 3.7 Delta detection 邏輯 — 比較非 input 欄位（instructions, tools），如果改變則送全量
- [ ] 3.8 Transport fallback — WebSocket 連接失敗或 426 → 設 disable_websocket flag → 走 HTTP SSE
- [ ] 3.9 整合到 CodexLanguageModel.doStream() — 偵測 WebSocket 可用時優先使用，否則 fallback 到 Bun.spawn C binary 或 AI SDK
- [ ] 3.10 驗證：WebSocket 連接成功（log connection established）
- [ ] 3.11 驗證：incremental delta 的 input_tokens < 全量的 50%（log 比較）
- [ ] 3.12 驗證：prewarm 的 output_tokens = 0（usage log）

## 4. Server-side Compaction

- [ ] 4.1 實作 `/responses/compact` API call — POST 當前 conversation history 到 compact endpoint，接收壓縮後的 history
- [ ] 4.2 整合到 compaction trigger — 在 `session/compaction.ts` 中，當 provider 是 codex 時優先嘗試 server compact
- [ ] 4.3 Compact result 處理 — 用 server 回傳的 compacted history 替換 session history
- [ ] 4.4 Fallback — server compact 失敗（404, 500, timeout）時 fallback 到 client-side compaction
- [ ] 4.5 驗證：compact 後 context token count 降低 > 50%（log 比較）
