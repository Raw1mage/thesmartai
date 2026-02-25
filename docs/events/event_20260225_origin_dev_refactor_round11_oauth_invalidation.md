# Event: origin/dev refactor round11 (oauth credential invalidation hook)

Date: 2026-02-25
Status: Done

## Source behavior

- Upstream reference: `fb79dd7bf857a95a6045209cc1f3f859563a8081`
- Intent: allow OAuth client provider to invalidate credentials on provider instruction.

## Rewrite-only port in cms

- `packages/opencode/src/mcp/oauth-provider.ts`
  - Added `invalidateCredentials(type)` with support for:
    - `all` → remove MCP auth entry
    - `client` → clear stored client registration
    - `tokens` → clear token set only

## Additional analysis decision

- `991496a753545f2705072d4da537c175dca357e6`: integrated.
  - ACP hanging protections already present in cms (`util/git` ACP-safe spawn path + snapshot ACP bypass).

## Validation

- `bun run packages/opencode/src/index.ts mcp --help` ✅
- `bun test packages/opencode/test/mcp/oauth-browser.test.ts`
  - first run had baseline timeout failures
  - re-run with `--timeout 20000`: 2 pass, 1 timeout (existing flaky test in this environment)
