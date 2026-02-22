# Event: MCP Layout Refactor (scripts -> packages/mcp)

Date: 2026-02-23
Status: Done

## Decision

- Consolidate project-owned MCP server implementations into a dedicated directory: `packages/mcp/`.
- Keep `scripts/` for general operational/developer scripts, not as the primary MCP implementation location.

## Changes

- Moved MCP implementations:
  - `scripts/system-manager.ts` -> `packages/mcp/system-manager/src/index.ts`
  - `scripts/system-manager-session.ts` -> `packages/mcp/system-manager/src/system-manager-session.ts`
  - `scripts/system-manager-session.test.ts` -> `packages/mcp/system-manager/src/system-manager-session.test.ts`
  - `scripts/refacting-merger-mcp.ts` -> `packages/mcp/refacting-merger/src/index.ts`
- Added compatibility shims (old paths preserved):
  - `scripts/system-manager.ts`
  - `scripts/refacting-merger-mcp.ts`
- Updated references to new canonical paths:
  - `package.json` (`mcp:refacting-merger`)
  - `templates/skills/refactor-from-src/SKILL.md`
  - `templates/skills/refactor-from-src/references/refacting_merger_mcp.md`

## Runtime follow-up

- Local runtime config (`~/.config/opencode/opencode.json`) command paths for `system-manager` and `refacting-merger` were updated to `packages/mcp/.../src/index.ts`.

## Rationale

- Improve codebase discoverability and ownership boundaries.
- Reduce mental overhead from mixing MCP services with generic scripts.
- Create a scalable home for future MCP servers.
