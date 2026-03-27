# Design

## Context

- Web currently allows operators to open child sessions spawned by `task()` and inspect their transcript/tool activity.
- `packages/app/src/pages/session/session-prompt-dock.tsx` renders `PromptInput` whenever the session is not blocked, without distinguishing parent vs child session.
- `packages/opencode/src/tool/task.ts` already exposes authoritative active-child state and a reusable `terminateActiveChild(parentSessionID)` runtime control path.
- Recent debugging established that stale running projections can make child sessions appear active after completion, so any child-page control must bind to authoritative active-child state rather than transcript activity alone.

## Goals / Non-Goals

**Goals:**
- Enforce a read-only conversation contract for child sessions
- Make child running state operator-visible even during silent execution
- Reuse existing active-child termination infrastructure for kill control
- Keep child page, status bar, and session list aligned to the same authority

**Non-Goals:**
- Re-architect subagent lifecycle or worker transport
- Support manual chatting inside child sessions
- Introduce secondary fallback state sources for running detection

## Decisions

- Treat `session.parentID != null` as the session-level signal that the current page is a child/subsession and therefore cannot render a submit-capable prompt composer.
- Preserve spatial continuity by showing a read-only placeholder in the prompt dock instead of fully removing the dock area.
- Drive child-session kill switch visibility from authoritative active-child state, not from streamed text presence.
- Reuse existing `terminateActiveChild(parentSessionID)` behavior through a dedicated UI/API entrypoint instead of inventing a new worker-control mechanism.
- Keep running-state authority consistent with the recent session monitor fix: if a child is no longer the authoritative active child, it should not keep displaying running controls.

## Data / State / Control Flow

- Session route resolves the opened session and whether it has `parentID`.
- Prompt dock receives child-session context and, if child, renders read-only placeholder instead of `PromptInput`.
- Global sync store already ingests `session.active-child.updated`; the child page should consume parent-linked active-child state to determine whether the opened child is the currently running child.
- Kill switch click routes to a session-scoped stop action that maps child session -> parent session -> `terminateActiveChild(parentSessionID)`.
- Successful stop updates active-child state; child page, status bar, and session list all re-render from the same authority.

## Risks / Trade-offs

- Child session may know only its own sessionID, not parent sessionID -> mitigation: use existing session metadata / API surface rather than inferring from transcript.
- Hiding the real input while preserving a dock placeholder may confuse operators if copy is weak -> mitigation: explicit wording that subagent sessions are read-only observation surfaces.
- Kill switch without confirmation favors speed over protection -> accepted because the user explicitly requested a visible kill switch and subagent stop is an operational control, not destructive repository mutation.

## Critical Files

- packages/app/src/pages/session/session-prompt-dock.tsx
- packages/app/src/pages/session/**
- packages/app/src/context/global-sync/event-reducer.ts
- packages/opencode/src/tool/task.ts
- packages/opencode/src/server/routes/session.ts
- packages/opencode/src/session/monitor.ts