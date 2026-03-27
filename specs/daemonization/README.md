# Daemonization Specs

Canonical feature root for daemon/runtime control-plane architecture.

## Current State Summary

Daemonization now spans two layers that must be read together:

1. **C gateway splice-proxy baseline**
   - Documented by `spec.md` and `design.md`
   - Covers root gateway concerns: PAM auth, reverse-proxy compatibility, JWT validation, gateway-owned routes, and privileged daemon spawning boundary

2. **TypeScript daemonization-v2 runtime**
   - Implemented in repo code and partially preserved as slices
   - Covers `Daemon.spawnOrAdopt()`, TUI always-attach, discovery-based adopt, and `Server.listenUnix()` lifecycle startup/shutdown

## How to Read This Root

- Treat `spec.md` as the privileged gateway baseline, not the full daemonization SSOT by itself.
- Treat `packages/opencode/src/server/daemon.ts`, `packages/opencode/src/cli/cmd/tui/thread.ts`, `packages/opencode/src/server/server.ts`, and `specs/architecture.md` as the current runtime truth for daemon lifecycle behavior.
- Treat `slices/` as related runtime-control-plane slices that extend daemonization beyond the root gateway baseline.

## Slices
- `slices/kill-switch/` — runtime stop-control and safety contract
- `slices/message-bus/` — runtime event/control substrate
