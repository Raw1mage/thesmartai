# Event: MCP Direct Render + Gmail Tool Overhaul (2026-04-07)

## Summary

Tool output direct rendering — MCP tool results displayed in fileview instead of being consumed by model. Full pipeline working: AI → gmail tools → HTML file → open_fileview → fileview tab with iframe.

## What Was Done

### Backend (all on main)
- `open_fileview` tool in system-manager MCP (writes KV, triggers fileview)
- Gmail tool: `get-message` saves HTML file, returns path (not content)
- Gmail tool: `list-messages` returns metadata only (not body)
- enablement.json: gmail/calendar routing with prefer tools + notes
- Enablement snapshot now includes specific tool names for routing (llm.ts)
- OAuth token auto-refresh (background timer + on-demand at launch)

### Frontend (all on main)
- `message-part.tsx`: createEffect for open_fileview auto-open (live only, skips history)
- `message-part.tsx`: ToolRegistry renderer for open_fileview with clickable file link
- `file-tabs.tsx`: HTML iframe renderer (sandbox, allow-same-origin, calc height)
- `session-side-panel.tsx`: "⋯" dropdown menu (Portal-based) with Open File / Download / New Tab
- `session-header.tsx`: 6th header button — file view toggle (notebook icon)
- `session.tsx`: opencode:open-file event listener → openTab()

### Cleanup
- Removed 18 dead code files (-2966 lines) from packages/app/src/
- Deleted obsolete `test/tool-direct-render-fix` branch

## Key Bug: Vite Build Not Reflecting Changes

Previous AI wrote code in `packages/app/src/pages/session/components/message-tool-invocation.tsx` — **dead code** never imported by the Vite module graph. Real import chain goes through `packages/ui/src/components/message-part.tsx`. Root cause: `message-timeline.tsx` imports `@opencode-ai/ui/session-turn`, not the local components.

## Architecture Decisions

- Gmail output stored in `.opencode/mcp-output/` under project root (workaround for fileview scope limitation)
- Long-term: runtime output should be in `~/.local/state/opencode/mcp-output/` once fileview supports absolute paths
- `modelProcess` in mcp.json: write tools (send/reply/forward/create-draft) need model processing; read tools default to direct render
- Enablement routing is text-only (system prompt), does not affect lazy tool schema loading
- Icon component uses `color: var(--icon-base)` — override via CSS variable, not inline color

## Commits

- `c3d5d5c62` plan(tool-direct-render)
- `cbe72bd8f` feat(mcp): tool output direct render
- `c9491d4d3` feat(mcp): tool output direct render — fileview bypass
- `e23a94cbb` feat(mcp): tool-driven fileview with HTML iframe renderer
- `051404b86` feat(mcp): add gmail + calendar to enablement.json routing
- `e1be6ae59` fix(mcp): fileview path scope + output dir injection
- `56bc3a60e` fix(ui): move open_fileview to live code + remove 18 dead files
- `fba4c7820` feat(ui): fileview auto-open, tool renderer, download menu, enablement routing
- `9c0463fca` feat(ui): add file view toggle button to session header

## Plan Status: COMPLETE

Deferred testing (5.3 send-message, 5.4 cron, 5.5 small model) — will address if bugs arise.
