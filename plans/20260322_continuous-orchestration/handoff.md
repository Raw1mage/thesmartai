# Handoff

## Execution Contract

- Build agent must read `implementation-spec.md` first.
- Build agent must read `proposal.md`, `spec.md`, `design.md`, and `tasks.md` before coding.
- Materialize unchecked `tasks.md` items into runtime todos before coding.
- Preserve planner task naming in progress reporting and event log updates.
- Keep fail-fast behavior whenever active-child identity, progress evidence, or child-session entry evidence is missing.

## Required Reads

- `implementation-spec.md`
- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`
- `/home/pkcs12/projects/opencode/specs/architecture.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260322_continuous_orchestration.md`

## Current State

- Existing active plan root contained placeholders and has now been repurposed for a real control-surface bugfix plan.
- The immediate problem is no longer "make `task()` non-blocking" but "restore operator control and active-run visibility while keeping dispatch-first semantics".
- Scope is explicitly Web + TUI in the same implementation wave.
- Stop semantics are user-defined: one stop interrupts foreground Orchestrator activity; a second stop kills the active child.
- Preferred UI strategy is reuse-first: extend the legacy bottom thinking/elapsed status surface before introducing any new pinned-bar family.

## Stop Gates In Force

- Stop if runtime evidence cannot prove which child is active for the current parent session.
- Stop if TUI child jump requires broader session-navigation redesign.
- Stop if implementation tries to introduce guessed progress text or guessed child navigation targets.
- Stop and return to planning if the work expands into multi-subagent orchestration.

## Build Entry Recommendation

- Start with Task Group 1 to lock the evidence model for active-child state, stop-stage state, and Web/TUI child entry before editing any controls.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in `tasks.md`
