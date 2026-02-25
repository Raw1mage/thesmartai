# Event: origin/dev refactor round10 (read tool streaming memory optimization)

Date: 2026-02-25
Status: Done

## Source behavior

- Upstream reference: `c1b03b728af259a1556dc39db58e162b382527b3`
- Intent: make read tool memory usage more efficient on large files.

## Rewrite-only port in cms

- `packages/opencode/src/tool/read.ts`
  - Switched file text reading from full-file `file.text().split("\n")` to line-stream processing via `readline.createInterface` + `fs.createReadStream`.
  - Kept existing cms user-facing output contract (offset semantics/messages) while reducing peak memory pressure.
  - Updated binary detection sampling to use `fs.promises.open(...).read(...)` (sampled read) rather than full `arrayBuffer()` load.
  - Added explicit long-line suffix constant for clearer truncation annotation.

- `packages/opencode/test/tool/read.test.ts`
  - Added binary detection tests:
    - rejects text files containing null bytes
    - rejects known binary extensions (`.wasm`)

## Additional analysis decision

- `3b9758062b4417b6ff3df2dd9a6c461be24ee0b6`: skipped for now (broad fs/promises style sweep; not required for this behavior fix).

## Validation

- `bun test packages/opencode/test/tool/read.test.ts`
  - first run had one baseline 5s timeout in env-permission matrix
  - re-run build matrix subset with `--timeout 20000`: pass
