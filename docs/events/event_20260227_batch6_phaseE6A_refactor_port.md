# Event: Batch-6 Phase E6-A rewrite-port (Windows change-detection backend)

Date: 2026-02-27
Status: Done

## Scope

- `a74fedd23` fix(desktop): change detection on Windows/Cygwin

## Decision summary

- Ported (opencode backend + tests):
  - `packages/opencode/src/util/filesystem.ts`
  - `packages/opencode/src/tool/bash.ts`
  - `packages/opencode/src/project/project.ts`
  - `packages/opencode/src/file/watcher.ts`
  - `packages/opencode/test/util/filesystem.test.ts`
- Skipped/deferred (app-side UX wording/different flow):
  - `packages/app/src/context/file/path.ts`
  - `packages/app/src/context/file/path.test.ts`
  - `packages/app/src/pages/session.tsx`

## Changes

- Added `Filesystem.windowsPath()` to canonicalize Git Bash/Cygwin/WSL-style paths on win32.
- Updated bash tool path resolution to reuse `Filesystem.windowsPath()` instead of ad-hoc regex conversion.
- Updated project git path resolution (`rev-parse` outputs) via `gitpath()` helper with Windows normalization and safe newline trimming.
- Updated file watcher init flow to avoid hard early-return on non-git projects while still subscribing `.git` internals only when vcs is git.
- Added comprehensive `windowsPath()` unit tests in filesystem test suite.

## Validation

- `bun test packages/opencode/test/util/filesystem.test.ts packages/opencode/test/tool/bash.test.ts` ✅
- `bun turbo typecheck --filter=opencode` ✅

## Notes

- Rewrite-only policy respected (no merge/cherry-pick).
