# Tasks: responsive-orchestrator

Phased execution checklist. Each task ID maps to one IDEF0 activity
(A1..A5) or a cross-cut concern (X1..). Tasks marked `(beta)` must run
in the beta worktree per AGENTS.md beta-workflow rules.

---

## 1. Foundation — schema, finishes, tweaks knobs

- [x] 1.1 Extend `TERMINAL_FINISHES` in
  [packages/opencode/src/session/message-v2.ts](packages/opencode/src/session/message-v2.ts)
  with `rate_limited` and `quota_low` (per data-schema.json)
- [x] 1.2 Add `pendingSubagentNotices` field to session info shape and
  Storage write paths; backward-compatible (absent = empty array)
- [x] 1.3 Add three new `tweaks.cfg` knobs in
  [packages/opencode/src/config/tweaks.ts](packages/opencode/src/config/tweaks.ts):
  `subagent_escalation_wait_ms` (default 30000),
  `subagent_quota_low_red_line_percent` (default 5).
  Add unit-style sanity test that defaults match data-schema.json
- [x] 1.4 Add `PendingSubagentNotice` TypeScript type (source of truth in
  data-schema.json; mirror in code as `MessageV2.PendingSubagentNotice`)

## 2. Subagent self-awareness — rate-limit + quota-low exits (A2)

- [x] 2.1 In
  [packages/opencode/src/session/processor.ts](packages/opencode/src/session/processor.ts)
  child-session escalation branch (~line 1311): replace bare
  `await ModelUpdateSignal.wait(...)` with bounded
  `Promise.race([wait, timeout(subagent_escalation_wait_ms)])`
- [x] 2.2 On timeout: write `finish: "rate_limited"` to subagent's
  last-assistant message, populate errorDetail with original 429
  payload + resetsInSeconds, then `break` runloop
- [x] 2.3 Add `quotaLowExitRequested` flag to runloop state; set it in
  the post-turn quota check branch (~line 1246) when subagent + remaining
  ≤ red line
- [x] 2.4 At loop top: if flag set, inject system message
  ("wrap up: summarize what you've done, declare what's left, no
  further tool calls"), run ONE more turn, then write
  `finish: "quota_low"` with rotateHint payload and break
- [x] 2.5 Same pre-flight branch (~line 460): same timeout treatment;
  same disk-terminal write on timeout
- [x] 2.6 Verify `MAX_CUMULATIVE_ESCALATIONS=5` cap still enforced even
  with new timeout path (DD-10)

## 3. Async dispatch — task tool revert (A1, A3)

- [x] 3.1 In [packages/opencode/src/tool/task.ts](packages/opencode/src/tool/task.ts):
  allocate jobId at dispatch time (early in execute, before worker spawn)
- [ ] 3.2 Register worker in registry keyed by jobId (in addition to
  workerID); enables cancel_task lookup — DEFERRED to Phase 9 rollout
  (currently `ctx.callID` serves as jobId; no registry change yet)
- [ ] 3.3 Refactor `await Promise.race([run.done, watchdogCompletion])`
  block: extract into a `backgroundWatcher(jobId, parentSessionID, …)`
  function that runs detached — DEFERRED to Phase 9 (currently event is
  emitted from existing sync path as additive signal, not a detached watcher)
- [ ] 3.4 `execute()` returns `TaskDispatchedResult` stub immediately
  after worker spawn + watcher detach — DEFERRED to Phase 9 (still returns
  full result; the subscriber + addendum provide the async path as
  additive redundancy for now)
- [x] 3.5 In `backgroundWatcher`: on resolution (any of 4 outcomes),
  emit `task.completed` Bus event with full payload (jobId,
  parentSessionID, childSessionID, status, finish, elapsedMs, optional
  errorDetail/rotateHint/cancelReason)
- [x] 3.6 Watchdog A守門 fix verification: run unit test that simulates
  worker-evicted-after-EOF → watchdog A still fires from disk read
  (sanity check that 2026-04-23 fix still in place)

## 4. Notice delivery (A4)

- [x] 4.1 New file
  `packages/opencode/src/bus/events/task-completed.ts`: event schema
  using zod, mirrors data-schema.json#TaskCompletedEvent
- [x] 4.2 New file
  `packages/opencode/src/bus/subscribers/pending-notice-appender.ts`:
  subscribes to `task.completed`, looks up parent session info, appends
  PendingSubagentNotice to `pendingSubagentNotices`, writes back via
  Storage.update (atomic)
- [x] 4.3 Register subscriber in daemon bootstrap (alongside existing
  registerDebugWriter / registerTaskWorkerContinuationSubscriber calls
  in [packages/opencode/src/index.ts](packages/opencode/src/index.ts))
- [x] 4.4 Idempotency: if a notice with same jobId already exists,
  skip-or-replace per latest-wins; prevents double-injection on
  Bus replay
- [x] 4.5 If parent session does not exist (deleted while subagent
  ran), log structured error event + telemetry counter; do not throw

## 5. Prompt assembly — render notice into system prompt (A4)

- [x] 5.1 In session/system.ts (or equivalent prompt-assemble entry):
  read `pendingSubagentNotices` from session info
- [x] 5.2 For each notice, render a one-line addendum per the templates
  documented in design.md DD-3 / DD-3.1
- [x] 5.3 Append addendum to system prompt section (NOT to messages)
- [x] 5.4 After rendering, atomically remove consumed notices from the
  array (Storage.update with closure)
- [x] 5.5 Unit test: render two notices in one assemble; verify both
  appear in system prompt and both are removed from array

## 6. cancel_task tool (A5)

- [x] 6.1 New file `packages/opencode/src/tool/cancel-task.ts`: tool
  schema per data-schema.json#CancelTaskInput / #CancelTaskResult
- [x] 6.2 Implementation: lookup worker by jobId, send AbortSignal,
  return CancelTaskResult; do NOT wait for worker exit
- [x] 6.3 Worker abort handler writes `finish: "cancelled"` with
  cancelReason; existing watchdog A picks it up (no special-case)
- [x] 6.4 Register tool in tool registry; add to enablement.json
  template + runtime — registry done; enablement.json sync DEFERRED to Phase 10
- [x] 6.5 Test: cancel non-existent jobId → `not_found`; cancel
  already-finished jobId → `already_terminal`

## 7. system-manager MCP introspection tools (R7)

- [x] 7.1 New file
  `packages/mcp/system-manager/src/tools/list-subagents.ts`: input/output
  per data-schema.json#ListSubagentsInput / #ListSubagentsResult
- [x] 7.2 Implementation: read worker registry (active) + bounded
  ring-buffer of finished (size 50, evict FIFO); merge with parent
  session pendingSubagentNotices for richer "finished" entries
- [x] 7.3 New file
  `packages/mcp/system-manager/src/tools/read-subsession.ts`: input/output
  per data-schema.json#ReadSubsessionInput / #ReadSubsessionResult
- [x] 7.4 Implementation: extract existing `readNestedSessionMessages`
  helper at [system-manager/src/index.ts:121](packages/mcp/system-manager/src/index.ts#L121)
  into shared lib; new tool wraps it with sinceMessageID + limit
- [x] 7.5 Access boundary: respect existing per-user/per-project
  session access policy (same check as `manage_session`)
- [x] 7.6 Register both tools in system-manager server tools array
  (~line 305+); bump system-manager version
- [x] 7.7 Test: list returns expected shape; read returns messages;
  errors are structured (no throw)

## 8. Prompt updates

- [x] 8.1 Update `templates/prompts/SYSTEM.md`:
  - "task tool is async; dispatched ≠ completed"
  - "subagent results arrive as system-prompt addendum on next turn"
  - "use cancel_task to stop one subagent"
  - "use system-manager.list_subagents / read_subsession for status/content"
- [ ] 8.2 Mirror to `~/.config/opencode/prompts/SYSTEM.md` (runtime SSOT)
  — DEFERRED to Phase 10 (writing to user XDG from beta worktree would
  leak into main daemon prematurely; safe rollout copies template after
  fetch-back)
- [ ] 8.3 Audit `templates/prompts/agents/*.txt` for references to task
  tool semantics; update if behavior description is now wrong — NOT YET
  DONE; queued for Phase 9
- [ ] 8.4 Update enablement.json to include cancel_task + new MCP tools
  in default enablement set (template + runtime mirror) — NOT YET DONE;
  queued for Phase 9

## 9. Validation

- [ ] 9.1 Acceptance check A1 (responsiveness baseline) — manual
- [ ] 9.2 Acceptance check A2 (all five terminal finishes deliver) —
  scripted with one fixture per finish
- [ ] 9.3 Acceptance check A3 (4/9 regression test: stdout EOF + alive
  worker → still delivers within 10s)
- [ ] 9.4 Acceptance check A4 (cancel_task idempotency)
- [ ] 9.5 Acceptance check A5 (quota_low summary content quality)
- [ ] 9.6 Acceptance check A6 (multi-subagent parallel)
- [ ] 9.7 Acceptance check A7 (cumulative escalation cap honored)
- [ ] 9.8 Manual: dispatch one subagent, send 3 user messages while it
  runs, all 3 receive normal responses; subagent result later arrives
  in system addendum

## 10. Rollout

- [ ] 10.1 daemon restart_self via system-manager MCP
- [ ] 10.2 Smoke: verify default cisopro session can dispatch a
  testing subagent and main remains responsive
- [ ] 10.3 Update specs/architecture.md with the new task tool dispatch
  contract
- [ ] 10.4 Promote spec to verified after all A1..A7 pass
- [ ] 10.5 Promote spec to living after merge to main repo
