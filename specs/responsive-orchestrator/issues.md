# Issues / Open Items — responsive-orchestrator

Tracked items related to this spec but NOT inside its execution scope.
Either deferred dependencies, related follow-up work, or symptoms
captured during this spec's design that need their own treatment.

## I-1 — Subagent stream reconnect / status bar hydration after page reload

- **Symptom**: After `Cmd-R` (or any SSE disconnect-reconnect), the
  child-session status bar showing active subagent runs disappears and
  never recovers, even though subagents are still running on the daemon.
  "看不到輸出但實際上有在做事" is a related but milder form of the
  same root issue.
- **Layer**: Frontend ↔ gateway ↔ daemon SSE bootstrap. Distinct from
  responsive-orchestrator (daemon-internal runloop).
- **Partial-fix history**: c32b9612b (2026-04-09) addressed
  "child sessions disappear on reload" for the session list, but left
  the active-subagent status bar uncovered.
- **Suspected paths**:
  - `/api/sessions` bootstrap may not include `activeChild` state
  - `SessionActiveChild.set/clear` events not replayed on SSE reconnect
  - Worker registry rebuild on daemon side does not snapshot to frontend
  - Status bar component mount strategy: query vs SSE-only
- **Repro #1**: Open a session with at least one running subagent →
  Cmd-R → status bar gone.
- **Repro #2 (added 2026-04-23)**: PC client has subagent running and
  status bar visible → connect a second client (e.g. mobile) to the
  same session → second client shows the timer counter (because that
  reads from session info's persisted `activeChild` timestamp) but
  does NOT show the status bar (which depends on live SSE event
  history that the new client missed). Stronger evidence that
  bootstrap response is missing an `activeChild` snapshot — the disk
  state is sufficient to reconstruct the timer but not the bar.
- **Probable seam**: bootstrap should include the daemon's current
  `SessionActiveChild` state (or worker-registry snapshot for that
  parent session); SSE replay alone cannot recover state older than
  60s/100-events default.
- **Disposition**: Will be picked up by a dedicated spec
  (suggested slug `subagent-stream-reconnect`). Captured here so it
  doesn't get lost while responsive-orchestrator is in flight.

## I-2 — Multi-subagent parallel hardening

- **Context**: responsive-orchestrator's async revert mechanically
  unblocks `lanes.maxConcurrent=2`, but the parallel path was never
  exercised in production while the await-rotor was in place.
  Shared-state bugs (worker registry concurrency, SharedContext merge
  ordering, double-injection of notices) may surface only under load.
- **Disposition**: Excluded from responsive-orchestrator's IN scope as
  a deliberate MVP-first decision. Treat as a follow-up extend mode
  if real-world use exposes issues.

## I-4 — Mobile UX collapses on large sessions (white-flash-reload per input)

- **Symptom**: On mobile, every user input triggers a white-flash that
  looks like a full SSE reconnect + session re-entry. Loaded chat
  shows only the tail; scroll-up can't retrieve earlier messages. Every
  further input repeats the cycle.
- **Evidence (2026-04-23)**:
  - ses_24bfd7326 = **286 MB** on disk
  - ses_245ce5ac = **51 MB**, 164 messages, **710 `bus.session.updated`
    events in 2 hours** (avg 1 every 10 s)
  - No daemon errors; Phase 9 async dispatch working normally
    (3 task.completed events fired cleanly in same window)
- **Probable root cause chain**:
  1. `bus.session.updated` pushes the **entire session info payload**
     to SSE subscribers on every state change
  2. Frontend treats an update as "refetch and remount" rather than
     patch-in-place
  3. Mobile's slower network + lower memory turn each refetch into a
     visible white-flash remount
  4. `sessionMessagesDefaultTail=30` + broken/absent upward pagination
     explains the "only tail loads, can't scroll up" part
- **Layer**: Frontend ↔ gateway ↔ SSE delivery + session-info store
  design. Distinct from I-1 (subagent status bar hydration) and I-2
  (multi-subagent parallel). Same family as I-1 (client-layer), but
  different mechanism — I-1 is about missing active-child snapshot;
  this is about overreaction to session-updated deltas.
- **Disposition**: Out of responsive-orchestrator scope. Candidate for
  a dedicated spec (slug suggestion `session-update-incremental` or
  roll into the broader `subagent-stream-reconnect` spec since both
  are client-layer bootstrap/sync issues).
- **Short-term mitigation for user**: start a new session; archive /
  split large old sessions before mobile use.

## I-3 — Provider-side prompt cache impact

- **Context**: Async dispatch may change the prompt prefix shape across
  turns. If the prefix becomes less stable, provider prompt cache hit
  rate could drop, increasing token cost.
- **Disposition**: Measure during verified-state validation; if material,
  open follow-up spec for prompt-prefix optimization.
