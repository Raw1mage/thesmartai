# Event - 2026-04-10 - Webapp Registry Gateway Pivot

## Context
During the implementation of the `webapp-registry` plan, a critical architectural flaw was identified:
- We wanted to allow **anonymous users** to access published routes (like `/cecelearn`).
- However, the routing logic was built inside the TypeScript Daemon (`packages/opencode/src/server/app.ts`).
- **The Catch-22**: In Opencode's architecture, an unauthenticated request hitting the C Gateway (`daemon/opencode-gateway.c`) is immediately served a Login page. The Per-User Daemon is **only spawned after successful PAM login**. Thus, anonymous users could never reach the TypeScript Daemon to have their route resolved.

## Decision
- Abandoned the TypeScript Daemon-based routing implementation.
- Pivoted to making the **C Gateway** the true Host-wide Aggregator and Reverse Proxy.
- `webctl.sh` will now act as a static aggregator, scanning `~/.config/web_registry.json`, resolving conflicts, and writing a flat `/run/opencode-gateway/routes.conf`.
- `opencode-gateway.c` will parse this conf, match URL prefixes, and `splice()` directly to the target ports (e.g., `127.0.0.1:5173`), entirely bypassing the PAM/JWT authentication loop for `access: "public"` routes.
