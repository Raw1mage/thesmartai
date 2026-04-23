# Spec: responsive-orchestrator

## Purpose

Restore main agent (orchestrator) responsiveness during subagent execution
by converting the `task` tool from synchronous-await to asynchronous
fire-and-forget dispatch. Subagent completions surface to the
orchestrator via wake-only notices (no chat-log injection), so the
user's conversation surface stays a clean human↔assistant exchange.
Subagents gain self-awareness of their own quota and rate-limit state,
exiting gracefully with useful payloads instead of hanging or failing
hard.

---

## Requirements

### Requirement: Async dispatch — main turn never blocks on subagent (R1)

#### Scenario: Single subagent dispatch

- **GIVEN** main agent's current turn emits a `task` tool call
- **WHEN** the task tool runtime accepts the dispatch
- **THEN** the tool returns within 200ms with a stub result
  `{ status: "dispatched", jobId, childSessionID }`
- **AND** the main assistant turn proceeds to its next reasoning step or
  natural completion without awaiting subagent
- **AND** the session's `busy` flag clears as soon as the turn ends

#### Scenario: User talks to main agent during subagent run

- **GIVEN** a subagent is currently running (dispatched but not yet completed)
- **WHEN** the user submits a new message to the parent session
- **THEN** main agent receives the message in a normal new turn
- **AND** main agent can respond, including by calling other tools
- **AND** the running subagent is unaffected by the new turn

#### Scenario: Multi-subagent parallel dispatch

- **GIVEN** main agent emits two `task` tool calls in one turn
- **WHEN** both dispatches succeed
- **THEN** both subagents run in parallel up to `lanes.maxConcurrent`
- **AND** each gets its own `jobId` and `childSessionID`
- **AND** their results arrive independently as separate
  `PendingSubagentNotice` entries (one per subagent)

---

### Requirement: Result delivery via wake-only notice (R2)

#### Scenario: Subagent finishes successfully

- **GIVEN** a subagent's runloop writes `finish: "stop"` to its session
- **WHEN** parent's task watchdog detects the disk-terminal finish
- **THEN** within `DISK_GRACE_MS + WATCHDOG_INTERVAL_MS` (≤ 10s), the
  subscriber appends a `PendingSubagentNotice` entry to parent session
  `info.json#pendingSubagentNotices`
- **AND** the entry contains only minimal metadata: `jobId`,
  `childSessionID`, `status`, `finish`, `elapsedMs`, `at`
- **AND** parent session's runloop wakes up; on the next prompt assemble,
  the assembler renders the notice as a one-line system-prompt addendum
  and removes it from the array
- **AND** no message is appended to the parent session's `messages/`
  directory; the user's chat view is unchanged

#### Scenario: Main agent reads child session for full content

- **GIVEN** main agent's next turn sees a `PendingSubagentNotice`
- **WHEN** main agent decides it needs the actual subagent output
- **THEN** main agent invokes existing read tools (e.g. `read_session`
  / `read_message`) against the `childSessionID` from the notice
- **AND** receives subagent's full session content via normal tool flow

#### Scenario: Subagent silently dies (process crash)

- **GIVEN** subagent process exits with non-zero exitCode without
  writing terminal finish
- **WHEN** parent's task watchdog B detects `proc.exitCode !== null`
- **THEN** within ≤ 10s, a `PendingSubagentNotice` with
  `status: "worker_dead", finish: "worker_exited"` is appended
- **AND** main agent sees the notice and decides recovery (read child
  session for partial output, redispatch, or report to user)

#### Scenario: Notice consumed exactly once

- **GIVEN** a notice has been rendered into one prompt assemble
- **THEN** the notice is removed from `pendingSubagentNotices` before
  the next turn
- **AND** the same notice does NOT appear in subsequent turns

---

### Requirement: Subagent rate-limit reactive exit (R3)

#### Scenario: Subagent hits 429 with no parent rotation help

- **GIVEN** a subagent receives `usage_limit_reached` 429 from its provider
- **AND** subagent escalates via `RateLimitEscalationEvent`
- **WHEN** `subagent_escalation_wait_ms` (default 30000) elapses without
  parent pushing a new model via `ModelUpdateSignal`
- **THEN** subagent writes `finish: "rate_limited"` to disk
- **AND** subagent's worker process exits cleanly within 5 seconds
- **AND** parent receives a `PendingSubagentNotice` with
  `status: "rate_limited"`, `errorDetail` containing the original 429
  message and `resetsInSeconds` if available

#### Scenario: Parent successfully rotates within timeout

- **GIVEN** subagent escalates 429
- **WHEN** parent pushes a new model via `ModelUpdateSignal.set` within
  `subagent_escalation_wait_ms`
- **THEN** subagent applies the new model and retries the LLM call
- **AND** no `PendingSubagentNotice` is yet appended (subagent continues working)

---

### Requirement: cancel_task tool (R4)

#### Scenario: Main agent cancels one subagent

- **GIVEN** subagent X is running with `jobId = J`
- **WHEN** main agent calls `cancel_task({ jobId: J, reason: "user changed mind" })`
- **THEN** the tool returns within 1s with `{ status: "cancelled" }`
- **AND** subagent X's worker receives an abort signal
- **AND** subagent X writes `finish: "cancelled"` to disk and exits
- **AND** parent receives a `PendingSubagentNotice` with `status: "cancelled"` for jobId J
- **AND** main agent's own session is NOT terminated; other subagents
  unaffected

#### Scenario: cancel_task on unknown jobId

- **GIVEN** no subagent currently holds `jobId = X`
- **WHEN** main agent calls `cancel_task({ jobId: X })`
- **THEN** the tool returns `{ status: "not_found" }`
- **AND** no error event is emitted

---

### Requirement: No regression — parent always learns of completion (R5)

#### Scenario: IPC pipe severed mid-flight

- **GIVEN** subagent worker is running normally
- **WHEN** stdout pipe between worker and daemon is severed (EOF early)
  while subagent process is still alive
- **THEN** parent's task watchdog A continues polling disk regardless
  of worker registry membership (守門 fix from 2026-04-23)
- **AND** when subagent eventually writes terminal finish, parent
  detects it within `DISK_GRACE_MS + WATCHDOG_INTERVAL_MS`
- **AND** a `PendingSubagentNotice` is appended, completing the cycle

#### Scenario: Subagent hangs forever (worst case)

- **GIVEN** subagent is alive but not progressing (e.g. stuck in
  unrecoverable LLM provider hang)
- **WHEN** watchdog C silence threshold (60s) is reached
- **THEN** watchdog kills worker, writes synthesized terminal finish
  for parent's reading
- **AND** parent receives a `PendingSubagentNotice` with `status: "silent_kill"`
- **AND** main agent decides recovery (the orchestrator never blocks)

---

### Requirement: system-manager MCP introspection tools (R7)

#### Scenario: list_subagents — query all running subagents in current session

- **GIVEN** main agent's session has 2 active subagents and 1 recently
  finished subagent
- **WHEN** main agent calls `system-manager.list_subagents({ parentSessionID: <self> })`
- **THEN** the tool returns an array containing 3 entries
- **AND** each entry has at minimum: `jobId`, `childSessionID`,
  `status` (`running` | `finished`), `finish` (if finished),
  `dispatchedAt`, `lastActivityAt`, `elapsedMs`
- **AND** the result reflects current state, not stale snapshot

#### Scenario: list_subagents — global query (admin / debugging)

- **GIVEN** caller omits `parentSessionID`
- **WHEN** the tool is invoked
- **THEN** all subagents across all sessions are returned
- **AND** each entry includes `parentSessionID` so caller can group

#### Scenario: read_subsession — fetch child session messages

- **GIVEN** main agent has a `PendingSubagentNotice` containing
  `childSessionID = ses_xyz`
- **WHEN** main agent calls `system-manager.read_subsession({ sessionID: "ses_xyz" })`
- **THEN** the tool returns the child session's messages array (info +
  parts) in chronological order
- **AND** the response shape conforms to existing MessageV2 wire format
- **AND** main agent can pass `sinceMessageID` to fetch only messages
  after a known cursor (incremental read)

#### Scenario: read_subsession — unknown session

- **GIVEN** caller passes a sessionID that does not exist
- **WHEN** the tool is invoked
- **THEN** it returns `{ error: "session_not_found", sessionID }`
- **AND** does not throw (consistent with other system-manager tools)

#### Scenario: read_subsession respects access boundary

- **GIVEN** caller passes a sessionID that belongs to a different
  user / project
- **THEN** the tool returns `{ error: "session_not_accessible" }` and
  does not leak content

---

### Requirement: Subagent proactive quota-low wrap-up (R6)

#### Scenario: Quota crosses red line between LLM turns

- **GIVEN** subagent is mid-execution; its account just successfully
  completed a turn
- **AND** post-turn quota check shows remaining ≤
  `subagent_quota_low_red_line_percent` (default 5%)
- **WHEN** the subagent's runloop reaches the next turn boundary
- **THEN** subagent does NOT start the next LLM call
- **AND** subagent injects a system message into its own context
  instructing "wrap up: summarize what you've done, declare what's left,
  no further tool calls"
- **AND** subagent runs ONE final assistant turn to produce the summary
- **AND** subagent writes `finish: "quota_low"` to disk; the wrap-up
  summary is the last assistant message in subagent's own session
- **AND** worker exits cleanly
- **AND** parent receives a `PendingSubagentNotice` with
  `status: "quota_low"` AND a populated `rotateHint` field carrying
  `exhaustedAccountId`, `remainingPercent`, and
  `directive: "rotate-before-redispatch"`
- **AND** the next prompt assemble renders the notice as a system-prompt
  addendum that explicitly tells main agent: account X is nearly
  exhausted, switch accounts before any further dispatch, read child
  session for the wrap-up summary

#### Scenario: Quota healthy throughout

- **GIVEN** subagent's quota stays above red line for entire run
- **THEN** Requirement 6 path is never triggered
- **AND** subagent completes normally per Requirement 2

#### Scenario: Quota check disabled

- **GIVEN** `subagent_quota_low_red_line_percent` is set to 0
- **THEN** Requirement 6 path is disabled; subagent only reacts to
  hard 429 per Requirement 3

---

## Acceptance Checks

A1. **Responsiveness baseline**: With one subagent dispatched and
    actively running, sending a message to parent session triggers main
    agent's response within normal latency (not blocked on subagent).

A2. **Disk-terminal delivery**: All five `TERMINAL_FINISHES`
    (`stop`, `error`, `cancelled`, `rate_limited`, `quota_low`) result
    in synthetic message injection within ≤ 10s of disk write.

A3. **No 4/9 regression**: Cause stdout EOF in test harness while
    subagent process remains alive; verify parent still receives
    completion via watchdog A and synthetic message arrives.

A4. **cancel_task idempotency**: Calling cancel twice on the same jobId
    succeeds first time, returns `not_found` second time; no double
    delivery of `PendingSubagentNotice`.

A5. **Quota wrap-up content quality**: Force quota_low trigger;
    verify final assistant message contains substantive summary
    (not empty, not error text, mentions actual work done).

A6. **Multi-subagent parallel**: Dispatch 2 subagents simultaneously;
    both complete; both produce distinct `PendingSubagentNotice` entries (one per subagent)
    with correct `jobId` and `childSessionID`.

A7. **Cumulative escalation cap honored**: Even with timeout removed,
    `MAX_CUMULATIVE_ESCALATIONS = 5` still hard-limits retry attempts
    in case parent provides bad rotations.
