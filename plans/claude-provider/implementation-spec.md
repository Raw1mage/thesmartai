# Implementation Spec

## Goal

- 以 C11 native plugin 形式重建 claude-cli provider 的 OAuth/transport/streaming 功能，比照 codex provider 架構，透過 Bun FFI 與 host 整合

## Scope

### IN

- `packages/opencode-claude-provider/` 完整 C11 package
- `claude_provider.h` FFI ABI contract
- OAuth PKCE (browser) + Device Code (headless) + token refresh
- Anthropic Messages API SSE streaming
- Claude Code 協議變形（mcp_ prefix, ?beta=true, system prompt, attribution hash）
- Credential storage (file/keyring/ephemeral)
- `claude-native.ts` Bun FFI binding
- `claude-provider` CLI executable (stdio bridge)

### OUT

- TypeScript plugin (anthropic.ts) 不動
- WebSocket transport 不做
- Anthropic Console API key flow 的 C 實現不做
- Windows 平台不做

## Assumptions

- Anthropic OAuth 端點（platform.claude.com）的行為穩定，不會在實作期間變更
- codex provider 的 C 架構模式可直接套用（build system、FFI pattern、storage backend）
- Bun FFI 可以同時載入兩個 native provider library 而不衝突
- **anthropic.ts 的協議細節有已知偏差**（VERSION、cch 值、cc_workload），C plugin 必須以 official binary 為真相來源

## Stop Gates

- 如果 Anthropic 變更 OAuth 端點或 scope 格式，需暫停重新評估
- 如果 Bun FFI 同時載入兩個 .so 有 symbol 衝突，需改 naming strategy
- 如果 Claude Code 協議（?beta=true、mcp_ prefix）被棄用或改版，需同步更新

## Critical Files

- `packages/opencode-claude-provider/include/claude_provider.h` — 新建：ABI contract
- `packages/opencode-claude-provider/CMakeLists.txt` — 新建：build config
- `packages/opencode-claude-provider/src/provider.c` — 新建：lifecycle + model catalog
- `packages/opencode-claude-provider/src/auth.c` — 新建：OAuth flows
- `packages/opencode-claude-provider/src/transport.c` — 新建：HTTP transport
- `packages/opencode-claude-provider/src/stream.c` — 新建：SSE parsing
- `packages/opencode-claude-provider/src/storage.c` — 新建：credential storage
- `packages/opencode-claude-provider/src/transform.c` — 新建：request transformation
- `packages/opencode-claude-provider/src/originator.c` — 新建：User-Agent
- `packages/opencode-claude-provider/src/main.c` — 新建：CLI stdio bridge
- `packages/opencode/src/plugin/claude-native.ts` — 新建：FFI binding
- `packages/opencode/src/plugin/anthropic.ts` — 參考：現有 TS 實現（不修改）
- `packages/opencode-codex-provider/include/codex_provider.h` — 參考：ABI 範本
- `packages/opencode-codex-provider/src/*.c` — 參考：C 實現範本

## Structured Execution Phases

- Phase 1: ABI Contract — 定義 `claude_provider.h`，對照 codex 但反映 Anthropic 協議差異
- Phase 2: Build System — CMakeLists.txt + 目錄結構
- Phase 3: Core Lifecycle — provider.c (init/shutdown/models) + originator.c
- Phase 4: Credential Storage — storage.c (file/keyring backend, auth.json 格式)
- Phase 5: OAuth Flows — auth.c (browser PKCE + device code + token refresh)
- Phase 6: **Request Signature（最高優先級）** — 從 official binary 逆向提取協議常數 → transform.c 精確匹配 official format（attribution header、system prompt 三變體、mcp_ prefix、?beta=true）
- Phase 7: Transport + Streaming — transport.c (libcurl HTTP) + stream.c (Anthropic SSE format)
- Phase 8: CLI Executable — main.c (stdio JSON bridge for standalone testing)
- Phase 9: FFI Binding — claude-native.ts (Bun FFI dlopen wrappers)
- Phase 10: Integration — plugin/index.ts 條件載入 + 驗證 native-first fallback

## Validation

- CMake build 成功產出 `claude_provider.so` + `claude-provider` executable
- `claude-provider --version` 輸出版本資訊
- `claude-provider --abi-version` 回傳 1
- **Reference-first: request signature test vectors 全部通過**（C plugin 輸出 vs official binary 輸出 byte-level 比對）
- **Reference-first: attribution header format 精確匹配** `cc_version=VERSION.HASH; cc_entrypoint=ENTRYPOINT; cch=00000;`
- **Reference-first: system prompt 三變體正確選擇**
- Unit tests: mcp_ prefix 添加/移除
- Unit tests: ?beta=true URL rewrite
- Unit tests: header scrub 完整性
- Integration: `claude-native.ts` 成功 dlopen 並讀取 ABI version
- Integration: `claude-native.ts` 能取得 model catalog
- End-to-end: 透過 native plugin 完成一次 OAuth login + API 請求（需有效帳號）

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
