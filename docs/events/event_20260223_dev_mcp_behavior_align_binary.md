# Event: Align dev MCP behavior with binary

Date: 2026-02-23
Status: Done

## Decision

- Make `bun run dev` MCP behavior consistent with binary mode.
- Remove hard skip flag that forced all MCP servers to appear disabled in dev.

## Changes

- Updated `/home/pkcs12/projects/opencode/package.json`:
  - `scripts.dev`: removed `OPENCODE_SKIP_MCP_AUTO=1`
  - `scripts.dev:perfprobe`: removed `OPENCODE_SKIP_MCP_AUTO=1`

## Expected behavior

- Dev now follows normal MCP lifecycle:
  - `enabled !== false` entries can connect normally.
  - disabled entries remain disabled.
  - on-demand connect still works for disabled entries when user enables/connects them.
