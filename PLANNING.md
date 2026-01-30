# Planning: raw -> cms feature migration

## Goal
Migrate all custom functionality from `raw` into `cms` while preserving `origin/dev` architecture and minimizing future merge friction.

## Scope (user confirmed)
- All custom features from `raw` branch.
- Includes CLI, TUI/slash handlers, auth/account flows, provider/model changes, and plugin integrations.

## Constraints
- Prefer compatibility with current `cms` architecture.
- Avoid destructive changes; preserve existing behavior unless necessary for parity with `raw`.

## Current Architecture Notes

### Google Authentication Structure
The system currently uses **three separate plugins** for Google authentication, not a single provider with multiple auth methods:

1. **AntigravityOAuthPlugin** (`antigravity-ivon0829`)
   - Provider ID: `antigravity-ivon0829`
   - Auth methods:
     - OAuth with Google (Antigravity)
     - Manually enter API Key
   - Uses Antigravity endpoints and header style
   - Supports multi-account switching and quota management

2. **AntigravityLegacyOAuthPlugin** (`antigravity`)
   - Provider ID: `antigravity`
   - Legacy compatibility plugin
   - Same auth methods as AntigravityOAuthPlugin

3. **GeminiCLIOAuthPlugin** (`google`)
   - Provider ID: `google` (or `gemini-cli`)
   - Auth methods:
     - OAuth with Google (Gemini CLI) [TEST]
     - Manually enter API Key
   - Uses Gemini CLI endpoints and header style
   - Separate from Antigravity plugin

**Key Point**: These are **independent providers** in the provider list. Users select a provider first, then see that provider's auth methods. The "multi-client simulation" refers to the ability to switch between `antigravity` and `gemini-cli` header styles within the Antigravity plugin's request routing logic, not to multiple auth methods in a single provider's auth dialog.

### Header Style Routing
Within the Antigravity plugin, requests can use different "header styles" to simulate different Google clients:
- `antigravity`: Uses Antigravity-specific endpoints and headers
- `gemini-cli`: Uses Gemini CLI-compatible endpoints and headers

This routing happens at the request level based on:
- Model suffix (`:antigravity` or `:gemini-cli`)
- Quota availability (automatic fallback between styles)
- Configuration preferences

## Plan
1. **Inventory & diff (include ranked list)**
   - Produce a **complete diff list** of changes unique to `raw` vs `cms`.
   - Rank by impact (High/Medium/Low) and user-facing risk.
   - Categorize by area: auth/accounts, handlers/commands, providers/models, plugins, UI/TUI.
2. **Map dependencies & conflicts**
   - Identify conflicts with `cms` structure and required refactors.
   - Note missing files, renamed modules, or upstream interface changes.
3. **Migrate by category (highest impact first)**
   - Auth/accounts (multi-account switching, header style routing).
   - Handlers/commands (`/model-check`, `/accounts`, `/models`, etc.).
   - Provider/model transforms and health checks.
   - Plugin-specific behavior and storage schema changes.
4. **Verify parity**
   - Ensure CLI vs slash outputs match (model-check, accounts, models).
   - Run targeted tests + smoke checks for user-visible flows.
5. **Stabilize & document**
   - Update debuglog with migration notes.
   - Record any behavioral differences that cannot be reconciled.

## Handoff Notes
- Use `git diff cms..raw` and compare with `packages/opencode` focus first.
- Maintain a checklist of migrated features and validation steps.
