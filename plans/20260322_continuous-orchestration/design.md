# Design

## Context

- Dispatch-first continuous orchestration removed the parent-side blocking wait, but current UI/control semantics still equate "foreground stream ended" with "session no longer actively running".
- Existing transcript-local `SubagentActivityCard` proves child-session metadata and live tool activity already flow to the frontend, but that surface is not sufficient as a global operator control plane.
- Current architecture already documents sequential single-subagent policy and child-session visibility, so this slice should extend those existing boundaries rather than add a second orchestration model.
- Existing thinking/elapsed bottom-status rendering patterns already exist in the session UI stack; the preferred first slice is to extend that family rather than invent a brand-new pinned bar implementation.

## Goals / Non-Goals

**Goals:**

- Keep one authoritative active-subagent state per parent session.
- Keep stop control mounted while a child is active.
- Expose the active child through a session-global pinned status surface in both Web and TUI.
- Preserve non-blocking parent/user interaction without allowing a second child dispatch.

**Non-Goals:**

- Multiple simultaneous background children.
- Rewriting all session stop semantics across unrelated flows.
- Full transcript/navigation redesign.

## Decisions

- Treat "background child active" as a first-class session control state distinct from foreground streaming state.
- Keep the runtime invariant at one child per parent session; UI and stop controls may depend on this and must not silently handle >1 child.
- Interpret stop as a staged escalation: first press stops foreground Orchestrator activity, second press terminates the active child.
- Keep child progress/title sourcing evidence-first: derive from authoritative task metadata and child-session message/tool stream, not from guessed summaries.
- Web child entry uses a route URL; TUI child entry uses session-tree jump behavior from the same child-session identity.
- Prefer rendering the active-child surface through the same visual/status family as the legacy thinking bar, with subagent-specific state layered on top.

## Data / State / Control Flow

- `task()` dispatch establishes child-session metadata and active-child linkage on the parent session.
- Child-session stdout bridge and bus events continue publishing live activity.
- A session-level projector/reducer derives one active-subagent status model: child session id, title, agent type, latest step/progress, and kill eligibility.
- Foreground stop checks whether a parent stream is active; if yes, it interrupts foreground execution but does not clear active-child linkage.
- A second stop while the same child remains active escalates to child termination and clears state only from authoritative runtime completion/removal evidence.
- On child completion/failure, parent continuation is injected as today; the active status surface remains through the handoff and disappears only once the runtime clears the active-child state and/or parent takeover evidence is emitted.

## Risks / Trade-offs

- Stop-state ambiguity between foreground-run and child-run could cause accidental child termination -> mitigate with explicit staged stop state and targeted tests.
- Progress text may lag or be absent if child evidence is sparse -> mitigate by defining a strict evidence ladder and showing explicit degraded state instead of fabrication.
- Web/TUI divergence may emerge if they derive active-child status independently -> mitigate by driving both from the same backend/sync truth shape.
- Parent/user interaction while child runs may create UI confusion about which actor is "current" -> mitigate with pinned status bar plus child-session entry affordance.
- Reusing the existing thinking/status family may constrain layout freedom -> accepted trade-off because UI continuity and lower implementation blast radius are more important for the first slice.

## Critical Files

- `/home/pkcs12/projects/opencode/packages/opencode/src/tool/task.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/bus/subscribers/task-worker-continuation.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/components/message-tool-invocation.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/`
