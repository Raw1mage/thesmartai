# Event: Add MCP packages to workspace glob

Date: 2026-02-23
Status: Done

## Decision

- Include `packages/mcp/*` in root Bun workspace package globs.

## Why

- Ensure MCP subpackages under `packages/mcp/` are recognized as first-class monorepo workspaces.
- Keep MCP layout refactor consistent with dependency/workspace management.

## Change

- Updated `/home/pkcs12/projects/opencode/package.json`
  - `workspaces.packages` now includes `"packages/mcp/*"`.
