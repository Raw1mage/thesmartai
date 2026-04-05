# Tasks

## 1. ABI Contract

- [ ] 1.1 定義 `claude_provider.h`：error codes (CLAUDE_OK, CLAUDE_ERR_*)
- [ ] 1.2 定義 auth mode enum (CLAUDE_AUTH_NONE, CLAUDE_AUTH_OAUTH, CLAUDE_AUTH_API_KEY)
- [ ] 1.3 定義 plan type enum (CLAUDE_PLAN_FREE, CLAUDE_PLAN_PRO, CLAUDE_PLAN_MAX, CLAUDE_PLAN_TEAM, CLAUDE_PLAN_ENTERPRISE)
- [ ] 1.4 定義 SSE event type enum (CLAUDE_EVENT_MESSAGE_START, ..., CLAUDE_EVENT_MESSAGE_STOP)
- [ ] 1.5 定義 content block type enum (CLAUDE_BLOCK_TEXT, CLAUDE_BLOCK_TOOL_USE, CLAUDE_BLOCK_THINKING)
- [ ] 1.6 定義 config struct (claude_config_t): claude_home, storage_mode, issuer_url, client_id, version, callback_port
- [ ] 1.7 定義 auth status struct (claude_auth_status_t): mode, authenticated, stale, email, org_id, access_token
- [ ] 1.8 定義 model struct (claude_model_t): id, name, family, reasoning, toolcall, context_window, max_output
- [ ] 1.9 定義 event struct (claude_event_t): type, delta, delta_len, block_index, usage, error_code
- [ ] 1.10 定義 request struct (claude_request_t): model, body_json, body_json_len, reasoning_effort
- [ ] 1.11 定義 lifecycle 函數簽名: claude_init, claude_shutdown, claude_abi_version
- [ ] 1.12 定義 auth 函數簽名: claude_login_start, claude_login_exchange, claude_login_device, claude_refresh_token, claude_logout
- [ ] 1.13 定義 model/request 函數簽名: claude_get_models, claude_request, claude_get_originator, claude_strerror

## 2. Build System

- [ ] 2.1 建立 `packages/opencode-claude-provider/` 目錄結構 (include/, src/)
- [ ] 2.2 撰寫 CMakeLists.txt (C11, CURL, OpenSSL, cJSON, -Wall -Wextra -Werror -Wpedantic)
- [ ] 2.3 定義 shared library target: claude_provider.so
- [ ] 2.4 定義 CLI executable target: claude-provider
- [ ] 2.5 驗證 cmake build 通過

## 3. Core Lifecycle

- [ ] 3.1 實現 `provider.c`: global state struct (claude_global_t)
- [ ] 3.2 實現 `claude_init()`: config 解析、路徑解析、storage 初始化
- [ ] 3.3 實現 `claude_shutdown()`: 清理全部資源
- [ ] 3.4 實現 `claude_abi_version()`: return CLAUDE_PROVIDER_ABI_VERSION
- [ ] 3.5 實現 `claude_get_models()`: 靜態 model catalog (7 models)
- [ ] 3.6 實現 `claude_strerror()`: error code → human-readable string
- [ ] 3.7 實現 `originator.c`: `claude_get_originator()` → "claude-code/2.1.39"

## 4. Credential Storage

- [ ] 4.1 實現 `storage.c`: storage_init (路徑建立、mode 選擇)
- [ ] 4.2 實現 file-based storage: read/write `{claude_home}/auth.json`
- [ ] 4.3 實現 auth.json 格式: { type, refresh, access, expires, email, orgID }
- [ ] 4.4 實現 file permission enforcement (0600)
- [ ] 4.5 實現 storage_cleanup

## 5. OAuth Flows

- [ ] 5.1 實現 `auth.c`: PKCE challenge/verifier generation (SHA-256 + base64url)
- [ ] 5.2 實現 `claude_login_start()`: 組裝 authorize URL 含 PKCE + state + scopes
- [ ] 5.3 實現 `claude_login_exchange(code, verifier)`: POST /v1/oauth/token 換 token
- [ ] 5.4 實現 profile fetch: GET /api/oauth/profile → email + orgUuid
- [ ] 5.5 實現 `claude_login_device()`: device code flow (POST device auth endpoint + polling)
- [ ] 5.6 實現 `claude_refresh_token()`: refresh_token grant 含正確 scopes
- [ ] 5.7 實現 `claude_logout()`: 清除 credential + storage
- [ ] 5.8 實現 `claude_get_auth_status()`: 讀取當前 auth state

## 6. Request Signature（Reference-First — 最高優先級）

> **真相來源：official binary `~/.local/share/claude/versions/LATEST`，不是 anthropic.ts**

### 6.0 逆向提取（必須先做 — 對應 IDEF0 A1, GRAFCET Steps 100-114）

> 此階段的產出物是所有後續 C 實作的 **唯一真相來源**。
> 必須先完成以下文件才能進入 6.1+ 的 C 編碼：

- [ ] 6.0.1 **Protocol Datasheet** — 從 binary 提取所有協議常數（IDEF0 A12 產出）
  - VERSION, BUILD_TIME, CLIENT_ID, ATTRIBUTION_SALT
  - OAuth issuer/token/profile endpoints, scopes (authorize vs refresh)
  - Beta flags 完整列表（required + additional）
  - System prompt 三變體完整字串
  - Header scrub 完整列表
- [ ] 6.0.2 **Attribution Hash Algorithm Spec** — 逆向 `TG$` 函數及其 caller（IDEF0 A13 產出）
  - Hash H 參數計算方式
  - 驗證 `cch=00000` hardcoded
  - 識別 `cc_workload` 來源 (`iP$` function)
  - 識別 feature gate (`OZ4` function / `CLAUDE_CODE_ATTRIBUTION_HEADER` env)
- [ ] 6.0.3 **Packet Composition Diagram** — 完整 HTTP request 結構文件（IDEF0 A15 產出）
  - Header ordering and exact values
  - Body transform pipeline（system prompt → tool prefix → empty filter → serialize）
  - URL rewrite rules
- [ ] 6.0.4 **Handshake Chart** — OAuth 交握完整流程文件（IDEF0 A14 產出）
  - PKCE parameters (verifier length, challenge algorithm)
  - Authorize URL query parameters (exact order)
  - Token exchange POST body fields
  - Profile fetch endpoint and response format
  - Token refresh POST body fields + scope list
- [ ] 6.0.5 **SSE Event Schema** — response 事件格式文件（IDEF0 A16 產出）
  - All event types and their data JSON structure
  - Content block types and delta formats
  - Usage field location (message_delta)
  - mcp_ stripping rules
- [ ] 6.0.6 **Test Vectors** — 已知 input → 預期 wire-format output 對照表（IDEF0 A17 產出）
  - 至少 5 組 test cases（含 edge cases）
  - 每組包含：input body JSON + 預期 output headers + body + URL

### 6.1 Attribution Header (x-anthropic-billing-header)

- [ ] 6.1.1 實現 billing header assembly 精確匹配 official format: `cc_version=VERSION.HASH; cc_entrypoint=ENTRYPOINT; cch=00000;[ cc_workload=WORKLOAD;]`
- [ ] 6.1.2 `cch=00000` hardcoded（不是計算值）
- [ ] 6.1.3 VERSION 可配置（config 傳入或環境變數）
- [ ] 6.1.4 cc_workload optional field 支援
- [ ] 6.1.5 cc_entrypoint 讀取 `CLAUDE_CODE_ENTRYPOINT` env，default `"unknown"`
- [ ] 6.1.6 Hash 計算邏輯精確匹配 official（基於 6.0.2 逆向結果）

### 6.2 System Prompt

- [ ] 6.2.1 實現三變體 system prompt injection（由 config flag 控制）
- [ ] 6.2.2 實現 empty text block filtering (system + messages)

### 6.3 其他 Transform

- [ ] 6.3.1 實現 `transform.c`: mcp_ tool name prefix (tools array + messages tool_use blocks)
- [ ] 6.3.2 實現 required headers: `anthropic-beta` (含 additional betas: `prompt-caching-scope-2026-01-05`, `fine-grained-tool-streaming-2025-05-14`)
- [ ] 6.3.3 實現 required headers: `anthropic-version: 2023-06-01`, `User-Agent: claude-code/VERSION`, `Authorization: Bearer TOKEN`
- [ ] 6.3.4 實現 header scrub: 移除 x-api-key, anthropic-client, x-app, session_id, x-opencode-tools-debug, x-opencode-account-id
- [ ] 6.3.5 實現 URL rewrite: /v1/messages → /v1/messages?beta=true

### 6.4 驗證

- [ ] 6.4.1 用 test vectors 驗證 C plugin 輸出 vs official 輸出（byte-level 比對）
- [ ] 6.4.2 驗證 anthropic.ts 的已知偏差不存在於 C plugin 中

## 7. Transport + Streaming

- [ ] 7.1 實現 `transport.c`: libcurl HTTP POST (TLS, custom headers, streaming)
- [ ] 7.2 實現 `stream.c`: Anthropic SSE parser (event: / data: / 空行分隔)
- [ ] 7.3 實現 event type dispatch: message_start → CLAUDE_EVENT_MESSAGE_START, etc.
- [ ] 7.4 實現 content_block_delta parsing: text delta、tool_use delta、thinking delta
- [ ] 7.5 實現 response mcp_ prefix stripping (tool names in response events)
- [ ] 7.6 實現 usage extraction from message_delta event
- [ ] 7.7 實現 error event handling + retry logic (rate limit → backoff)

## 8. CLI Executable

- [ ] 8.1 實現 `main.c`: argument parsing (--version, --abi-version, --auth-status, --models)
- [ ] 8.2 實現 stdin JSON request → stdout JSONL events bridge
- [ ] 8.3 實現 login subcommand (--login-start, --login-exchange)
- [ ] 8.4 驗證 CLI executable 獨立運行

## 9. FFI Binding

- [ ] 9.1 撰寫 `claude-native.ts`: library discovery (search paths, lib names)
- [ ] 9.2 定義 FFI symbols table (claude_init, claude_shutdown, etc.)
- [ ] 9.3 實現 ClaudeNative namespace: load(), init(), shutdown(), isAvailable()
- [ ] 9.4 實現 auth wrappers: loginStart(), loginExchange(), refreshToken(), logout(), getAuthStatus()
- [ ] 9.5 實現 model wrappers: getModels()
- [ ] 9.6 實現 struct marshalling: ArrayBuffer → TypeScript interfaces

## 10. Integration

- [ ] 10.1 修改 plugin/index.ts: import claude-native, 條件載入 (native-first, TS-fallback)
- [ ] 10.2 驗證 native plugin 載入成功時 TS plugin 不啟動
- [ ] 10.3 驗證 native plugin 找不到時 TS plugin 正常 fallback
- [ ] 10.4 End-to-end: 透過 native plugin 完成 OAuth login
- [ ] 10.5 End-to-end: 透過 native plugin 完成一次 API 請求 + streaming
