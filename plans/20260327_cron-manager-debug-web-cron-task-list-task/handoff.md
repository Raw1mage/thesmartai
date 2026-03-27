# Handoff

## Execution Contract
- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding
- Preserve planner task naming in user-visible progress and runtime todo
- Prefer delegation-first execution when a task slice can be safely handed off
- Treat child sessions as read-only observation/stop surfaces, not conversational sessions

## Required Reads
- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State
- Root-cause work already established that stale child-session/running projection exists and that runtime single-child gate is real.
- Session monitor running-projection fix has already landed separately; this slice focuses on the child-session product contract and operator controls.
- User decisions are locked: child session should show a read-only placeholder and should expose a visible kill switch while running.

## Stop Gates In Force
- Preserve approval, decision, and blocker gates from implementation-spec.md
- Return to planning if a new implementation slice is not represented in planner artifacts
- Stop if child-session stop action cannot safely resolve parentSessionID using existing session metadata/API contract

## Build Entry Recommendation
- Start with `session-prompt-dock.tsx` and the session page state plumbing needed to detect child sessions and authoritative running-child state.
- Then add the kill-switch action path and targeted validation for stop/state convergence.

## Execution-Ready Checklist
- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md