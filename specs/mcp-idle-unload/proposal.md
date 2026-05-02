# Proposal: mcp-idle-unload

## Why

- MCP store-apps (`mcp-apps.json` entries, exposed in the unified app market under `kind="mcp-app"` / id prefix `store-`) are connected lazily on the first `MCP.tools()` call but then **pinned for the daemon's entire lifetime**. There is no eviction path.
- The pin matters now because we are about to register `docxmcp` as a `docker run -i --rm ...` stdio app. Once first-touched, a Python container stays resident in RAM for the full daemon uptime, even if the user never invokes a docx tool again that session. Multiply by future Docker-based store-apps and idle resource consumption grows without bound.
- The opposite extreme — per-call container spawn — was rejected upthread because the 500 ms–2 s startup tax on every tool call is worse than holding a process. The right point on the spectrum is **lazy load, idle unload**: pay startup once on first use, release on idle, accept a re-spawn cost the next time the user comes back.

## Original Requirement Wording (Baseline)

- "lazyload是對的，但不需要pin。一段時間不調用就unload"

## Requirement Revision History

- 2026-05-02: initial draft created via plan-init.ts (mode `new`)
- 2026-05-02: baseline requirement captured from session — lazy load is correct, no pin, idle eviction with timeout

## Effective Requirement Description

1. MCP store-app (`mcpapp-*` named) clients must be unloaded after a configurable idle period with no tool invocations.
2. After unload, the next `MCP.tools()` call must transparently re-spawn the client; behavior identical to first-time lazy load.
3. The eviction must not affect non-store MCP entries (those configured directly via `opencode.json.mcp`) — those are intentional, user-curated pins.
4. The idle threshold is a tweak (`tweaks.cfg`), not a hardcoded constant; ships with a sane default.
5. An unload that races with an in-flight tool call must not kill the call — eviction respects in-flight count.

## Scope

### IN

- `packages/opencode/src/mcp/index.ts` — state shape change, idle timer, unload + re-spawn path.
- `packages/opencode/src/mcp/app-store.ts` — only if the unload contract requires the store layer to expose a re-connect entrypoint.
- `tweaks.cfg` schema — add `mcp.idle_unload_ms` (default proposed: 300_000 = 5 minutes).
- Observability: emit a `mcp.app.unloaded` event so the web UI / TUI can mark the card as "idle" and a future re-connect will trigger its existing `mcp.app.connected` reaction.

### OUT

- Per-tool granularity (we evict the whole client/process, not individual tools).
- `opencode.json.mcp`-configured servers (no eviction; pin stays).
- Managed-app entries (`google-calendar`, `gmail`, etc.) — they are short-lived stdio Node processes today and are not the resource pain.
- HTTP / SSE long-running variants — those are user-managed via `docker compose up/down`; eviction is the operator's job, not opencode's.

## Non-Goals

- Adaptive timeout based on usage patterns. Constant configurable threshold is enough for v1.
- Pre-warming or scheduled wake-up. Lazy re-spawn on next demand is the contract.
- Cross-daemon coordination. Each daemon manages its own MCP clients.

## Constraints

- Must not regress current first-call latency. The eviction path runs on a timer; the hot path stays the same.
- Must not invalidate the `tools()` cache in a way that triggers a cache stampede. Re-spawn happens only when the user actually calls a tool that needs the unloaded client.
- Eviction must not silently swallow errors; emit a structured log + event so operators can see "unloaded after Xms idle".
- Must coexist with the existing `MCP.disconnect()` user-initiated path — we reuse it, not duplicate.

## What Changes

- The process-level boolean `mcpAppsInitialized` flag in `mcp/index.ts:933` becomes a `Set<string>` of currently-connected app ids, so re-connect is per-id.
- A new per-client `lastUsedAt: number` is recorded on every successful `client.callTool()` (touched in `convertMcpTool()`).
- An idle sweeper timer (single `setInterval`, 30 s tick) walks `state.clients`, picks `mcpapp-*` entries whose `lastUsedAt + idle_unload_ms < now` AND `inflight === 0`, and calls `MCP.disconnect(name)`.
- `connectMcpApps()` becomes idempotent on a per-id basis — every `tools()` call re-runs the connect path for any `enabled && !connectedApps.has(id)` app.

## Capabilities

### New Capabilities

- `mcp.idle-unload`: automatic eviction of idle store-app stdio clients with configurable threshold.
- Observability event `mcp.app.unloaded` carrying `{ id, idleMs, lastUsedAt }`.

### Modified Capabilities

- `MCP.tools()` first-call lazy-load: no longer one-shot per daemon; becomes per-id idempotent re-load.
- App-market card status: now also reflects the idle state (a card may be `enabled: true` but currently disconnected; the UI should distinguish "disabled by user" from "evicted by idle timer").

## Impact

- Affected code: `packages/opencode/src/mcp/index.ts`; possibly `packages/opencode/src/mcp/app-store.ts`; `tweaks.cfg` schema + loader.
- Affected APIs: `GET /api/v2/mcp/market` payload — store cards may need a richer `status` enum (`connected | disabled | idle-evicted`) so the web UI can render correctly. To be confirmed in design.
- Affected operators: web/TUI app-market rendering — minor copy update if status enum grows.
- Affected docs: `specs/architecture.md` § MCP subsystem (note the lifecycle change).
- Affected tests: any test that relies on `mcpAppsInitialized` boolean — likely none, but `plan-gaps.ts` will surface them in the `designed` stage.
