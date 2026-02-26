# Event: origin/dev refactor round77 (github prompt overflow + pty cross-talk)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Address a focused CLI runtime error-reporting fix and resolve PTY cross-talk candidate classification.

## 2) Candidate(s)

- `d447b7694afc0080b78e7052b9de4c5a1a5f9eaf` (`github prompt-too-large error`)
- `de25703e9dd33df4dff6b5b8ae9a722f6ca2aa81` (`terminal cross-talk`)

## 3) Decision + rationale

- `d447...`: **Ported (rewrite-only)**
  - Added explicit `PROMPT_TOO_LARGE` formatting with file-size context and improved error payload extraction in GitHub command chat/summary paths.
- `de257...`: **Integrated**
  - cms PTY stack already contains stronger socket/token isolation and existing `pty-output-isolation` regression coverage; no extra port required.

## 4) File scope

- `packages/opencode/src/cli/cmd/github.ts`
  - added `formatPromptTooLargeError()`
  - upgraded assistant error handling to detect `ContextOverflowError` and emit explicit user-facing overflow diagnostics

## 5) Validation

- `bun run typecheck` (packages/opencode): known baseline antigravity noise only (non-blocking)
- `bun run packages/opencode/src/index.ts github --help` ✅
- `bun run packages/opencode/src/index.ts session list --help` ✅

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before execution.
- No architecture boundary/semantic change; no architecture doc update required.
