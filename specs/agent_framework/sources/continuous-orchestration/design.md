# Design: Continuous Orchestration

## Context

- `packages/opencode/src/tool/task.ts` now dispatches child work without waiting for completion, and completion continues through event-backed parent resumption.
- The repo also now carries session-global active-child state plus Web/TUI control surfaces so operators can observe and enter the running child session while the parent remains available.
- The remaining design focus is to keep these orchestration and observability paths fail-fast, single-child, and explicitly recover stale `running` state after restart/worker loss.

## Goals / Non-Goals

**Goals:**
- Make `task()` dispatch non-blocking for the parent Orchestrator turn.
- Resume parent sessions from event-backed completion evidence.
- Keep the first implementation slice sequential and observable.
- Minimize blast radius by reusing existing bus/session/run-queue primitives.

**Non-Goals:**
- Multi-subagent parallelism.
- Replacing the existing worker bridge transport.
- Adding hidden rescue paths that preserve the old blocking semantics.

## Decisions

- Split orchestration into dispatch-time responsibility (`tool/task.ts`) and completion-time responsibility (bus subscriber / session continuation path).
- Treat task-completion events as authoritative continuation triggers; the tool itself must not await worker completion.
- Preserve `RunQueue.enqueue()` as the only parent-session resume mechanism.
- Use synthetic parent-session messages as the handoff boundary between background completion and resumed Orchestrator reasoning.
- Maintain one authoritative active-child state per parent session and fail fast on second-child dispatch.
- Recover only stale `running` children when dispatch-time worker evidence is missing; keep `handoff` conservative and blocking.
- Expose active-child status in both Web and TUI through compact single-line status surfaces with platform-native child-entry affordances.

## Data / State / Control Flow

- Orchestrator calls `task()` -> runtime creates child session / worker -> tool returns immediate dispatch metadata.
- Dispatch records authoritative `active_child` state for the parent session.
- Worker progress continues through existing stdout bridge -> bus events remain visible to monitors/UI.
- Web and TUI subscribe to active-child updates and render compact single-line status surfaces until parent takeover / child clear evidence arrives.
- Worker completion or failure publishes an authoritative completion event.
- Completion subscriber resolves parent-session identity -> writes a synthetic continuation message -> enqueues parent on `RunQueue`.
- Parent takeover / cleanup clears `active_child`; if a later dispatch finds a `running` child without matching worker evidence, dispatch-time stale recovery clears it before enforcing the single-child guard.
- Resumed Orchestrator consumes the synthetic message and decides the next execution step.

## Risks / Trade-offs

- Process-local `active_child` state can become stale across restart/worker loss -> mitigation is dispatch-time liveness checking and explicit stale-running recovery only.
- Immediate return can expose race conditions in UI/monitor assumptions -> mitigate with targeted validation on status surfaces.
- Prompt/docs may drift from runtime semantics -> mitigate by updating prompt contract and semantic spec in the same implementation wave.
- Removing blocking semantics may reveal hidden callers depending on old timing -> mitigate with code search and explicit validation.

## Critical Files

- `/home/pkcs12/projects/opencode/packages/opencode/src/tool/task.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/bus/subscribers/`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/index.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/queue.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/component/prompt/`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx`

## Supporting Docs (Optional)

- `/home/pkcs12/projects/opencode/docs/events/event_20260322_continuous_orchestration.md`
- `/home/pkcs12/projects/opencode/specs/architecture.md`
