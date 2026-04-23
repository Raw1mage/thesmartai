# Proposal: responsive-orchestrator

## Why

Main agent (orchestrator) currently locks up the entire user-facing session
whenever any dispatched subagent fails to terminate cleanly. The user cannot
chat with main agent, cannot redirect, cannot cancel just the misbehaving
subagent — the only escape is the global Stop button which kills the whole
turn. This violates the orchestrator's defining responsibility: it should
always be responsive to the user, regardless of what its workers are doing.

The lock-up is not a bug in subagent code paths. It is a structural
consequence of `task` tool being awaited synchronously by the main runloop
since commit `c32b9612b` (2026-04-09). Before that commit, `task` was
fire-and-forget: dispatch returned immediately, subagent result came back
through a `Bus` event chain, main session stayed responsive. The 4/9 commit
replaced that chain with a single `await worker.done` to fix a real race
("parent never resumes") — but the cost was the entire async dispatch
contract.

This spec restores the original async contract using the disk-terminal +
watchdog A delivery mechanism we have since built (and refined on
2026-04-23 to fix the watchdog守門 evict-too-early bug). Disk delivery is
race-free, so the 4/9 commit's motivating bug is also resolved by this
work — not regressed back into existence.

## Original Requirement Wording (Baseline)

> 「我的最終要求是 main agent 必須能在任何時候接受對話，讓使用者有能力
> 隨時控制 subagent 的工作流。Orchestrator 自己卡住，不像話。」
>
> 「我記得一開始就是這樣設計的，dispatch 之後我仍然能跟 main agent 對話，
> 只是當時我把 subagent 數量設定為 1，故意不讓事情變複雜。」
>
> 「subagent 不應該負責 rotate，但要知道 rate limit 後必須 exit」
>
> — user, 2026-04-23 conversation

## Requirement Revision History

- 2026-04-23: initial draft created via plan-init.ts
- 2026-04-23: scope confirmed via AskUserQuestion — async revert + rate-limit
  self-death + cancel_task tool; SSDLC profile not enabled; companion
  skills miatdiagram + beta-workflow
- 2026-04-23: added Requirement 6 (proactive quota-low wrap-up). User
  clarified: subagent must self-detect when its own quota is almost out
  (default red line 5% remaining), proactively pack up partial results,
  and exit with a graceful terminal finish — so parent receives "I bailed
  early, here is what I have" instead of "I exhausted and died". Distinct
  from Requirement 3's reactive 429 path.

## Effective Requirement Description

1. **Main agent never blocks on subagent.** After dispatching a `task`, the
   assistant turn ends naturally and the session returns to idle. The user
   may submit further messages immediately and main agent responds in a
   normal new turn.
2. **Subagent results are delivered asynchronously** via a synthetic
   user-role message (`<task_result job_id=… status=…>…</task_result>`)
   injected into the parent session when the subagent finishes (success,
   failure, rate-limited, cancelled, or watchdog-killed). Main agent's
   next turn sees the message and decides what to do.
3. **Subagent self-detects rate-limit exhaustion and exits cleanly** with
   a terminal `finish: "rate_limited"` written to disk, instead of waiting
   indefinitely on `ModelUpdateSignal.wait`. Subagent does not perform
   rotation itself — that responsibility stays with parent / main agent.
4. **Main agent has a `cancel_task(jobId)` tool** so the user's natural
   "stop that subagent" intent can be translated into a precise action
   without aborting main's own turn.
5. **No regression of the 4/9 motivating bug.** The "parent never resumes
   after subagent completes" condition that motivated the sync-await
   regression must NOT come back. The disk-terminal + watchdog A path
   guarantees parent always learns of completion within at most one
   watchdog tick (5s), even if IPC is severed.
6. **Subagent proactive quota-low wrap-up.** When the subagent's own
   account quota drops below a configurable red line (default 5%
   remaining of the codex 5H window), the subagent must self-detect
   between LLM turns, stop accepting new work, write a best-effort
   summary of progress so far as its final assistant message, and exit
   with a terminal `finish: "quota_low"`. The synthetic `<task_result>`
   delivered to parent therefore contains real partial results plus a
   `status="quota_low"` marker — parent (or the orchestrator main agent)
   decides whether to re-dispatch on a different account, accept the
   partial output, or escalate to user. This is distinct from
   Requirement 3 (reactive 429 → `rate_limited`) — quota-low is
   proactive and produces a USEFUL message; rate_limited is reactive
   and produces a FAILURE message.

## Scope

### IN

- Revert task tool from sync `await Promise.race([run.done, watchdogCompletion])`
  to fire-and-forget dispatch with stub immediate result.
- Build `task.completed` Bus event + subscriber that injects synthetic
  `<task_result>` user-role message into parent session.
- Add timeout to subagent's `ModelUpdateSignal.wait` (default 30s, knob
  in `tweaks.cfg`) so rate-limited child exits via disk-terminal finish
  instead of waiting forever for parent to push a new model.
- Extend `TERMINAL_FINISHES` set with `rate_limited` and `quota_low`
  (and any other new terminal reasons surfaced during design).
- Subagent post-turn quota check: between LLM turns, evaluate own
  account's remaining quota; if ≤ red-line threshold (default 5%,
  `subagent_quota_low_red_line_percent` knob), trigger graceful
  wrap-up — emit a best-effort summary assistant message and write
  disk-terminal `quota_low` finish. Reuses existing
  `checkCodexLowQuotaAndMark` infrastructure but acts on subagent
  instead of just marking the account.
- New `cancel_task(jobId)` tool exposed to main agent.
- Two new tools added to the `system-manager` MCP server so main agent
  can act on `PendingSubagentNotice` cleanly:
  - `list_subagents` — query currently-running and recently-finished
    subagents (by parent session or globally)
  - `read_subsession` — read a child session's messages on demand
    (used when notice indicates main agent should fetch full output)
- Update SYSTEM.md and any agent prompts that reference task tool to
  teach the async contract ("dispatched ≠ completed; wait for
  `<task_result>` message; use cancel_task to stop a subagent").
- IDEF0 + GRAFCET artifacts modeling the dispatch / running /
  disk-terminal / inject / consume / cancel state machine.

### OUT

- Multi-subagent parallel stress test as a separate validation phase. The
  async revert mechanically unblocks `lanes.maxConcurrent=2`, but
  hardening the parallel path under load is a follow-up that can be
  driven by a future `extend` mode if real-world use surfaces issues.
- Frontend UI styling: synthetic `<task_result>` messages were rejected
  during design (DD-3 reworked to wake-only notice). No frontend
  surface to style.
- **Subagent stream reconnect / status bar hydration after page reload
  or SSE drop.** Separate, pre-existing bug observed 2026-04-23: child
  session UI loses its status bar after `Cmd-R` and never recovers
  (4/9 commit only partially addressed the related "child sessions
  disappear on reload" symptom; the active-subagent status bar was
  not covered). Touches frontend↔gateway↔daemon SSE bootstrap, not
  the orchestrator runloop. Should be handled by a dedicated spec
  (suggested slug `subagent-stream-reconnect`) with reload as the
  primary repro trigger. Out of scope here to keep
  responsive-orchestrator focused on its single goal.
- Generalised "any A-waits-for-B" liveness contract across the codebase.
  This spec covers the parent↔subagent boundary only. Other A-etb-B
  points (daemon↔MCP, frontend↔SSE, etc.) are tracked in the broader
  process-liveness-contract initiative and addressed separately.
- LLM provider prompt-cache optimization for the new turn pattern.
- TUI client behavior changes — only the daemon + web UI are in scope.

## Non-Goals

- Returning to the exact pre-c32b9612b implementation. The Bus event
  chain that commit replaced was racy; we are restoring the contract,
  not the wire.
- Auto-rotation inside subagent. Explicitly delegated upward to parent.
- Backwards compatibility with sync-await callers. There are no external
  callers of `TaskTool.execute`; refactor in place.

## Constraints

- **No daemon protocol break.** Existing sessions, share links, and
  on-disk message formats must continue to load. Synthetic `<task_result>`
  message is a new content shape, not a new schema field — backward-
  compatible additive change.
- **LLM contract preservation.** Every `tool_use` call must still get a
  paired `tool_result` in the same turn (provider hard requirement). The
  stub immediate-return result satisfies this.
- **No new watchdog dimension.** Reuse watchdog A (disk terminal) +
  守門 fix from 2026-04-23. No fourth watchdog signal introduced.
- **Tweakable timeout, not hardcoded.** Subagent escalation wait timeout
  goes into `tweaks.cfg` per the existing `feedback_tweaks_cfg.md`
  convention.
- **No silent fallback.** If the synthetic-message injection fails (parent
  session closed, write error), surface the failure as an explicit error
  event — never quietly drop subagent's result.
- **Beta workflow honored.** Implementation runs on a beta worktree per
  `beta-workflow` skill admission rules; main repo is not touched
  directly until fetch-back.

## What Changes

- **`packages/opencode/src/tool/task.ts`** — `execute()` returns immediately
  after worker dispatch with a stub result (`status: "dispatched", jobId,
  childSessionID`). The existing `Promise.race([run.done, watchdogCompletion])`
  block becomes a detached background watcher that emits `task.completed`
  when it resolves.
- **`packages/opencode/src/session/processor.ts`** — child-session branch
  at lines 460 and 1311 changes `await ModelUpdateSignal.wait(sessionID)`
  to a timeout-bounded wait; on timeout, write disk-terminal `rate_limited`
  finish and exit. `MAX_CUMULATIVE_ESCALATIONS=5` is preserved as the
  cumulative-failure escape hatch but is no longer the primary mechanism.
- **`packages/opencode/src/session/message-v2.ts`** — extend
  `TERMINAL_FINISHES` set with new `rate_limited` (and any others surfaced
  in design). Add tagging mechanism so synthetic `<task_result>` messages
  are distinguishable from real user input (likely a new `synthetic` flag
  on `MessageV2.User`).
- **`packages/opencode/src/bus/`** — new `task.completed` event payload
  shape; new subscriber that handles result injection.
- **`packages/opencode/src/tool/cancel-task.ts`** — new tool implementation.
- **`packages/opencode/src/session/system.ts` + `templates/prompts/SYSTEM.md`**
  — async task contract documentation injected.
- **Agent prompts** under `templates/prompts/agents/` that mention `task` —
  audit and update.
- **`tweaks.cfg`** — new `subagent_escalation_wait_ms` knob (default 30000).

## Capabilities

### New Capabilities

- **Async task dispatch**: main agent stays responsive throughout subagent
  lifecycle.
- **Subagent rate-limit graceful exit**: child writes disk-terminal
  `rate_limited` finish + exits when escalation wait times out; parent
  consumes via watchdog A.
- **Subagent proactive quota wrap-up**: child notices own quota
  approaching red line (default 5% remaining), packages partial work,
  exits with `quota_low` finish — parent receives useful partial
  output instead of a hard failure.
- **Per-subagent cancellation**: `cancel_task(jobId)` lets main agent
  abort one subagent without affecting siblings or itself.
- **Subagent introspection via MCP**: main agent can call
  `system-manager.list_subagents` and `system-manager.read_subsession`
  to inspect running subagents and read their output, instead of
  relying on host-only Storage internals.
- **Multi-subagent concurrency** (mechanical side effect): `lanes.maxConcurrent`
  finally takes effect once the await-rotor is gone.

### Modified Capabilities

- **`task` tool semantics**: from synchronous-result to dispatch-receipt.
  All callers (i.e. all LLM-driven prompts) must understand the new
  contract — addressed via prompt updates.

## Impact

- **Affected code paths**: task tool runtime, processor child-escalation
  path, message-v2 schema additions, bus subscribers, prompts.
- **Affected operators**: none directly; daemon restart required to pick
  up changes (XDG state untouched, no migration needed).
- **Affected docs**: SYSTEM.md, agent prompts, `specs/architecture.md`
  (note new dispatch contract), `docs/events/event_2026-04-23_*.md` for
  the regression+restore narrative.
- **Risk classes**:
  - LLM behavior regression (model misuses async contract first few
    turns) — mitigated by careful prompt examples and observation period
  - Synthetic-message injection bugs (off-by-one, lost result, double
    delivery) — mitigated by writing tests against test-vectors.json
  - cancel_task race with watchdog completion — mitigated by single
    cancellation authority (cancel writes its own terminal finish)
