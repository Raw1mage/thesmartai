# Event: drawmiat MCP Integration

**Date**: 2026-03-26
**Scope**: Integrate drawmiat (Python IDEF0/Grafcet SVG renderer) into opencode cms as MCP app

## Requirement

1. In session, discuss architecture and produce IDEF0/Grafcet JSON (reuse miatdiagram skill)
2. Render JSON to SVG via drawmiat's Python renderers
3. Enhanced SVG viewing/editing/download in the web frontend

## Scope

### IN
- Phase 1: Python service layer extraction + MCP server (drawmiat repo)
- Phase 1: opencode registration (SERVER_META, config, enablement.json)
- Phase 2: SvgViewer component with zoom/pan/download/fullscreen/source toggle
- Phase 2: Related diagrams gallery bar (auto-detect sibling diagram SVGs)
- Phase 3: SVG editor component (drag/move, text edit, delete, download)
- Phase 3: Edit button integration in SvgViewer with lazy-loaded editor

- Phase 4: Inline SVG card in conversation stream (ToolRegistry custom renderer)

### OUT
- TS/Bun core rewrite of renderers (long-term trajectory, not this task)
- `generate_diagram_from_text` MCP tool (miatdiagram skill handles text-to-JSON)
- Server-side file write API for SVG editor save (download-only for now)
- Round-trip SVG-to-JSON reverse conversion

## Key Decisions

1. **Integration pattern**: Python MCP server (stdio), not managed-app
2. **Code location**: drawmiat repo (`~/projects/drawmiat/`), opencode config points to it
3. **Single drawing core**: No TS reimplementation of renderers
4. **SVG delivery**: Inline in MCP tool result + filesystem write
5. **Editor approach**: Lazy-loaded Solid.js component ported from drawmiat's svg-editor-core.js
6. **Inline card**: SVG preview embedded in conversation stream via ToolRegistry custom renderer (not just file-tabs)

## Files Changed

### drawmiat repo
| File | Action | Purpose |
|------|--------|---------|
| `webapp/service.py` | NEW | Flask-free service layer (generate_svg, validate_json) |
| `mcp_server.py` | NEW | Python MCP server with generate_diagram + validate_diagram tools |
| `.venv/` | NEW | Python venv with `mcp` SDK |

### opencode repo
| File | Action | Purpose |
|------|--------|---------|
| `packages/opencode/src/mcp/index.ts` | EDIT | Added drawmiat to SERVER_META |
| `templates/opencode.json` | EDIT | Added drawmiat MCP server config |
| `~/.config/opencode/opencode.json` | EDIT | Runtime config with drawmiat MCP |
| `packages/opencode/src/session/prompt/enablement.json` | EDIT | drawmiat tool descriptions + routing |
| `templates/prompts/enablement.json` | EDIT | Template enablement sync |
| `packages/app/src/pages/session/file-tabs.tsx` | EDIT | SvgViewer + gallery bar + editor integration |
| `packages/app/src/components/svg-editor.tsx` | NEW | SVG editor Solid.js component |
| `packages/ui/src/components/diagram-tool.tsx` | NEW | Inline SVG card renderer for conversation stream |
| `packages/ui/src/components/message-part.tsx` | EDIT | Side-effect import of diagram-tool.tsx |

## Verification

### Phase 1
- [x] `service.py` imports correctly from drawmiat webapp directory
- [x] Service layer generates Grafcet SVG from JSON (tested with 3-step example)
- [x] Service layer generates IDEF0 SVG from JSON (tested with 2-activity example)
- [x] MCP server imports OK with Python MCP SDK
- [x] SERVER_META entry added for drawmiat
- [x] enablement.json updated (runtime + template) with tool descriptions and routing

### Phase 2
- [x] SvgViewer component has zoom/pan/download/source/fullscreen controls
- [x] Related diagrams gallery bar detects sibling diagram SVGs
- [x] TypeScript compilation passes (no new errors)

### Phase 3
- [x] SVG editor component created with drag/move, text edit, delete, download
- [x] Edit button in SvgViewer toolbar launches lazy-loaded editor
- [x] TypeScript compilation passes (no new errors)

### Phase 4 (Inline SVG Card)
- [x] `diagram-tool.tsx` parses MCP output into summary + SVG artifacts
- [x] `generate_diagram` renders inline SVG preview card (base64 img, sandbox safe)
- [x] `validate_diagram` renders summary-only card (Markdown)
- [x] Side-effect import in `message-part.tsx` triggers ToolRegistry registration
- [x] TypeScript compilation passes (no new errors from diagram-tool)

### Known Limitations
- SVG editor "Save" currently only downloads (no server-side write API)
- drawmiat MCP server requires Python venv at `~/projects/drawmiat/.venv/`
- MCP server is `enabled: false` by default — user must enable in market

## Architecture Sync

Architecture Sync: Verified — changes affect MCP infrastructure (new server registration) and frontend SVG rendering. No module boundary changes to existing bus/session/rotation3d infrastructure. New frontend components (SvgViewer, SvgEditor) are self-contained within file-tabs rendering pipeline.
