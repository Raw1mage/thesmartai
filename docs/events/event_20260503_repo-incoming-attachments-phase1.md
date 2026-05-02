# 2026-05-03 — repo-incoming-attachments / Phase 1 Slice Summary

## Phase
1 — Foundation: incoming module skeleton + paths + history

## Done
- 1.1 `packages/opencode/src/incoming/` skeleton: `paths.ts`, `history.ts`, `dispatcher.ts` (stub for Phase 3), `index.ts`
- 1.2 `IncomingPaths.projectRoot()` — DD-1 fail-fast via `Instance.project.id === "global"` detection; throws `NoProjectPathError`
- 1.3 `IncomingPaths.sanitize(filename)` — DD-12: NUL byte hard reject (pre-strip), NFC normalize, C0/C1 control strip, path-separator reject, dot-segment reject, ≤ 256-byte UTF-8 cap
- 1.4 `IncomingPaths.nextConflictName(dir, name)` — DD-8: `(N)` suffix increment up to 10,000
- 1.5 `IncomingHistory.appendEntry()` — jsonl append via `O_APPEND` open + sync write (line-atomic for entries < PIPE_BUF); auto-`mkdir`; emits `incoming.history.appended` Bus event by default
- 1.6 `IncomingHistory.readTail()` — boundary-scan last line + zod parse; tolerant of missing optional fields (forward-compat)
- 1.7 `IncomingHistory.lookupCurrentSha()` — DD-6/R7: cheap-stat (mtime + sizeBytes) compared against last entry; on mismatch, recomputes sha and appends `drift-detected`
- 1.8 `IncomingHistory.rotate()` — DD-13: pre-append line count check; at ≥ 1000 lines atomic-rename to `<filename>.<unix-ts>.jsonl`
- 1.9 Tests: `packages/opencode/test/incoming/paths.test.ts` (12 cases) + `history.test.ts` (10 cases). All 22 pass.

## Key decisions / fixes during phase
- NUL byte test caught a sequencing bug — strip-then-check let `\0` slip through. Reordered to check NUL **before** control-char strip. Code rule: hard structural rejects come before lenient cleanup.
- Used `Instance.project.id === "global"` as the no-context signal rather than reaching into the private `Context.use()`. That keeps DD-1 enforced without leaking the project-instance internals into the incoming module.
- `appendEntry` uses sync FD with `O_APPEND` for line-atomic writes (POSIX guarantees mid-line interleaving cannot happen for writes < PIPE_BUF). No advisory file lock added in v1; deferred until contention proven.
- `Bus.publish` failures on `incoming.history.appended` are swallowed (`.catch(() => {})`) so a downed bus never blocks history append.

## Validation
- `bun test packages/opencode/test/incoming/` — 22/22 PASS, 0 failures, 45 expect() calls, 909 ms
- `bunx tsc --noEmit -p packages/opencode/tsconfig.json` — `incoming/` clean (other packages have pre-existing TS errors unrelated to this work)
- `bun run scripts/plan-sync.ts specs/repo-incoming-attachments/` — drift = `clean`

## Drift handled
None. sync-clean.

## Remaining
Phase 2 (upload route): refactors `packages/opencode/src/server/routes/file.ts` and `tool/attachment.ts`. **Is touching live opencode routes** — handoff.md recommends working in beta worktree from this point. Awaiting user direction before continuing.
