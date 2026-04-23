# Errors: responsive-orchestrator

## Error Catalogue

All error codes used by code paths introduced by this spec. Codes are
stable; messages may evolve (mark with supersede in design.md).

### Task tool

- **TASK_DISPATCH_FAILED** — could not spawn subagent worker
  - **Message**: "Failed to dispatch subagent: <reason>"
  - **Trigger**: worker pool exhausted, fork error, registry write failure
  - **Recovery**: returned as a synchronous tool error to LLM; main agent
    typically retries or surfaces to user
  - **Layer**: tool/task.ts

- **TASK_NO_SUCH_JOB** — cancel_task / list_subagents references
  unknown jobId
  - **Message**: "No subagent found with jobId: <id>"
  - **Trigger**: stale jobId, typo, or already-finished job evicted from
    ring buffer
  - **Recovery**: structured response (not throw); main agent moves on
  - **Layer**: tool/cancel-task.ts, mcp/system-manager

- **TASK_ALREADY_TERMINAL** — cancel_task on subagent that finished
  before signal arrived
  - **Message**: "Subagent <id> already finished with: <finish>"
  - **Trigger**: race between cancel and natural completion
  - **Recovery**: structured response; notice already in pendingNotices
  - **Layer**: tool/cancel-task.ts

### Subagent runloop

- **SUBAGENT_ESCALATION_TIMEOUT** — bounded wait for ModelUpdateSignal
  expired without parent rotation
  - **Message**: "Parent did not provide rotation within
    subagent_escalation_wait_ms; exiting with rate_limited"
  - **Trigger**: 429 + parent unable or unwilling to rotate
  - **Recovery**: subagent writes finish:rate_limited and exits;
    parent picks up via watchdog A
  - **Layer**: session/processor.ts (child branch)

- **SUBAGENT_QUOTA_LOW_TRIGGERED** — informational; not strictly an
  error but logged at warn for observability
  - **Message**: "Subagent quota at <pct>% — wrap-up triggered"
  - **Trigger**: post-turn check finds remaining ≤ red line
  - **Recovery**: subagent runs wrap-up turn then exits; parent gets
    quota_low notice with rotateHint
  - **Layer**: session/processor.ts (child branch)

- **SUBAGENT_WRAPUP_FAILED** — wrap-up summary turn itself fails
  - **Message**: "Quota-low wrap-up turn failed: <inner>"
  - **Trigger**: even the wrap-up call gets 429 / network error / etc.
  - **Recovery**: fall back to writing finish:rate_limited with stub
    summary "wrap-up attempt failed"; do not retry wrap-up (DD-5)
  - **Layer**: session/processor.ts (child branch)

### Background watcher / delivery

- **WATCHER_PARENT_GONE** — task.completed event fired but parent
  session no longer exists
  - **Message**: "Parent session <sid> not found; dropping
    PendingSubagentNotice for jobId <id>"
  - **Trigger**: parent session deleted or evicted while subagent ran
  - **Recovery**: log structured event + telemetry counter; do not
    throw; subagent's own session remains browsable
  - **Layer**: bus/subscribers/pending-notice-appender.ts

- **WATCHER_DELIVERY_DEDUP** — same jobId notice arrived twice
  - **Message**: "Duplicate notice for jobId <id>; latest wins"
  - **Trigger**: Bus event re-publish after watchdog tick race
  - **Recovery**: idempotent — replace existing entry; logged at info
  - **Layer**: bus/subscribers/pending-notice-appender.ts

### system-manager MCP

- **SUBSESSION_NOT_FOUND** — read_subsession with unknown sessionID
  - **Message**: "Session not found: <sid>"
  - **Trigger**: typo, deleted session, wrong project
  - **Recovery**: structured response (not throw)
  - **Layer**: mcp/system-manager/src/tools/read-subsession.ts

- **SUBSESSION_NOT_ACCESSIBLE** — sessionID belongs to different
  user/project
  - **Message**: "Session not accessible: <sid>"
  - **Trigger**: cross-tenant access attempt
  - **Recovery**: structured response; do NOT leak existence info
    beyond "not accessible"
  - **Layer**: mcp/system-manager/src/tools/read-subsession.ts

## Error Code Format

- `UPPER_SNAKE_CASE`, domain-prefixed: `TASK_*`, `SUBAGENT_*`,
  `WATCHER_*`, `SUBSESSION_*`
- Codes are stable across versions; messages are revisable

## Recovery Strategies

Three patterns:

1. **Structured response** (no throw) — used for caller-driven decisions
   (cancel_task, read_subsession). Main agent gets a clean object,
   decides next move.
2. **Disk-terminal + watchdog A delivery** — used for subagent-side
   failures (rate_limit, quota_low, wrapup_failed). Failure is
   externalized as a finish reason; parent learns via the
   already-built path; no special handling required at parent.
3. **Log-and-drop** — used for delivery edge cases (WATCHER_PARENT_GONE,
   double-delivery). Telemetry preserves the event for postmortem;
   runtime moves on without blocking.

No error in this spec is an unhandled exception. Every code path
under DD-1..DD-11 has either a structured response, a disk-terminal
finish, or a log-and-drop recovery.
