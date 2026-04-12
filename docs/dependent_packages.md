# External Dependency Registry

Last updated: 2026-04-13

## AI / LLM Providers

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `ai` (Vercel AI SDK) | 5.0.119 | Core LLM streaming framework | 全域 | 有大量客製 fetch interceptor / rotation / transport；升 6.x 需獨立 plan |
| `@ai-sdk/anthropic` | 2.0.58 | Anthropic Claude provider | 1 | |
| `@ai-sdk/openai` | 2.0.89 | OpenAI provider | 1 | |
| `@ai-sdk/google` | 2.0.52 | Google Gemini provider | 1 | |
| `@ai-sdk/google-vertex` | 3.0.98 | Google Vertex AI provider | 1 | |
| `@ai-sdk/amazon-bedrock` | 3.0.74 | AWS Bedrock provider | 1 | |
| `@ai-sdk/azure` | 2.0.91 | Azure OpenAI provider | 1 | |
| `@ai-sdk/groq` | 2.0.34 | Groq provider | 1 | |
| `@ai-sdk/mistral` | 2.0.27 | Mistral provider | 1 | |
| `@ai-sdk/cerebras` | 1.0.36 | Cerebras provider | 1 | |
| `@ai-sdk/cohere` | 2.0.22 | Cohere provider | 1 | |
| `@ai-sdk/deepinfra` | 1.0.33 | DeepInfra provider | 1 | |
| `@ai-sdk/perplexity` | 2.0.23 | Perplexity provider | 1 | |
| `@ai-sdk/togetherai` | 1.0.34 | Together AI provider | 1 | |
| `@ai-sdk/vercel` | 1.0.33 | Vercel AI provider | 1 | |
| `@ai-sdk/xai` | 2.0.51 | xAI (Grok) provider | 1 | |
| `@ai-sdk/gateway` | 2.0.30 | AI Gateway provider | 1 | |
| `@ai-sdk/openai-compatible` | 1.0.32 | OpenAI-compatible endpoints | 1 | |
| `@ai-sdk/provider` | 2.0.1 | Provider base types | — | Peer dep |
| `@ai-sdk/provider-utils` | 3.0.20 | Provider utilities | — | Peer dep |
| `@openrouter/ai-sdk-provider` | 1.5.4 | OpenRouter provider | 1 | |
| `ai-gateway-provider` | 2.3.1 | AI Gateway integration | 1 | |
| `@gitlab/gitlab-ai-provider` | 3.5.0 | GitLab Duo provider | 1 | |
| `@agentclientprotocol/sdk` | 0.13.0 | Agent Client Protocol | 1 | |

## Web Framework

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `solid-js` | 1.9.12 | UI framework | 全域 | TUI + Web |
| `@solidjs/router` | 0.15.4 | SPA routing | 多處 | |
| `@solidjs/start` | PR-preview | SSR framework | 多處 | 等上游 stable |
| `@solidjs/meta` | 0.29.4 | HTML head management | 少量 | |
| `hono` | 4.12.12 | HTTP server framework | 多處 | API routes |
| `hono-openapi` | 1.3.0 | OpenAPI integration | 少量 | |
| `@hono/zod-validator` | 0.4.2 | Request validation | 多處 | |
| `@hono/standard-validator` | 0.1.5 | Standard schema validation | 少量 | |
| `vite` | 7.1.4 | Build tool | — | Dev only |
| `tailwindcss` | 4.1.11 | CSS framework | — | Build time |

## CLI

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `yargs` | 18.0.0 | CLI argument parsing | 16+ | 核心 CLI 骨架，不可替代 |
| `@clack/prompts` | 1.2.0 | Interactive CLI prompts | 8 | select/text/confirm/spinner |
| `@opentui/core` | 0.1.97 | TUI rendering engine | 全域 | |
| `@opentui/solid` | 0.1.97 | TUI + Solid.js binding | 全域 | |
| `open` | 11.0.0 | Open URLs in browser | 4 | 跨平台 |
| `bun-pty` | 0.4.8 | Pseudo-terminal | 少量 | Shell runner |

## Data / Parsing

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `zod` | 4.1.8 | Schema validation | 全域 | |
| `zod-to-json-schema` | 3.25.2 | Zod → JSON Schema | 1 | OpenAPI 文件產生 |
| `jsonc-parser` | 3.3.1 | JSONC parse + modify | 2 | config.ts + mcp.ts |
| `gray-matter` | 4.0.3 | YAML frontmatter parsing | 2 | Template files |
| `turndown` | 7.2.4 | HTML → Markdown | 1 | webfetch tool |
| `marked` | 17.0.1 | Markdown → HTML | 2 | Web rendering |
| `marked-shiki` | 1.2.1 | Syntax highlighting | 2 | 搭配 marked |
| `shiki` | 3.20.0 | Code syntax highlighter | 少量 | |
| `diff` | 8.0.4 | Text diffing | 多處 | |
| `@pierre/diffs` | 1.1.0-beta.13 | Diff rendering | 多處 | |
| `decimal.js` | 10.6.0 | Precise decimal arithmetic | 1 | Token cost 計算 |
| `ulid` | 3.0.2 | Sortable unique IDs | 5 | 不可用 UUID 替代（需排序語義） |
| `fuzzysort` | 3.1.0 | Fuzzy string matching | 6 | Provider/file/UI search |
| `remeda` | 2.33.7 | FP utility library | 4+ | |
| `ignore` | 7.0.5 | Gitignore pattern matching | 1 | |

## Protocol / Integration

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP client/server | 多處 | 核心 MCP 整合 |
| `vscode-jsonrpc` | 8.2.1 | JSON-RPC protocol | 1 | LSP client |
| `@octokit/rest` | 22.0.1 | GitHub REST API | 少量 | |
| `@octokit/graphql` | 9.0.3 | GitHub GraphQL API | 少量 | |
| `@actions/core` | 1.11.1 | GitHub Actions SDK | 少量 | CI integration |
| `@actions/github` | 6.0.1 | GitHub Actions context | 少量 | CI integration |

## Auth

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `@openauthjs/openauth` | 0.0.0-preview | OAuth framework | 多處 | 等上游穩定再升 0.4 |
| `@gitlab/opencode-gitlab-auth` | 1.3.3 | GitLab OAuth | 少量 | |
| `authenticate-pam` | 1.0.5 | Linux PAM auth | 1 | Dynamic import，web-auth fallback |

## Infrastructure

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `@aws-sdk/client-s3` | 3.933.0 | S3 storage | 少量 | |
| `@parcel/watcher` | 2.5.6 | File watching | 1 (type + dynamic) | 高效 fs.watch 替代 |
| `@zip.js/zip.js` | 2.7.62 | Zip archive handling | 1 | ripgrep binary 解壓 |
| `bonjour-service` | 1.3.0 | mDNS discovery | 1 | 裝置發現 |
| `web-tree-sitter` | 0.25.10 | Tree-sitter WASM | 少量 | Code parsing |
| `tree-sitter-bash` | 0.25.1 | Bash grammar | 少量 | |

## UI Components

| Package | Version | Usage | Import Count | Notes |
|---------|---------|-------|-------------|-------|
| `@solid-primitives/event-bus` | 1.1.3 | Event bus primitive | 少量 | |
| `@solid-primitives/scheduled` | 1.5.3 | Scheduled execution | 少量 | |
| `@solid-primitives/storage` | 4.3.3 | Storage primitive | 少量 | |
| `@kobalte/core` | 0.13.11 | Accessible UI components | 少量 | |
| `solid-list` | 0.3.0 | Virtualized list | 少量 | |
| `virtua` | 0.42.3 | Virtual scrolling | 少量 | |
| `dompurify` | 3.3.1 | HTML sanitization | 少量 | XSS 防護 |
| `luxon` | 3.6.1 | Date/time formatting | 6+ | |

---

## Deferred Major Upgrades

| Package | Current | Latest | Reason |
|---------|---------|--------|--------|
| `ai` + `@ai-sdk/*` | 5.x | 6.x | 核心框架，大量客製 fetch interceptor/rotation/transport |
| `@openauthjs/openauth` | 0.0.0-preview | 0.4.3 | Auth 流程深度綁定，API 差異不明 |
| `typescript` | 5.8.2 | 6.0.2 | 需全 monorepo tsconfig 加 `types` 欄位 |
| `@solidjs/start` | PR-preview | stable | 等上游正式發佈 |
| `nitro` | 3.0.1-alpha.1 | stable | 等上游正式發佈 |

## Removed in 2026-04-13 Optimization

| Package | Reason |
|---------|--------|
| `chokidar` | Zero imports |
| `strip-ansi` | Replaced with inline regex |
| `xdg-basedir` | Replaced with 4-line env var reads |
| `clipboardy` | Replaced with native clipboard commands |
| `minimatch` | Zero imports |
| `partial-json` | Zero imports |
| `@standard-schema/spec` | Zero imports |
| `opentui-spinner` | Type-only import, inlined |
| `sst` | Upstream SaaS infra, not used in self-hosted fork |
