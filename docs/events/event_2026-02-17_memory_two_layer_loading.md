# Memory two-layer loading (global + project)

Date: 2026-02-17
Scope: `packages/opencode/src/config/config.ts`, `packages/opencode/src/mcp/index.ts`

## Decision

Adopt AGENTS-like hierarchical memory loading:

- Global memory: XDG data path (`$XDG_DATA_HOME/opencode/memory/global.jsonl`)
- Project memory: repo path (`<worktree>/.opencode/memory/project.jsonl`)

The primary `memory` MCP now defaults to **project scope**, while two explicit scopes are also exposed:

- `memory-project`
- `memory-global`

## Why

- Prevent cross-project memory pollution.
- Keep repo-local decisions close to project artifacts.
- Preserve long-lived personal/global memory for cross-project preferences.

## Implementation notes

1. `Config` layer rewrites memory MCP configuration when `mcp.memory` uses `@modelcontextprotocol/server-memory`:
   - `memory` -> project file
   - `memory-project` -> project file
   - `memory-global` -> global file
2. MCP startup ensures `MEMORY_FILE_PATH` parent directory exists for memory-prefixed servers.

## Operational note

- Memory is **not auto-injected like system prompt**; it remains tool-driven retrieval/writes.
- Layering here controls storage scope and availability, not automatic prompt inclusion.
