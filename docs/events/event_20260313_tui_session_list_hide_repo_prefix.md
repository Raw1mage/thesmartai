# Event: TUI session list hides repo prefix

Date: 2026-03-13
Status: Done

## Decision

- TUI session list rows should no longer prepend `[$reponame]` to session titles.
- This is a display-only change in the TUI formatter/render path; session persistence, API payloads, and shared naming semantics remain unchanged.

## Scope

- `packages/opencode/src/cli/cmd/tui/component/dialog-session-list.tsx`
  - Removed project-name prefixing from the TUI session list label formatter.
  - Kept child tree prefixes and child-count suffixes unchanged.

## Validation

- `bun test packages/opencode/test/server/session-list.test.ts`
- `bun x tsc --noEmit`
