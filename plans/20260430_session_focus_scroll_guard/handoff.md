# Handoff

## Execution Contract

- Implement the smallest session-page guard that preserves browsing position without disabling explicit user navigation.
- Prefer tests around pure hooks/utilities; avoid browser-server restart.

## Stop Gates

- Stop if fixing requires changing `createAutoScroll` public contract broadly.
- Stop if deep-link hash behavior requires a product decision.
- Stop if validation would require daemon restart.

## Validation Plan

- Run focused tests for `use-session-hash-scroll` and session prompt/focus behavior if available.
- Run TypeScript or targeted app test command if focused tests are insufficient.
