# Event: origin/dev refactor round18 (win32 plugin resolution + path normalization)

Date: 2026-02-25
Status: Done

## Source behavior

- Upstream references:
  - `1af3e9e557a6df4f933a01d0dad2e52e418ebd52`
  - `1a0639e5b89265ac89afd7bcfae835a64744768d`
- Intent: improve plugin resolution reliability and path matching correctness on Windows.

## Rewrite-only port in cms

- `packages/opencode/src/config/config.ts`
  - Added `createRequire` fallback when `import.meta.resolve` fails for plugin entries.
  - `rel()` now normalizes backslashes to slash form before pattern matching.

- `packages/opencode/src/file/ignore.ts`
  - Ignore path splitting now supports both `/` and `\\` separators.

- `packages/opencode/test/config/config.test.ts`
  - Updated scoped plugin resolution test expectation to file-URL from resolved node_modules path.

- `packages/opencode/test/file/ignore.test.ts`
  - Added win32-style separator coverage.

## Validation

- `bun test packages/opencode/test/config/config.test.ts -t "resolves scoped npm plugins in config" --timeout 30000` ✅
- `bun test packages/opencode/test/file/ignore.test.ts --timeout 20000` ✅
- `bun run packages/opencode/src/index.ts auth login --help` ✅
