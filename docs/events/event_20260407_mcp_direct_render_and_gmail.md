# Event: MCP Direct Render + Gmail Tool Overhaul (2026-04-07)

## Summary

Attempted to implement tool output direct rendering — MCP tool results displayed directly in fileview instead of being consumed by model. Backend flow works; frontend blocked by vite build issue.

## What Was Done

### Settings UI (merged to main via beta workflow)
- Settings schema (mcp.json `settings.fields`) + AppEntry config storage
- Settings dialog UI (gear icon → auth + config form)
- Auth status badge on app market cards
- OAuth token auto-refresh (background timer + on-demand at launch)

### Direct Render (partially on main, frontend WIP on test branch)
- `open_fileview` tool added to system-manager MCP
- Gmail tool: `get-message` saves HTML file, returns path (not content)
- Gmail tool: `list-messages` returns metadata only (not body)
- enablement.json: gmail/calendar routing added
- templates/prompts/enablement.json synced

### Fileview Enhancements
- HTML iframe renderer added to file-tabs.tsx (sandbox, allow-same-origin)
- `opencode:open-file` event bridge in session.tsx

## Blocking Issue

**Vite build does not include changes to `message-tool-invocation.tsx`.**

Symptoms:
- Source file has new code (createEffect for auto-open, FileViewAutoOpen component)
- `strace` confirms vite opens the correct file
- Build output (`session-CfITHmNk.js`) hash does not change regardless of source edits
- Even `console.log("XYZZY")` marker does not appear in build output
- Tried: rm -rf dist, rm node_modules/.cache, rm node_modules/.vite, fresh env, node instead of bun
- All produce identical output

## Root Cause (RESOLVED 2026-04-07)

`message-tool-invocation.tsx` in `packages/app/src/pages/session/components/` is **dead code**. The Vite module graph never imports it — `message-timeline.tsx` imports `SessionTurn` from `@opencode-ai/ui/session-turn` (resolved to `packages/ui/src/components/session-turn.tsx`), which uses `message-part.tsx` for tool rendering. The app-level `components/session-turn.tsx` and `message-tool-invocation.tsx` are orphaned files imported only by each other.

**Fix**: Added `createEffect` for `open_fileview` auto-open in the correct file: `packages/ui/src/components/message-part.tsx` (the tool part wrapper that's actually in the module graph).

## Completed

- [x] Root cause vite build issue — dead code, wrong file being edited
- [x] Complete frontend open_fileview auto-open integration (in message-part.tsx)
- [x] Build verified: `open_fileview` string present in production build
- [ ] Verify end-to-end: AI → get-message → open_fileview → fileview tab opens

## Branches

- `main`: all changes merged
- `test/tool-direct-render-fix`: obsolete (dead code edits), can be deleted

## Decisions

- Gmail output stored in `.opencode/mcp-output/` under project root (workaround for fileview scope limitation)
- Long-term: runtime output should be in `~/.local/state/opencode/mcp-output/` once fileview supports absolute paths
- `modelProcess` in mcp.json: write tools (send/reply/forward/create-draft) need model processing; read tools default to direct render
