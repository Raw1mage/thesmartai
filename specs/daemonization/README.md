# Daemonization Specs

Canonical feature root for daemon/runtime control-plane architecture.

## Current State
- Root `spec.md` documents the C gateway splice-proxy baseline.
- Current repo runtime also includes daemonization-v2 behavior in TypeScript: `Daemon.spawnOrAdopt()`, TUI always-attach, discovery-based adopt, and `Server.listenUnix()` lifecycle startup/shutdown.
- For current truth, read this root together with `specs/architecture.md` and the slices below.

## Slices
- `slices/kill-switch/` — runtime stop-control and safety contract
- `slices/message-bus/` — runtime event/control substrate
