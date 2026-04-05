# Design

## Context

- codex provider 已成功以 C11 native plugin 實現，約 3500 行 C + 300 行 TypeScript FFI binding
- claude-cli provider 目前以約 560 行 TypeScript 實現，涵蓋 OAuth、request transform、SSE response transform
- 兩個 provider 的協議有根本差異：Codex 使用 OpenAI Responses API（ChatGPT backend），Anthropic 使用 Messages API
- Anthropic 額外要求：mcp_ tool prefix、?beta=true、系統 prompt identity 驗證、attribution hash

## Goals / Non-Goals

**Goals:**

- 建立與 codex provider 對稱的 C native plugin 架構
- **Request signature 100% 符合 refs/claude-code 原始碼** — transport layer 的 packet format 必須從 official binary 逆向驗證，不可只參考 anthropic.ts（它有已知偏差）
- 支援 native-first + TS-fallback 載入模式
- ABI 穩定，版本化獨立於 codex

**Non-Goals:**

- 不追求與 codex provider 共用 C 代碼（兩個 provider 的協議完全不同）
- 不做 generic provider C framework（每個 provider 獨立實現）
- 不做 WebSocket transport（Anthropic 目前無 WS API）

## Decisions

### DD-1: 獨立 ABI，命名空間以 `claude_` 為 prefix

所有 C 函數以 `claude_` 開頭（vs codex 的 `codex_`），避免 symbol 衝突。header guard 為 `CLAUDE_PROVIDER_H`。ABI 版本獨立追蹤 `CLAUDE_PROVIDER_ABI_VERSION = 1`。

**Why:** 兩個 .so 可能同時被載入同一 process（Bun FFI dlopen），symbol 名必須唯一。

### DD-2: SSE Event 型別映射到 Anthropic Messages API 事件

Codex provider 使用 OpenAI Responses API 事件（response.created, output_item.added, ...）。Claude provider 必須映射 Anthropic 事件格式：

| Anthropic Event | Claude Event Enum |
|---|---|
| message_start | CLAUDE_EVENT_MESSAGE_START |
| content_block_start | CLAUDE_EVENT_CONTENT_BLOCK_START |
| content_block_delta | CLAUDE_EVENT_CONTENT_BLOCK_DELTA |
| content_block_stop | CLAUDE_EVENT_CONTENT_BLOCK_STOP |
| message_delta | CLAUDE_EVENT_MESSAGE_DELTA |
| message_stop | CLAUDE_EVENT_MESSAGE_STOP |
| ping | CLAUDE_EVENT_PING |
| error | CLAUDE_EVENT_ERROR |

**Why:** Anthropic 和 OpenAI 的 SSE 事件結構完全不同，不能共用 enum。

### DD-3: OAuth 端點差異封裝

| | Codex (OpenAI) | Claude (Anthropic) |
|---|---|---|
| Issuer | auth.openai.com | platform.claude.com |
| Authorize | /oauth/authorize | /oauth/authorize |
| Token | /oauth/token | /v1/oauth/token |
| Profile | (JWT claims) | GET /api/oauth/profile |
| Client ID | app_EMoamEEZ73f0CkXaXp7hrann | 9d1c250a-e61b-44d9-88ed-5944d1962f5e |
| Redirect | http://localhost:1455/auth/callback | https://platform.claude.com/oauth/code/callback |
| PKCE | local HTTP server | code paste (no local server) |

關鍵差異：Anthropic OAuth 不使用 local HTTP callback server，而是用 code paste 模式（`response_type=code`, redirect 到 platform 的 callback page，用戶手動貼回 code）。

**Why:** 這改變了 `auth.c` 的結構 — 不需要實現 local HTTP server，改為 expose code exchange 函數讓 host 呼叫。

### DD-4: Request Signature 必須 100% 符合 refs/claude-code（最高優先級）

**真相來源是 official binary（`/home/pkcs12/.local/share/claude/versions/2.1.87`），不是 `anthropic.ts`。**

`anthropic.ts` 中有已知偏差，C plugin 不可繼承這些偏差，必須以 binary 逆向結果為準。

#### 4a. Attribution Header（`x-anthropic-billing-header`）

**Official format（from binary function `TG$`）：**

```
x-anthropic-billing-header: cc_version=VERSION.HASH; cc_entrypoint=ENTRYPOINT; cch=00000;[ cc_workload=WORKLOAD;]
```

| Field | Official (v2.1.87) | anthropic.ts (偏差) |
|---|---|---|
| VERSION | Build version (e.g. `2.1.87`) | Hardcoded `2.1.39` ❌ |
| HASH | 由 caller 傳入的 hash 值 | `calculateAttributionHash()` — salt-based ⚠️ |
| cch | `00000` (hardcoded) | `d7a3a` ❌ |
| cc_entrypoint | `CLAUDE_CODE_ENTRYPOINT` env / `"unknown"` | `"unknown"` ✓ |
| cc_workload | Optional, from `iP$()` function | 不存在 ❌ |

**C plugin 必須：**
- 使用可配置的 VERSION（config 傳入或 `#define`）
- `cch=00000` hardcoded
- 支援 `cc_workload` optional field
- Hash 計算邏輯需精確匹配 official — 需進一步逆向 `TG$` 的 caller

#### 4b. System Prompt Identity（三變體）

**Official（from binary function `ZG$`）：**

| 條件 | Identity String |
|---|---|
| Interactive (default) | `"You are Claude Code, Anthropic's official CLI for Claude."` |
| Non-interactive + hasAppendSystemPrompt | `"You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK."` |
| Non-interactive (pure agent) | `"You are a Claude agent, built on Anthropic's Claude Agent SDK."` |

`anthropic.ts` 只用了第一個變體。C plugin 應支援 config 選擇或由 host 指定。

#### 4c. 其他 Transform（與 anthropic.ts 一致）

1. **mcp_ tool prefix**: 所有 tool name 加 `mcp_` prefix，response 中移除
2. **?beta=true**: Messages API URL 必須帶 `?beta=true`（confirmed: `/v1/models?beta=true` 也需要）
3. **Required betas header**: `anthropic-beta: oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14`
4. **Additional betas from custom loader**: `prompt-caching-scope-2026-01-05`, `fine-grained-tool-streaming-2025-05-14`
5. **Header scrub**: 移除 `x-api-key`, `anthropic-client`, `x-app`, `session_id`
6. **User-Agent**: `claude-code/VERSION`（VERSION 需與 billing header 一致）

**Why:** request signature 是 Anthropic 驗證 Claude Code 訂閱身份的核心。任何偏差都可能導致降級到 free tier 或被拒絕。C plugin 是重新對齊 official 行為的機會，不應繼承 anthropic.ts 的歷史偏差。

### DD-5: Storage 路徑與格式

| | Codex | Claude |
|---|---|---|
| 預設 home | ~/.codex | ~/.claude-provider |
| Env override | CODEX_HOME | CLAUDE_PROVIDER_HOME |
| Auth file | auth.json | auth.json |
| Format | { mode, access, refresh, account_id, email, plan_type } | { type, refresh, access, expires, accountId, email, orgID } |

**Why:** 獨立的 storage 路徑避免與 codex 衝突，格式對齊現有 TypeScript plugin 的 auth 物件結構。

### DD-6: No Local HTTP Server（Code Paste Mode）

與 codex 的 browser OAuth 不同，Anthropic 的 redirect_uri 是 `https://platform.claude.com/oauth/code/callback`，不是 `http://localhost:PORT`。用戶在瀏覽器完成授權後，平台頁面會顯示 authorization code，用戶手動貼回。

**C plugin 提供兩個函數：**
- `claude_login_start()` → 回傳 authorize URL + PKCE verifier
- `claude_login_exchange(code, verifier)` → 用 code 換 token

Host (TypeScript) 負責：打開瀏覽器、收集用戶輸入的 code、呼叫 exchange。

**Why:** 這比 codex 的 local server 更簡單（不需 socket 編程），且匹配 Anthropic 的官方流程。

### DD-7: Model Catalog — 靜態定義 + 訂閱模式

所有模型 cost = 0（subscription included）。靜態定義 7 個模型：

| Model ID | Context | Max Output | Reasoning |
|---|---|---|---|
| claude-haiku-4-5-20251001 | 200K | 8192 | No |
| claude-sonnet-4-5-20250514 | 200K | 16384 | Yes |
| claude-sonnet-4-6-20250627 | 200K | 16384 | Yes |
| claude-opus-4-5-20250514 | 200K | 32768 | Yes |
| claude-opus-4-6-20250627 | 1M | 32768 | Yes |
| claude-sonnet-4-5-v2-20250514 | 200K | 16384 | Yes |
| claude-opus-4-5-v2-20250514 | 200K | 32768 | Yes |

**Why:** 訂閱制下模型列表相對穩定，hardcode 避免運行時 API 呼叫。

### DD-8: Reference-First Validation（逆向驗證方法論）

C plugin 的 request signature 實作必須遵循以下驗證流程：

1. **逆向 official binary** — 從 `/home/pkcs12/.local/share/claude/versions/LATEST` 提取所有協議常數（strings + decompile）
2. **建立 test vectors** — 用 official binary 產生已知 input → output 的 request signature 對照表
3. **C plugin 輸出比對** — 同樣 input 下，C plugin 產生的 HTTP request 必須 byte-for-byte 匹配 official
4. **持續追蹤** — 當 claude-code 版本升級時，重新提取常數並更新 C plugin

**不可以**：
- 從 anthropic.ts 抄常數（它有已知偏差）
- 自行猜測 hash 算法（必須逆向確認）
- 假設 cch 值（official 是 hardcoded 00000）

**驗證項目清單：**

| Request Component | 驗證方法 |
|---|---|
| `User-Agent` | strings 提取 → 比對 |
| `anthropic-beta` | strings 提取 → 比對 |
| `anthropic-version` | strings 提取 → 比對 |
| `x-anthropic-billing-header` | 完整 format 逆向 → test vector |
| System prompt identity | strings 提取 → 三變體確認 |
| mcp_ prefix | 行為測試 → request/response 比對 |
| ?beta=true URL | 行為測試 → URL 比對 |
| Header scrub list | strings 提取 → 確認完整列表 |

## Data / State / Control Flow

### OAuth Flow (Code Paste Mode)

```
Host (TS)                        C Plugin                         Anthropic
    |                                |                                |
    |-- claude_login_start() ------->|                                |
    |<-- { url, verifier } ----------|                                |
    |                                |                                |
    |== open browser(url) =========================================>|
    |<== user copies code ==========================================|
    |                                |                                |
    |-- claude_login_exchange(code, verifier) -->|                    |
    |                                |-- POST /v1/oauth/token ------->|
    |                                |<-- { access, refresh } --------|
    |                                |-- GET /api/oauth/profile ----->|
    |                                |<-- { email, orgUuid } ---------|
    |                                |-- storage_save() ------------->|
    |<-- { ok, email, orgId } ------|                                |
```

### Request Flow

```
Host (TS)                        C Plugin                         Anthropic API
    |                                |                                |
    |-- claude_request(req, cb) ---->|                                |
    |                                |-- refresh_if_needed() -------->|
    |                                |-- transform_request() -------->|
    |                                |   (mcp_ prefix, system prompt, |
    |                                |    attribution hash)           |
    |                                |-- POST /v1/messages?beta=true  |
    |                                |   Headers: Bearer, betas,     |
    |                                |   billing, User-Agent -------->|
    |                                |<-- SSE stream events ---------|
    |                                |-- parse_sse() --------------->|
    |                                |   (strip mcp_ from response)  |
    |<-- cb(event) -----------------|                                |
    |<-- cb(event) -----------------|                                |
    |<-- cb(COMPLETED) -------------|                                |
```

## Risks / Trade-offs

- **Risk: OAuth 協議變更** — Anthropic 可能更新 scope、beta flags、或棄用 code paste mode。Mitigation: 將所有協議常數集中在 header 的 `#define` 區塊，變更時只需改一處。
- **Risk: Bun FFI dual-library loading** — 同時 dlopen codex_provider.so 和 claude_provider.so 可能有 libcurl/OpenSSL 重複初始化問題。Mitigation: 兩個 library 各自 call `curl_global_init()` 時使用 `CURL_GLOBAL_NOTHING` 以避免重複初始化。
- **Risk: SSE 格式差異** — Anthropic Messages API 的 SSE 格式與 OpenAI 不同（`event:` field 是 type discriminator，`data:` 是完整 JSON object）。Mitigation: 專用 SSE parser，不與 codex 共用。
- **Trade-off: 靜態 model catalog** — 新模型上線需要更新 C 代碼並重新編譯。但訂閱制模型更新頻率低，且 host 可以從 models.dev 補充，可接受。
- **Trade-off: Code paste vs local server** — Code paste 模式 UX 較差（多一步手動操作），但匹配 Anthropic 官方行為。未來如果 Anthropic 支援 localhost redirect，可以加 local server。

## Critical Files

- **`~/.local/share/claude/versions/LATEST`** — **Request signature 真相來源**（official binary，逆向提取協議常數）
- `packages/opencode-codex-provider/include/codex_provider.h` — ABI 範本
- `packages/opencode-codex-provider/src/*.c` — C 實現範本（每個 .c 對照改寫）
- `packages/opencode/src/plugin/anthropic.ts` — 現有 TS 實現（參考，但有已知偏差，不作為 request signature 真相來源）
- `packages/opencode/src/plugin/codex-native.ts` — FFI binding 範本
- `packages/opencode/src/plugin/index.ts` — Plugin 載入入口（需小改）
