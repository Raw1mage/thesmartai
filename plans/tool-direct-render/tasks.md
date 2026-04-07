# Tasks

## Phase 1 — Schema + Manifest

- [ ] 1.1 Add `modelProcess: z.array(z.string()).optional()` to `McpAppManifest.Schema` (tools that NEED model processing; all others default to direct render)
- [ ] 1.2 Propagate `modelProcess` to `AppEntry` in app-store.ts via `buildEntry()`
- [ ] 1.3 Add `fullOutput: z.string().optional()` to ToolPart state in message-v2.ts

## Phase 2 — Core Fork Mechanism (resolve-tools.ts)

- [ ] 2.1 In MCP tool wrapper: after result normalization, check if tool name is NOT in app's `modelProcess[]`
- [ ] 2.2 Direct render path: call `Session.updatePart()` to write `fullOutput` to part state BEFORE returning to AI SDK
- [ ] 2.3 Direct render path: return summary string to AI SDK instead of full text
- [ ] 2.4 Summary format: `[Content displayed to user ({N} chars). Ask user to describe what they see, or request "analyze this" to read the content.]`

## Phase 3 — Processor Merge Guard

- [ ] 3.1 In processor.ts "tool-result" handler: when updating part state, preserve existing `fullOutput` if already set
- [ ] 3.2 Verify no race: side-channel write completes before processor write (log timestamps)

## Phase 4 — UI Rendering

- [ ] 4.1 In message-tool-invocation.tsx: detect `part.state.fullOutput`
- [ ] 4.2 When fullOutput exists: render with existing markdown component (tables, text, code)
- [ ] 4.3 Collapsible "Show more" for outputs exceeding ~200 lines
- [ ] 4.4 Tool header (title, status icon) still renders above content

## Phase 5 — Gmail Integration + Validation

- [ ] 5.1 Gmail mcp.json: default direct render (no `modelProcess` field needed — all tools direct by default)
- [ ] 5.2 If send-message/reply-message need model confirmation, add them to `modelProcess`
- [ ] 5.3 Rebuild and deploy gmail-server binary
- [ ] 5.4 Test: `get-message` on large email — UI shows markdown, model sees < 100 token summary
- [ ] 5.5 Test: `send-message` — model still processes result (in modelProcess list)
- [ ] 5.6 Test: small model (qwen 9B) handles direct-rendered gmail
- [ ] 5.7 Test: non-MCP tools (bash, edit) unchanged

## Stop Gates

- SG-1: Non-MCP tools (bash, edit, etc.) must be completely unaffected
- SG-2: Model must never see >200 tokens for a direct-rendered result
- SG-3: fullOutput capped at 64KB
- SG-4: Race between side-channel write and processor write must be verified safe
