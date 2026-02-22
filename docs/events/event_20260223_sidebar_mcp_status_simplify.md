# Event: Sidebar MCP Status Simplification

Date: 2026-02-23
Status: Done

## Decision

- Keep MCP status indication via colored dot only for common states.
- Hide textual labels `Connected` and `Disabled` in sidebar MCP rows.

## Why

- Reduce visual noise.
- Dot color already communicates enabled/disabled state clearly.

## Changes

- Updated `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
  - For MCP rows, no status text is shown when status is `connected` or `disabled`.
  - Text is still shown for actionable/error states (`failed`, `needs_auth`, `needs_client_registration`).
