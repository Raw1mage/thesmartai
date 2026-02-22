# Event: Relocate mcp-gcp-grounding into packages/mcp

Date: 2026-02-23
Status: Done

## Decision

- Align incubating `mcp-gcp-grounding` with the new MCP layout by moving it under `packages/mcp/`.

## Changes

- Added:
  - `packages/mcp/gcp-grounding/index.ts`
  - `packages/mcp/gcp-grounding/package.json`
  - `packages/mcp/gcp-grounding/tsconfig.json`
- Removed legacy top-level draft files:
  - `packages/mcp-gcp-grounding/index.ts`
  - `packages/mcp-gcp-grounding/package.json`
  - `packages/mcp-gcp-grounding/tsconfig.json`
  - `packages/mcp-gcp-grounding/package-lock.json`

## Notes

- This remains an incubating MCP server and is not yet wired into runtime config by default.
