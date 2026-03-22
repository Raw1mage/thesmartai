# Proposal

## Why

- Continuous orchestration removed the old blocking wait, but it also removed the operator feeling that the session is still "actively running" while a subagent works in the background.
- That regression breaks operator control: the stop button disappears too early, there is no pinned global status surface, and the child session is only discoverable indirectly from transcript cards.
- The product now needs a control-plane contract where background subagent execution remains visible and interruptible without reintroducing blocking orchestration.

## Original Requirement Wording (Baseline)

- "目前的Orchestrator行為被改成，委派 subagent去工作後，沒有進入『啟動停止鈕等待被按停止』的狀態。"
- "背景有subagent未完成工作的時候，『停止鈕』不可以消失，用來做為subagent的kill switch。"
- "背景有subagent在進行工作的時候，對話串流要有一個置底subagent status bar。"
- "subagent工作完成後，Orchestrator會接手繼續對話串流。這時候才可以讓置底的subagent status bar消失。"
- "Orchestrator本身允許持續與使用者對話、並在不委派更多subagent的前提下調用各種tool call。"

## Requirement Revision History

- 2026-03-22: Existing continuous-orchestration workstream established dispatch-first + event-driven parent continuation.
- 2026-03-22: New regression report reframed the work from pure dispatch semantics into a control-surface bugfix and operator UX completion slice.
- 2026-03-22: User required first implementation scope to cover both Web and TUI, not Web-only.
- 2026-03-22: User clarified stop semantics as a two-step contract: first press stops foreground Orchestrator streaming; second consecutive press also stops the active background subagent.
- 2026-03-22: User clarified that TUI child-session entry must use TUI-native session-tree jumping rather than URL rendering.
- 2026-03-22: User clarified that the first implementation should preferentially reuse the legacy bottom "thinking" / elapsed status-bar pattern instead of introducing a brand-new status-bar family.

## Effective Requirement Description

1. Keep continuous orchestration non-blocking, but restore a visible active-run control state whenever one subagent is running in the background.
2. Preserve a visible stop button during background subagent work and bind it to a double-stop contract.
3. Add a pinned bottom subagent status bar in both Web and TUI that exposes identity, title, progress, and child-session entry.
4. Only clear the pinned status surface after the parent Orchestrator continuation actually takes over, or after the background subagent is explicitly terminated.
5. Preserve the current policy that the Orchestrator may continue user interaction and non-task tool calls while prohibiting a second subagent dispatch.

## Scope

### IN

- Runtime/session-state authority for one active background subagent.
- Foreground-stop versus child-kill stop semantics.
- Web pinned status bar and child-session route entry.
- TUI pinned status surface and session-tree jump integration.
- Documentation and tests for the new control-surface contract.

### OUT

- More than one active subagent.
- Generic job dashboard or background-task tray.
- Replacing transcript-level `SubagentActivityCard`.
- Cross-feature redesign of all session stop behaviors unrelated to subagent background execution.

## Non-Goals

- Converting background subagent work into a detached daemon/job product.
- Allowing the Orchestrator to queue a second subagent while the first is still running.
- Adding silent fallback progress text when the child session provides no trustworthy progress evidence.

## Constraints

- No silent fallback mechanisms may be introduced.
- Sequential single-subagent policy remains authoritative.
- Web and TUI must share the same backend truth for active-subagent state while keeping presentation-specific entry mechanisms.
- The stop control must remain interpretable to operators; a hidden or ambiguous second-stop contract is not acceptable.
- The first implementation should be reuse-first: extend the existing thinking/elapsed bottom-status pattern before considering a new dedicated status-bar implementation.

## What Changes

- Extend continuous orchestration from "dispatch-first" into "dispatch-first but still operator-controlled while child work is live".
- Add an explicit active-background-subagent control state that keeps stop UI mounted and feeds a bottom status bar.
- Split stop behavior into first-stop foreground interruption and second-stop child kill escalation.
- Add navigation affordances from the status bar into the child session for both Web and TUI.

## Capabilities

### New Capabilities

- Background subagent control state: the parent session remains visibly controllable while child work is active.
- Pinned subagent status surface: operators can see what child is running, what it is doing, and where to jump.
- Double-stop semantics: one action interrupts parent stream, a second escalates to terminate child work.

### Modified Capabilities

- Session stop control: no longer disappears merely because the parent Orchestrator returned from `task()` dispatch.
- Continuous orchestration UI: running-child state is promoted from transcript-local detail to a session-global pinned status surface.
- Continuous orchestration UI: the pinned active-child surface should preferably reuse the existing thinking/elapsed status-bar pattern rather than introducing a visually unrelated widget.
- TUI navigation: child-session access must align with session-tree navigation rather than web-style URLs.

## Impact

- Backend/session impact: active-subagent state, stop semantics, and continuation cleanup behavior.
- Web impact: session page needs a persistent bottom status surface and child-session link behavior.
- TUI impact: sync/store and navigation surfaces must expose active child state and a session-tree jump action.
- Documentation impact: event log, architecture doc, and active plan artifacts must describe the operator-control contract.
