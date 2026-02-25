# Event: origin/dev refactor round16 (run command crash hardening + error visibility)

Date: 2026-02-25
Status: Done

## Source behavior

- Upstream reference: `088eac9d4eaba040e7e19084fd82cbb2e32ce6ed`
- Intent: prevent `opencode run` crashes on malformed tool payloads and make errored tool calls visible in CLI output.

## Rewrite-only port in cms

- `packages/opencode/src/cli/cmd/run.ts`
  - Hardened `task(...)` rendering against malformed inputs:
    - safely reads `part.state.input`
    - uses fallback `subagent_type = "unknown"` when missing
    - uses fallback task title when description is absent
  - Handles tool part status `error` in event loop:
    - prints inline `✗ <tool> failed`
    - prints actual tool error message via `UI.error(...)`

- `packages/opencode/src/cli/ui.ts`
  - `UI.error` now strips duplicate leading `"Error: "` to avoid `Error: Error: ...` formatting.

## Additional analysis decision

- `d2d7a37bca7febac7df4dd0ecdbc5b1a2d55ef65`: integrated.
  - Attachment IDs/session/message ownership is already ensured by `materializeToolAttachments(...)`.

## Validation

- `bun run packages/opencode/src/index.ts run --help` ✅
- `bun test packages/opencode/test/cli/output-filtering.test.ts --timeout 20000` ✅
