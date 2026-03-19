# Event: MCP Server Unix Socket IPC + Auto-detection

**Date**: 2026-03-20
**Scope**: MCP server ↔ opencode communication, MCP mode auto-detection, webctl compile-mcp

---

## Requirement

MCP servers (system-manager etc.) communicate with the opencode daemon via HTTP, which fails in TUI mode (no web server). User requested a fundamental fix: use unix socket IPC instead of HTTP.

## Scope

### IN
- system-manager: unix socket IPC via `serverFetch()` wrapper
- config.ts: auto-detect source repo (no env var dependency for MCP mode)
- webctl.sh: `compile-mcp` command + staleness-based auto-recompile
- enablement.json: register `set_log_level` tool
- Removed `OPENCODE_INTERNAL_MCP_MODE="source"` from webctl.sh (auto-detected now)

### OUT
- Other MCP servers (refacting-merger, gcp-grounding) — unix socket changes only in system-manager
- Daemon auto-restart on code changes (manual restart required after code updates)

## Key Decisions

1. **Unix socket over HTTP**: MCP servers use `getDaemonSocketPath()` → `/run/user/<uid>/opencode/daemon.sock`, same path as `server/daemon.ts`
2. **`serverFetch()` wrapper**: Checks socket existence, adds `{ unix: sock }` to fetch options. Transparent fallback to regular HTTP when socket absent.
3. **Repo auto-detection**: `detectRepoRoot()` in config.ts uses `import.meta.url` to locate source tree, eliminating env var dependency for MCP source mode.
4. **No env-based MCP mode control**: User explicitly rejected `OPENCODE_INTERNAL_MCP_MODE` env var approach. Auto-detection is the only path.

## Debug Checkpoints

### Baseline
- Symptom: `set_log_level` tool returns 503 via daemon socket
- Reproduction: Start TUI session, wait for system-manager MCP, invoke `set_log_level action=get`

### Root Cause
- The 503 was from the **frontend catch-all** (`app.get("/*")`) in app.ts, returning `FRONTEND_BUNDLE_MISSING`
- The `/global/log-level` route was **not registered** because the daemon process was started (Mar 19 21:55) **before** the bus merge commit (Mar 20 00:19) that added the route
- `bun` does not hot-reload; daemon must be restarted to pick up new routes
- Confirmed: other GlobalRoutes GET endpoints (health, auth/session, config) worked; only log-level failed because it was added in the later commit

### Validation
- `curl --unix-socket daemon.sock http://localhost/api/v2/global/log-level` → `{"level":2,"name":"normal"}` ✓
- `curl -X POST -d '{"level":1}' ...` → `{"level":1,"name":"quiet"}` ✓
- All other API routes continue to work via unix socket ✓

## Remaining

- End-to-end test via MCP tool invocation (need user to start new TUI session)
- Other MCP servers don't have `serverFetch()` yet (system-manager only)
- Daemon has no auto-restart mechanism after code changes
- Architecture Sync: TBD (pending commit)
