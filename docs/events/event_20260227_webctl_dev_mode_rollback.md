# Event: Roll back webctl start to static frontend serving

Date: 2026-02-27
Status: Done

## Trigger

- Running `webctl.sh start` in dual-process dev mode caused side effects:
  1. Terminal control noise/garbled sequences in TUI session.
  2. Runtime UX drift from expected production-like 3-column model selector flow.

## Decision

- Revert default `webctl.sh start` behavior to static frontend serving (`packages/app/dist`) via backend web server.
- Keep server process detached from the current TTY by redirecting output to `/tmp/opencode-web.log`.

## Changes

- `webctl.sh`
  - `start/up` restored to backend-only + `OPENCODE_FRONTEND_PATH=$FRONTEND_DIST`.
  - Added detached startup logging: `/tmp/opencode-web.log`.
  - `status/help` text restored to static-mode semantics.
  - `stop` continues to clean stale frontend dev process/pid if left from previous run.

## Validation

- `bash -n webctl.sh` ✅
- `./webctl.sh restart` ✅
- `./webctl.sh status` ✅ (healthy true)
