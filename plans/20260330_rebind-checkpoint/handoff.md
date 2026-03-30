# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding.
- Materialize tasks.md into runtime todos before coding.
- Preserve planner task naming in user-visible progress and runtime todo.

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State

- Background checkpoint save (`saveRebindCheckpoint`) is implemented but saves only `snapshot` and `timestamp` — missing `lastMessageId` boundary marker.
- `loadRebindCheckpoint` is implemented but returns only snapshot string — needs to return boundary marker.
- Rebind path in prompt.ts currently uses `compactWithSharedContext()` which inserts a summary message into the live chain — must be refactored to checkpoint-based input assembly.
- `shouldRebindBudgetCompact()` threshold trigger works (80K tokens, 4-round cooldown).
- No checkpoint cleanup implemented yet.

## Stop Gates In Force

- Stop if SharedContext snapshot is empty for sessions that should have one.
- Stop if rebind with checkpoint produces model errors.
- Stop if checkpoint file I/O introduces measurable latency.

## Build Entry Recommendation

- Start with Phase 1 (add lastMessageId to checkpoint) — smallest change, enables all subsequent work.
- Then Phase 2 (refactor rebind path) — the core behavioral change.
- Phase 3 (cleanup) and Phase 4 (validation) can follow.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
