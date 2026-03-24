# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding
- Preserve planner task naming in user-visible progress and runtime todo
- Prefer delegation-first execution when a task slice can be safely handed off

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State

- Survey phase completed: reusable Google Calendar bases were compared and `nspady/google-calendar-mcp` was selected as the primary reference shape.
- Planning phase has now pivoted the effort from a one-off Google Calendar feature into a broader app market + managed MCP app architecture.
- Diagram set and execution contract are aligned to the current managed app registry + Google Calendar MVP plan state.
- Build work has not started yet.

## Stop Gates In Force

- Stop if app market cannot be expressed within current runtime/tool ownership boundaries.
- Stop if Google Calendar auth must bypass canonical auth/account authority.
- Stop if implementation needs remote marketplace/security decisions that are not covered by this plan.
- Stop if any install/config/auth/runtime path requires silent fallback to another app, provider, account, or external MCP wiring.
- Stop if Web/TUI cannot present authoritative lifecycle state from a single backend registry authority.

## Build Entry Recommendation

- Recommended build entry: start with Task 1.1 and treat the managed app registry as the first implementation authority.
- Execution order: 1.1 -> 1.2 -> 1.3 -> 2.1 -> 2.2 -> 2.3 -> 3.1 -> 3.2 -> 3.3.
- Do not start Google Calendar-specific runtime wiring until registry persistence, lifecycle states, and operator-visible authority are established.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md

## Completion Gates

- Do not mark the build slice done until install/config/auth/runtime lifecycle behavior matches the diagram artifacts and tasks ordering.
- Do not mark the build slice done until fail-fast/no-fallback behavior is verified for unauthenticated, misconfigured, disabled, and runtime-error states.
- Do not mark the build slice done until Web/TUI surfaces show authoritative managed app state from the single backend registry authority.

## Documentation Sync Gate

- Before closing implementation, update `docs/events/event_20260324_google-calendar-agent-survey.md` with the final managed app registry boundary, install lifecycle behavior, auth/config/runtime states, Web/TUI operator surfaces, fail-fast error evidence, and beta-worktree execution notes when applicable.
- Before closing implementation, update `specs/architecture.md` with the durable architecture deltas for managed app registry authority, Google Calendar managed app ownership boundaries, lifecycle state machine, and operator-visible state/observability contract.
- Do not mark the build slice complete until doc sync verification confirms both updates exist and match shipped behavior.
