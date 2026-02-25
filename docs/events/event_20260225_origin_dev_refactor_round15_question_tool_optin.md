# Event: origin/dev refactor round15 (question tool opt-in for ACP)

Date: 2026-02-25
Status: Done

## Source behavior

- Upstream reference: `9d3c81a68391399e46fab5307b03984511f92b09`
- Intent: keep ACP safe-by-default while allowing explicit opt-in for `QuestionTool`.

## Rewrite-only port in cms

- `packages/opencode/src/flag/flag.ts`
  - Added `OPENCODE_ENABLE_QUESTION_TOOL` boolean flag.

- `packages/opencode/src/tool/registry.ts`
  - Updated QuestionTool inclusion rule to:
    - include by default for `app|cli|desktop`
    - include for other clients only when `OPENCODE_ENABLE_QUESTION_TOOL=1`

## Additional analysis decision

- `2bab5e8c39f4ed70dbfe6d971728d8d899b88e4f`: skipped.
  - The referenced json-migration module is not present in current cms storage architecture.

## Validation

- `bun test packages/opencode/test/tool/registry.test.ts --timeout 20000` ✅
- `bun run packages/opencode/src/index.ts acp --help` ✅
