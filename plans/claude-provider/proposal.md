# Proposal

## Why

- 現有的 claude-cli provider 完全以 TypeScript 實現（`packages/opencode/src/plugin/anthropic.ts`），包含 OAuth 流程、token 管理、request 變形、SSE response 串流處理
- codex provider 已成功將同等複雜度的邏輯以 C11 native plugin 形式實現（`packages/opencode-codex-provider/`），透過 Bun FFI 整合
- 將 claude-cli 也遷移至 C native plugin 可獲得：效能提升（crypto/TLS ops）、統一的 plugin 架構、auth 憑證與 host process 隔離、更堅固的 token 管理

## Original Requirement Wording (Baseline)

- "這個repo曾經寫過 claude-cli provider，後來封閉不用了。現在開一個 plan 把它復現出來，但是改用 C 語言的型式打造成 oauth plugin，比照 codex provider 的方式存在。"

## Effective Requirement Description

1. 建立 `packages/opencode-claude-provider/` C11 package，結構完全比照 `packages/opencode-codex-provider/`
2. 實現 Anthropic OAuth PKCE 流程（platform.claude.com）、token refresh、credential storage
3. 實現 Claude Code 協議變形（mcp_ tool prefix、?beta=true、system prompt injection、attribution hash）
4. 實現 SSE streaming 解析（Anthropic Messages API 格式）
5. 定義完整的 FFI ABI contract（`claude_provider.h`）
6. 建立 TypeScript FFI binding layer（`packages/opencode/src/plugin/claude-native.ts`）
7. 現有 TypeScript plugin（`anthropic.ts`）保留作為 fallback，不刪除

## Scope

### IN

- C11 shared library：auth、transport、stream、storage、transform、originator
- CMake 建置系統（libcurl + OpenSSL + cJSON）
- FFI ABI header（`claude_provider.h`）
- CLI executable（stdio JSON bridge）
- Bun FFI TypeScript binding（`claude-native.ts`）
- 完整的 Anthropic OAuth 協議實現

### OUT

- 不修改現有 TypeScript plugin（`anthropic.ts`）
- 不修改 supported-provider-registry.ts（claude-cli 已註冊）
- 不改變 provider 在 host 中的載入順序或優先級
- 不實作 WebSocket transport（HTTP SSE only）
- 不改動帳號管理層（Tier 1/2/3 不動）

## Non-Goals

- 取代 TypeScript plugin — 兩者共存，native 優先、TS fallback
- 支援 Windows（先 Linux/macOS，Windows 後續）
- 支援 Anthropic Console API key 模式的 C 實現（OAuth only in C; API key 繼續走 TS）

## Constraints

- C11 standard，與 codex provider 相同的編譯器要求
- 必須使用相同的 dependency stack：libcurl、OpenSSL、cJSON
- ABI 版本化必須獨立於 codex provider（`CLAUDE_PROVIDER_ABI_VERSION = 1`）
- OAuth 協議必須精確匹配 official Claude CLI（claude-code/2.1.39）行為

## What Changes

- 新增 `packages/opencode-claude-provider/` 完整 C11 package
- 新增 `packages/opencode/src/plugin/claude-native.ts` FFI binding
- plugin/index.ts 新增 claude-native 載入路徑（native-first, TS-fallback）

## Capabilities

### New Capabilities

- **C native OAuth**: Browser PKCE + Device Code 流程，完全在 C 中處理
- **C native token refresh**: 自動 refresh 含 mutex 保護，不依賴 JS event loop
- **C native credential storage**: 與 codex 對等的 file/keyring/ephemeral storage backend
- **C native request transform**: mcp_ prefix、?beta=true、system prompt injection、attribution hash
- **C native SSE streaming**: Anthropic Messages API SSE 格式解析
- **CLI executable**: `claude-provider` stdio bridge 可獨立測試

### Modified Capabilities

- **Plugin loading**: plugin/index.ts 會先嘗試載入 native library，失敗時 fallback 到 TypeScript plugin

## Impact

- 新增約 3500-4000 行 C 代碼（比照 codex provider 規模）
- 新增約 300 行 TypeScript FFI binding
- plugin/index.ts 小幅修改（新增一個 import + 條件載入）
- build 流程需新增 CMake 步驟（與 codex provider 共用 pattern）
