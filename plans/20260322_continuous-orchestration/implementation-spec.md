# Implementation Spec

## Goal

- Restore continuous orchestration control surfaces so a running background subagent keeps the session in a controllable active state, exposes live status in Web and TUI, and only clears that state after the Orchestrator resumes from the subagent result.

## Scope

### IN

- Keep a visible stop control while exactly one background subagent is active.
- Add a bottom-pinned subagent status surface in Web and TUI showing agent identity, task title, current step/progress text, and a child-session entry point.
- Define dual stop semantics: first stop interrupts foreground Orchestrator streaming; second stop escalates to kill the active background subagent.
- Keep parent Orchestrator resumable after subagent completion and remove the pinned status surface only when the resumed parent stream has actually taken over.
- Preserve the current policy that the Orchestrator may continue user conversation and non-task tool calls while a background subagent is running, but may not dispatch a second subagent.

### OUT

- Parallel subagent execution.
- General-purpose multi-job supervisor redesign.
- Replacing current child-session activity cards with a wholly new transcript UI.
- Cross-process transport redesign or URL routing redesign.

## Assumptions

- Current runtime already emits enough child-session metadata for UI linkage via `task()` tool metadata and bridged events, but the stop/control state and pinned-status aggregation are incomplete.
- The active-policy invariant remains one active subagent per parent Orchestrator session.
- Web can use a route URL for child-session entry, while TUI must use its own session-tree jump mechanism rather than URL rendering.
- The stop-control semantics can be implemented without adding fallback behavior: missing active-subagent evidence must fail fast and leave operator-visible diagnostics.
- The preferred presentation strategy is to extend the existing thinking/elapsed bottom-status pattern instead of building a separate bar from scratch.

## Stop Gates

- Stop if current runtime cannot distinguish foreground-Orchestrator streaming from background-subagent-active state with request-level evidence.
- Stop if implementing the double-stop contract requires a second concurrent kill path that races with existing session stop semantics.
- Stop if TUI session-tree navigation lacks a stable child-session jump API and requires a broader navigation redesign.
- Stop if the pinned status bar would need to guess progress text without authoritative subagent message/tool evidence.
- Stop and re-enter planning if the work expands into parallel subagent orchestration or a general session-job manager.

## Critical Files

- `/home/pkcs12/projects/opencode/packages/opencode/src/tool/task.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/bus/subscribers/task-worker-continuation.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/workflow-runner.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/components/message-tool-invocation.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/`
- `/home/pkcs12/projects/opencode/packages/app/src/context/`
- `/home/pkcs12/projects/opencode/specs/architecture.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260322_continuous_orchestration.md`

## Structured Execution Phases

- Phase 1: Trace current foreground stop state, background subagent activity evidence, and child-session navigation surfaces across Web and TUI.
- Phase 2: Add runtime/session control-state authority for "background subagent active" and implement the dual stop contract without allowing a second subagent dispatch.
- Phase 3: Extend the existing Web and TUI thinking/elapsed bottom-status surfaces into active-subagent surfaces and wire child-session entry actions using authoritative evidence.
- Phase 4: Validate foreground stop behavior, subagent kill escalation, Orchestrator resume takeover, and document the final control-flow contract.

## Validation

- Run targeted tests for `task()` dispatch/continuation and any stop-control state touched by the change.
- Add or update Web/TUI tests for pinned status visibility, active-subagent rendering, and hide-on-parent-resume behavior where practical.
- Verify manually or with runtime evidence that:
  - first stop interrupts foreground Orchestrator streaming but leaves the active subagent running;
  - second stop kills the active subagent;
  - while a subagent runs, the stop button stays visible and a bottom status bar remains mounted;
  - the status bar disappears only after parent continuation starts streaming again or the background subagent is explicitly killed/failed.
- Verify that user conversation and non-task tool calls remain available during background subagent execution, but `task()` dispatch of a second subagent still fails fast.

## Handoff

- Build agent must read this spec first.
- Build agent must read `proposal.md`, `spec.md`, `design.md`, `tasks.md`, and `handoff.md` before coding.
- Build agent must materialize runtime todo from unchecked `tasks.md` items and preserve the same task naming in progress reporting.
- Build agent must preserve fail-fast behavior when active-subagent identity, progress evidence, or child-session navigation evidence is missing.
- Build agent must update `tasks.md`, `docs/events/event_20260322_continuous_orchestration.md`, and `specs/architecture.md` as each execution slice lands.
