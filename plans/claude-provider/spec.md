# Spec

## Purpose

- 以 C11 native plugin 復現 claude-cli provider 的 Anthropic OAuth 協議、request 變形、SSE 串流能力，與 codex provider 形成對稱架構

## Requirements

### Requirement: OAuth PKCE Browser Flow

The system SHALL implement Anthropic's browser-based OAuth PKCE authorization flow, matching official Claude CLI behavior.

#### Scenario: Successful browser OAuth login

- **GIVEN** the plugin is initialized with default config
- **WHEN** `claude_login_browser()` is called
- **THEN** a local HTTP server starts on the configured callback port
- **THEN** the system browser opens `https://platform.claude.com/oauth/authorize` with correct parameters (client_id, code_challenge, scope, state)
- **THEN** upon receiving the callback, the plugin exchanges the authorization code for tokens via `POST https://platform.claude.com/v1/oauth/token`
- **THEN** the refresh token, access token, and expiry are persisted via storage backend
- **THEN** the auth callback is invoked with `CLAUDE_OK` and user email

#### Scenario: OAuth state mismatch

- **GIVEN** the plugin is waiting for OAuth callback
- **WHEN** the callback contains a mismatched state parameter
- **THEN** the auth callback is invoked with `CLAUDE_ERR_AUTH_STATE_MISMATCH`
- **THEN** no tokens are stored

### Requirement: Device Code Flow

The system SHALL implement Anthropic's device code authorization flow for headless environments.

#### Scenario: Successful device code login

- **GIVEN** the plugin is initialized
- **WHEN** `claude_login_device()` is called
- **THEN** the device code callback is invoked with verification URL and user code
- **THEN** the plugin polls the token endpoint until authorization is granted
- **THEN** tokens are persisted and auth callback invoked with success

### Requirement: Token Refresh

The system SHALL automatically refresh expired OAuth tokens before API requests.

#### Scenario: Token refresh with valid refresh token

- **GIVEN** an authenticated session with an expired access token
- **WHEN** a request is initiated or `claude_refresh_token()` is called
- **THEN** the plugin sends `POST https://platform.claude.com/v1/oauth/token` with `grant_type=refresh_token` and correct scopes (user:profile, user:inference, user:sessions:claude_code, user:mcp_servers)
- **THEN** the access token is updated and stale flag is cleared

#### Scenario: Token refresh with revoked refresh token

- **GIVEN** an authenticated session with a revoked refresh token
- **WHEN** `claude_refresh_token()` is called
- **THEN** the function returns `CLAUDE_ERR_REFRESH_REVOKED`
- **THEN** auth status shows `authenticated = 0`

### Requirement: Request Transformation (Claude Code Protocol)

The system SHALL transform outgoing API requests to conform to the Claude Code subscription protocol.

#### Scenario: Tool name prefixing

- **GIVEN** a request body with tools array containing tool names
- **WHEN** `claude_transform_request()` processes the body
- **THEN** all tool names are prefixed with `mcp_` (unless already prefixed)
- **THEN** tool_use blocks in messages are also prefixed

#### Scenario: System prompt injection

- **GIVEN** a request body with or without system prompt
- **WHEN** `claude_transform_request()` processes the body
- **THEN** the system prompt starts with "You are Claude Code, Anthropic's official CLI for Claude."

#### Scenario: Beta endpoint routing

- **GIVEN** a request targeting `/v1/messages`
- **WHEN** the URL is constructed
- **THEN** `?beta=true` is appended to the URL

#### Scenario: Attribution header (x-anthropic-billing-header)

- **GIVEN** a request is being prepared
- **WHEN** the billing header is computed
- **THEN** the format is exactly `cc_version=VERSION.HASH; cc_entrypoint=ENTRYPOINT; cch=00000;[ cc_workload=WORKLOAD;]`
- **THEN** `cch` is hardcoded `00000` (not computed)
- **THEN** `cc_entrypoint` reads from `CLAUDE_CODE_ENTRYPOINT` env, defaults to `"unknown"`
- **THEN** `cc_workload` is optional (included only when workload context available)
- **THEN** the hash computation matches the official binary's algorithm (逆向驗證)

#### Scenario: System prompt identity variants

- **GIVEN** a request is being prepared
- **WHEN** the system prompt identity is selected
- **THEN** interactive mode uses: "You are Claude Code, Anthropic's official CLI for Claude."
- **THEN** non-interactive with append uses: "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK."
- **THEN** non-interactive pure agent uses: "You are a Claude agent, built on Anthropic's Claude Agent SDK."

### Requirement: SSE Streaming (Anthropic Messages API)

The system SHALL parse Server-Sent Events from the Anthropic Messages API and deliver structured events to the host.

#### Scenario: Successful streaming response

- **GIVEN** a valid authenticated request
- **WHEN** the API returns an SSE stream
- **THEN** each SSE event is parsed and delivered as a `claude_event_t` via the event callback
- **THEN** event types include: message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop
- **THEN** the callback receives text deltas, tool use deltas, and thinking/reasoning blocks

#### Scenario: mcp_ prefix stripping in response

- **GIVEN** a streaming response containing tool names with `mcp_` prefix
- **WHEN** events are parsed
- **THEN** the `mcp_` prefix is stripped from tool names before delivery to host

### Requirement: Credential Storage

The system SHALL persist OAuth credentials using the configured storage backend.

#### Scenario: File-based storage

- **GIVEN** storage mode is `CLAUDE_STORAGE_FILE` with `claude_home` set
- **WHEN** credentials are saved
- **THEN** an `auth.json` file is written at `{claude_home}/auth.json` with tokens, email, and plan type
- **THEN** file permissions are set to 0600

### Requirement: Model Catalog

The system SHALL report a static catalog of available Claude models.

#### Scenario: Get models

- **GIVEN** the plugin is initialized
- **WHEN** `claude_get_models()` is called
- **THEN** the function returns at least 5 Claude models (Haiku 4.5, Sonnet 4.5, Sonnet 4.6, Opus 4.5, Opus 4.6)
- **THEN** each model includes id, name, family="claude", capabilities, limits, and cost=0 (subscription)

## Acceptance Checks

- `claude_login_browser()` completes OAuth flow and stores credentials
- `claude_refresh_token()` refreshes an expired token using correct scopes
- `claude_transform_request()` produces correctly prefixed tool names and injected system prompt
- Attribution hash matches reference implementation output for test vectors
- SSE parser correctly handles multi-line data fields and event boundaries
- `claude_get_models()` returns the expected model catalog
- `claude-native.ts` successfully loads the library and reads ABI version
- CLI executable (`claude-provider`) can perform auth status check via stdio
