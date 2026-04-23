# Observability: responsive-orchestrator

## Events

Bus events introduced or extended by this spec.

- `task.dispatched` — emitted immediately after stub return
  - **Payload**: `{ jobId, parentSessionID, childSessionID, agent, dispatchedAt }`
  - **Emitter**: tool/task.ts
  - **Consumers**: telemetry, debug log, future UI status bar

- `task.completed` — emitted by background watcher when subagent terminates
  - **Payload**: data-schema.json#TaskCompletedEvent
  - **Emitter**: tool/task.ts (background watcher)
  - **Consumers**: pending-notice-appender subscriber, telemetry,
    debug log

- `task.cancelled` — emitted when cancel_task signals abort
  - **Payload**: `{ jobId, reason, cancelledAt, by }`
  - **Emitter**: tool/cancel-task.ts
  - **Consumers**: telemetry; result still flows through `task.completed`

- `task.notice_appended` — emitted after PendingSubagentNotice
  successfully written to parent session info
  - **Payload**: `{ jobId, parentSessionID, status, queueDepth }`
  - **Emitter**: bus/subscribers/pending-notice-appender.ts
  - **Consumers**: telemetry; runloop wake trigger

- `task.notice_consumed` — emitted when prompt-assemble renders + removes
  notices
  - **Payload**: `{ parentSessionID, jobIds: string[], renderedAt }`
  - **Emitter**: session/system.ts (or wherever assemble lives)
  - **Consumers**: telemetry, debug log

- `subagent.quota_low_triggered` — emitted by subagent post-turn check
  - **Payload**: `{ sessionID, accountId, remainingPercent, redLinePercent }`
  - **Emitter**: session/processor.ts (child branch)
  - **Consumers**: telemetry, debug log

- `subagent.escalation_timeout` — emitted on bounded-wait expiration
  - **Payload**: `{ sessionID, accountId, waitMs, cumulativeEscalations }`
  - **Emitter**: session/processor.ts (child branch)
  - **Consumers**: telemetry, debug log

## Metrics

- `task.dispatch.count` — counter of task dispatches
  - **Type**: counter
  - **Labels**: `agent`, `outcome` (`dispatched` | `failed`)

- `task.completion.count` — counter of subagent completions
  - **Type**: counter
  - **Labels**: `status` (success | error | cancelled | rate_limited |
    quota_low | worker_dead | silent_kill), `agent`

- `task.duration_ms` — wall-clock from dispatch to terminal
  - **Type**: histogram
  - **Labels**: `status`, `agent`
  - **Buckets**: 1s, 5s, 30s, 2m, 10m, 1h, +Inf

- `task.notice_queue_depth` — pending notices per session at append time
  - **Type**: gauge (sampled at append)
  - **Labels**: `parentSessionID` (high-cardinality; sample only)

- `task.notice_consume_lag_ms` — time from notice appended to consumed
  by next assemble
  - **Type**: histogram
  - **Labels**: `status`

- `subagent.quota_low.count` — counter of quota_low triggers
  - **Type**: counter
  - **Labels**: `accountId` (provider+id)

- `subagent.escalation_timeout.count` — counter of bounded-wait expirations
  - **Type**: counter
  - **Labels**: `accountId`

- `subagent.parallel_active` — gauge of currently-running subagents
  - **Type**: gauge
  - **Labels**: none (global)

- `mcp.system_manager.list_subagents.duration_ms` — tool call latency
  - **Type**: histogram

- `mcp.system_manager.read_subsession.duration_ms` — tool call latency
  - **Type**: histogram
  - **Labels**: `bytesReturned` bucket

## Logs

- Log-level usage in this spec:
  - `error` for: TASK_DISPATCH_FAILED, WATCHER_PARENT_GONE,
    SUBSESSION_NOT_ACCESSIBLE
  - `warn` for: SUBAGENT_ESCALATION_TIMEOUT, SUBAGENT_WRAPUP_FAILED,
    WATCHER_DELIVERY_DEDUP
  - `info` for: SUBAGENT_QUOTA_LOW_TRIGGERED, task.dispatched,
    task.completed, task.notice_appended/consumed
  - `debug` for: per-tick watchdog samples, ModelUpdateSignal wait
    progress

- Required structured log fields for any task-related log line:
  - `service: "task" | "task.worker" | "task.notice" | "task.cancel"`
  - `jobId` (when applicable)
  - `parentSessionID` / `childSessionID`
  - `agent` (subagent type)

- Use existing `Log.create({ service: ... }).warn(message, payload)`
  pattern (consistent with rest of daemon)

## Alerts

- `task-completion-failure-spike` — fires when
  `task.completion.count{status="error" OR "worker_dead" OR "silent_kill"}`
  rate > 10/min for 5 min
  - **Action**: investigate subagent stability; check provider status

- `task-notice-consume-lag` — fires when
  `task.notice_consume_lag_ms` p99 > 30s for 5 min
  - **Action**: check parent runloop wake-up health; possible
    SSE / runloop deadlock

- `subagent-quota-low-storm` — fires when
  `subagent.quota_low.count` > 20/hour on a single account
  - **Action**: rotation policy review; the account may be
    permanently saturated

- `task-escalation-timeout-spike` — fires when
  `subagent.escalation_timeout.count` > 5/hour
  - **Action**: parent rotation logic may be stuck; investigate
    why parent isn't pushing new models within wait window

- `pending-notice-queue-buildup` — fires when
  `task.notice_queue_depth` > 10 for any session for 5 min
  - **Action**: parent runloop may have stopped consuming;
    investigate session state
