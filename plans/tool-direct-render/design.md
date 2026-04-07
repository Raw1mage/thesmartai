# Design: Tool Output Direct Render

## Context

All MCP tool outputs currently flow through a single path — the AI SDK processes the tool result, feeds it to the model as context, and the same output eventually reaches the UI via session parts. There is no way to show tool output to the user without the model consuming it first.

For data-retrieval tools (read email, list events), this wastes tokens and causes small models to truncate or fail. The user just wants to see the data.

### Current single-path architecture

```
MCP tool execute()
    ↓
return result to AI SDK  ──→  model sees full output (burns tokens)
    ↓
AI SDK emits "tool-result" stream event
    ↓
processor.ts writes to ToolPart (state.output = full text)
    ↓
Bus → UI shows output
```

**The gap**: model and UI see the SAME output. No fork point exists today.

## Goals / Non-Goals

**Goals:**

- MVP: text/markdown tool output direct to UI, model gets summary only
- Reduce token consumption >90% for read-only tool results
- Backward compatible — tools without directRender behave as before

**Non-Goals (future phases):**

- Phase 2: inline images, attachment download, HTML sandbox rendering
- Phase 3: "Ask AI to analyze" button — user-triggered model consumption
- Rich interactive tool outputs (editing, filtering)

## Decisions

| DD | Decision | Rationale |
|----|----------|-----------|
| DD-1 | `directRender` is default for ALL MCP app tools, opt-out via `modelProcess: [tool-names]` | User's requirement: default direct, AI processing is the exception. Inverted from original design |
| DD-2 | Fork via side-channel write before return | In the MCP tool wrapper (resolve-tools.ts), BEFORE returning summary to AI SDK, write fullOutput to the part via Session.updatePart(). This creates the fork: part has fullOutput for UI, AI SDK return value has summary for model |
| DD-3 | `fullOutput` field on ToolPart state | New field alongside existing `output`. UI checks `fullOutput` first; if present, renders it instead of `output` |
| DD-4 | Summary format: `[Content displayed to user ({N} chars). Ask user to describe what they see, or request "analyze this" to read the content.]` | Tells model the data is visible to user. Suggests interaction patterns |
| DD-5 | 64KB cap on fullOutput | Beyond 64KB, truncate with "... (truncated)" marker. Prevents session state bloat |
| DD-6 | Markdown renderer: reuse existing message markdown component | No new renderer needed for MVP. Tables, text, code blocks already supported |

## Data / State / Control Flow

### New fork architecture

```
MCP tool execute()
    ↓
resolve-tools.ts wrapper:
    1. Normalize result text (existing)
    2. Check: is this tool NOT in manifest.modelProcess[]?
       ├─ Default YES (direct render):
       │    a. Session.updatePart({ state: { fullOutput: text } })  ← UI gets full content
       │    b. return summary string to AI SDK                       ← model gets summary
       └─ NO (model process):
            return full text to AI SDK (existing behavior)
    ↓
AI SDK stream → processor.ts:
    - Direct render: output = summary, fullOutput already written
    - Model process: output = full text, fullOutput = undefined
    ↓
Bus → UI:
    - if part.state.fullOutput → render markdown(fullOutput)
    - else → render output as before
```

### Key detail: side-channel write timing

The MCP wrapper in resolve-tools.ts has access to `sessionID` and `messageID` (passed in closure). It can call `Session.updatePart()` to write `fullOutput` to the part BEFORE returning to AI SDK. When processor.ts later updates the same part with the summary, it must NOT overwrite `fullOutput`.

## Risks / Trade-offs

- **Risk**: Race between side-channel write (fullOutput) and processor write (output/status)
  - **Mitigation**: processor.ts must merge, not replace — check if `fullOutput` already exists on part before writing
- **Risk**: Model cannot help with direct-rendered content without explicit user trigger
  - **Mitigation**: Phase 3 will add "analyze this" mechanism. For MVP, user can copy-paste relevant parts into chat
- **Risk**: MCP tool wrapper needs access to Session.updatePart and part IDs
  - **Mitigation**: These are already available in the resolve-tools.ts closure (sessionID, messageID, toolID are all in scope)

## Critical Files

- `packages/opencode/src/mcp/manifest.ts` — add `modelProcess` to schema (list of tools that need model processing)
- `packages/opencode/src/mcp/app-store.ts` — propagate to AppEntry
- `packages/opencode/src/session/resolve-tools.ts` — side-channel write + summary return (THE core change)
- `packages/opencode/src/session/message-v2.ts` — add `fullOutput` to ToolPart state
- `packages/opencode/src/session/processor.ts` — merge guard: don't overwrite existing `fullOutput`
- `packages/app/src/pages/session/components/message-tool-invocation.tsx` — render fullOutput as markdown

## Future Phases

### Phase 2: Rich content
- Inline images (MCP ImageContent → `<img>` in tool result)
- Attachment download (new endpoint: `GET /api/v2/mcp/attachments/:id`)
- HTML sandbox (iframe with srcdoc, CSP restricted)

### Phase 3: "Ask AI to analyze"
- Button on direct-rendered tool output
- Sends fullOutput to model as a new user message or tool result injection
- User-triggered — no auto token consumption
