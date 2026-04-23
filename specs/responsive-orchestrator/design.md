# Design: responsive-orchestrator

## Context

This work is a **revert + modernization** of commit `c32b9612b` (2026-04-09),
which converted the `task` tool from async-via-Bus-event-chain into
synchronous `await`. The 4/9 commit fixed a real bug ("parent never
resumes") at the cost of orchestrator responsiveness. We restore the
async contract using a different (race-free) delivery substrate that
became available after the 2026-04-23 watchdog守門 fix.

Pre-2026-04-23 the watchdog A path had a守門 bug (`if (!worker) return`
evicted the entire watchdog after stdout EOF). With that fixed, disk-
terminal delivery is now provably reliable — a precondition this spec
relies on.

## Goals / Non-Goals

### Goals

- Main session never blocks on subagent lifecycle
- Subagent failure modes (rate-limit, hang, crash, quota-low) all surface
  as actionable `<task_result>` messages to parent
- New behavior preserves all current tool-use protocol guarantees
  (every `tool_use` has paired `tool_result`)
- Tunable thresholds in `tweaks.cfg` per existing convention
- No new IPC channel, no new watchdog dimension

### Non-Goals

- Generalised liveness contract for all A-waits-for-B sites (separate
  process-liveness-contract initiative)
- Streaming subagent partial output to parent before completion
  (post-MVP enhancement)
- TUI client behavior (daemon + web only)

## Decisions

### DD-1 — Stub immediate result satisfies the LLM tool-use contract

LLM providers (Anthropic, OpenAI, Codex) reject conversations where a
`tool_use` lacks a paired `tool_result` in the same turn. The async
dispatch returns a stub `tool_result` immediately:

```json
{ "status": "dispatched", "jobId": "job_…", "childSessionID": "ses_…",
  "note": "Subagent running; result will arrive as a separate message" }
```

This pairs the tool_use synchronously, lets the assistant turn close
naturally, and frees the session lock. The actual subagent result
arrives later as a synthetic user message — a NEW turn, not a delayed
tool_result.

Alternative considered: long-polling tool_result. Rejected because most
providers cap tool execution at 60s wall-clock; would not solve the
3.5-hour rate-limit case.

### DD-2 — Delivery substrate is disk-terminal + watchdog A, NOT Bus event

Pre-c32b9612b used `worker.current id-match → Bus.publish → subscriber
→ enqueue continuation`. This had race conditions (cancel/error/exit
clearing `worker.current` before publish) that swallowed completions.

New substrate:
- Subagent writes terminal finish to its own session storage (parts/
  + message info.json), atomically per existing
  `Storage.write` semantics
- Parent's task watchdog A polls every 5s (`WATCHDOG_INTERVAL_MS`),
  reads child's last assistant message, fires `disk_terminal` resolution
  when it sees a TERMINAL_FINISHES value past `DISK_GRACE_MS`
- Disk-terminal handler enqueues `task.completed` Bus event
- Subscriber consumes event and injects synthetic message

The watchdog已是 production-validated 2026-04-23 (post-守門 fix). Race
window for delivery: subagent commit-to-disk vs watchdog tick — at
worst, parent learns 5s late. Acceptable.

### DD-3 — Wake-only signal; no synthetic message; main agent reads child session itself

No `<task_result>` message is generated, persisted, or injected into
the parent session log. The user's chat scroll stays a pure
human↔assistant conversation.

Mechanism:

- Watcher (A3) emits `task.completed` Bus event carrying minimal
  metadata only: `{ jobId, childSessionID, status, finish,
  rotateHint?, errorDetail? }`. No summary text, no full result.
- Subscriber appends this metadata to a `pendingSubagentNotices`
  array on the parent session info (`session/<sid>/info.json`),
  then triggers the parent runloop wake.
- On the next prompt assemble for the parent session, the assembler
  reads `pendingSubagentNotices`, formats each into a one-line
  system-prompt addendum, and clears the consumed entries from the
  array. The addendum is placed in the system message section, not
  in the conversation log.
- Format example for one entry:
  `[subagent ses_abc finished status=quota_low; account
  codex-…ivon0829 nearly exhausted; rotate before next dispatch;
  read child session for details]`
- If main agent needs subagent's actual output, it can call existing
  read/list tools against `childSessionID` (e.g. `read_session`,
  `read_message`) — these tools already exist; no new fetcher
  required.

Effect:
- UI: completely unchanged. No backstage-message clutter.
- LLM context: gets a brief notice in the system prompt on the very
  next turn, enough to decide "do nothing" / "read child" / "rotate
  + redispatch" / "tell user".
- Storage: subagent's full session lives at its own path, browsable
  via UI independently if user wants to inspect.
- One-shot: notices are delete-on-consume — main agent sees each
  notice exactly once, no stale repetition across turns.

### DD-3.1 — quota_low notice carries explicit rotate directive

When subagent exits with `finish: "quota_low"`, the wake notice
appended to parent's `pendingSubagentNotices` carries a
`rotateHint` field shaped as:

```
{
  "exhaustedAccountId": "<provider>:<accountId>",
  "exhaustedAt": "<iso8601>",
  "remainingPercent": <number>,
  "directive": "rotate-before-redispatch"
}
```

The next-turn system prompt addendum reads this field and produces
explicit instructional text such as:

```
[subagent ses_abc finished status=quota_low; the account
codex-…ivon0829-gmail-com is at 4% remaining; before dispatching
any new subagent, switch to a different account via
manage_session or wait for quota reset]
```

This converts the user's "subagent 提早收手 + 提醒 main agent
rotate" requirement into a concrete instruction the LLM cannot
miss. Rotation execution itself stays with main agent (DD-7);
this only ensures main agent is told.

### DD-4 — Subagent quota self-check is post-turn, not mid-stream

Mid-stream quota interruption would corrupt the in-flight LLM response
and risk leaving a half-tool-call state. Post-turn check (after
`finishReason` lands) is clean: subagent has just completed one
coherent turn, can decide whether to start another.

Trigger location: `processor.ts` immediately after the existing
`checkCodexLowQuotaAndMark` call (line 1246). For child sessions, if
threshold tripped, set a `quotaLowExitRequested` flag on the runloop
state. The next iteration of the `while (true)` loop checks the flag
before starting a new LLM call; if set, inject a system instruction
and run ONE more turn (the wrap-up summary), then break.

### DD-5 — Wrap-up summary uses the subagent's own LLM, not a synthesized stub

The summary is part of subagent's contract output — it must reflect
real understanding of what was done. Generating it via the same model
keeps continuity and quality. Cost: one final API call which itself
might 429. Mitigation: wrap-up call uses `MAX_CONSECUTIVE_ERRORS = 1`
override; if even the wrap-up fails, fall back to writing
`finish: "rate_limited"` with a stub summary noting "wrap-up attempt
failed".

### DD-6 — `cancel_task` writes the terminal finish itself

Avoid race between cancel signal and watchdog by making cancel the
single authority. `cancel_task` flow:

1. Look up worker by `jobId`
2. Send abort signal to worker (existing path)
3. Worker's abort handler writes `finish: "cancelled"` to disk
4. Worker exits
5. Watchdog A picks up disk-terminal as usual → injects message

This means cancel and natural completion share the SAME delivery path —
no special-case in the subscriber.

### DD-7 — Subagent NEVER rotates accounts itself

Reinforces existing `isChildSession` branch. Rotation responsibility
stays with parent. Subagent's only escalation actions:
- Emit `RateLimitEscalationEvent` (signal)
- Wait bounded time for `ModelUpdateSignal` (parent's response)
- On timeout, exit with `rate_limited` finish

### DD-8 — `lanes.maxConcurrent=2` becomes effective without config change

Mechanical side effect of removing `await Promise.race`. The lane was
always there but bottlenecked by the await chain. No config change
required for users on default settings; multi-subagent parallel is
the new default.

### DD-9 — `tweaks.cfg` keys

| Key | Default | Range | Purpose |
|---|---|---|---|
| `subagent_escalation_wait_ms` | 30000 | 5000–300000 | Max wait for parent to push new model after escalation |
| `subagent_quota_low_red_line_percent` | 5 | 0–50, 0 = disabled | Trigger proactive quota wrap-up |
| `task_result_inject_grace_ms` | 0 | 0–10000 | Optional jitter delay before injection (default = immediate) |

Existing knobs preserved unchanged: `codex_rotation_low_quota_percent`
(default 10) — controls account marking, separate from subagent
self-action.

### DD-11 — system-manager exposes subagent introspection as MCP tools

The PendingSubagentNotice (DD-3) carries only metadata; main agent
needs an explicit way to fetch subagent state and content. We expose
two new tools on the existing `system-manager` MCP server:

- `list_subagents({ parentSessionID? })` — enumerates active and
  recently-finished subagents. Implementation reads from the worker
  registry (active) plus a bounded ring-buffer of recently-finished
  jobIds (10? 50? — finalize during planned phase).
- `read_subsession({ sessionID, sinceMessageID? })` — wraps the
  existing `readNestedSessionMessages` helper (system-manager
  index.ts:121) and exposes it as a tool. Same access boundary as
  other read paths.

Why MCP tools, not direct daemon API:
- Main agent already has system-manager in its MCP tool pool via
  enablement registry — zero discovery overhead
- MCP tool surface is the established way for LLM-driven inspection
  (consistent with `manage_session`, `switch_account`, etc.)
- Other clients (TUI, web admin) can call these same tools without
  reinventing access controls

Read-only shape: both tools are non-mutating. No abort, no write.
Cancel still goes through the dedicated `cancel_task` tool (DD-6) so
the destructive surface stays scoped.

### DD-10 — Cumulative escalation cap remains the failsafe

Even with `subagent_escalation_wait_ms` timeout, `MAX_CUMULATIVE_ESCALATIONS = 5`
stays as the global circuit breaker. If parent repeatedly pushes
already-rate-limited vectors (the bug surfaced on 2026-04-23), counter
will trip on the 6th escalation regardless of timeout — failing fast
rather than oscillating.

## Risks / Trade-offs

| ID | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | LLM doesn't understand async contract; double-dispatches or polls obsessively | High first week, low after | Concrete examples in SYSTEM.md; observation period; agent prompt iteration |
| R2 | Synthetic message injection during compaction race overwrites real user message | Medium | Inject via Session.appendMessage with explicit ordering check; integration test |
| R3 | Parent session closed/deleted while subagent still running; injection target gone | Low | Handler checks Session.exists before injection; if absent, log + drop result, emit telemetry |
| R4 | Quota wrap-up summary itself triggers 429, cascading | Medium | DD-5 fallback path: stub summary on wrap-up failure |
| R5 | cancel_task race with simultaneous natural completion | Low | DD-6 single-authority pattern; `finish` field is set-once (file overwrite is atomic) |
| R6 | Multi-subagent parallel surfaces shared-state bugs not visible at maxConcurrent=1 | Medium | Stress test in OUT-of-scope follow-up; observation in production |
| R7 | Provider-side prompt cache misses on new turn pattern increase token cost | Low-medium | Measure pre/post; if material, optimize prompt prefix stability |
| R8 | Subagent's `quota_low` trigger fires too aggressively, wastes a turn on summary unnecessarily | Low | Threshold default 5% (not 10); knob to disable (set 0); user-tunable |

## Critical Files

### Direct edits

- [packages/opencode/src/tool/task.ts](packages/opencode/src/tool/task.ts)
  — execute() return shape change; background watcher detach
- [packages/opencode/src/session/processor.ts](packages/opencode/src/session/processor.ts)
  — child-session escalation timeout (~line 1311); quota-low post-turn
  branch (~line 1246)
- [packages/opencode/src/session/message-v2.ts](packages/opencode/src/session/message-v2.ts)
  — TERMINAL_FINISHES extension; User.synthetic field
- [packages/opencode/src/config/tweaks.ts](packages/opencode/src/config/tweaks.ts)
  — three new knobs per DD-9

### New files

- `packages/opencode/src/tool/cancel-task.ts` — new tool
- `packages/opencode/src/bus/subscribers/pending-notice-appender.ts` —
  new subscriber that consumes `task.completed` and appends to parent
  session info.json#pendingSubagentNotices
- `packages/opencode/src/bus/events/task-completed.ts` — event schema
- `packages/mcp/system-manager/src/tools/list-subagents.ts` — new MCP tool
- `packages/mcp/system-manager/src/tools/read-subsession.ts` — new MCP tool
  (extracts `readNestedSessionMessages` helper at
  packages/mcp/system-manager/src/index.ts:121 into a public tool)

### Prompt updates

- `templates/prompts/SYSTEM.md` — async contract section
- `~/.config/opencode/prompts/SYSTEM.md` — runtime mirror
- `templates/prompts/agents/build.txt`, `templates/prompts/agents/orchestrator.txt`
  (and any other agent that dispatches tasks) — task tool semantic update

### Modeling artifacts

- `specs/responsive-orchestrator/idef0.json` — A0 system context, A1-A5
  decomposition (dispatch / run / detect-finish / inject / cancel)
- `specs/responsive-orchestrator/grafcet.json` — state machine for
  subagent worker lifecycle and task tool dispatch
- `specs/responsive-orchestrator/c4.json` — main session, subagent
  worker, task tool, watchdog, subscriber, prompt
- `specs/responsive-orchestrator/sequence.json` — happy path, IPC-sever,
  rate-limit, quota-low, cancel scenarios

## Open Questions

(none — all resolved during proposal phase via AskUserQuestion)
