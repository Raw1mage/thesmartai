# Autorunner Daemon Architecture

Date: 2026-03-13
Status: Draft
Branch: autorunner
Workspace: /home/pkcs12/projects/opencode-runner

## 1. Objective

Design a daemon-based execution architecture for OpenCode autorunner so that sessions can be advanced as long-lived, recoverable, operator-visible workflows rather than as repeated prompt-turn continuations.

This document answers five core questions:

1. What is the canonical session-daemon lifecycle state machine?
2. How should prompt loop responsibilities be separated from daemon responsibilities?
3. What durable queue / lease / heartbeat / checkpoint model is needed?
4. How should subagent worker supervision be separated from tool/message status?
5. How can conversation turns be demoted from primary driver to input/output events?

---

## 2. Problem Statement

Current autonomous behavior in OpenCode already has significant foundations:

- persisted workflow metadata
- durable pending continuation records
- in-process supervisor sweep
- Smart Runner governance and bounded host adoption
- todo action metadata and dependency-aware planner
- session/operator observability surfaces

However, the system still fundamentally advances work by:

- finishing an assistant turn
- deciding whether to continue
- inserting a synthetic user continuation
- re-entering the prompt loop

This means the current execution model is still **conversation-turn centric**.

### Core diagnosis

The prompt loop is still the primary engine of progression.

That creates four architectural ceilings:

1. **Autonomy is tied to chat-turn semantics**
2. **Supervisor is attached to server process lifetime**
3. **Worker truth is mixed with tool/message persistence**
4. **Canonical runtime state is derived from partial surfaces rather than produced by a single coordinator**

If the goal is 24x7 autonomous execution, the system must treat a session as a **long-lived job/actor**, not as a sequence of synthetic chat prompts.

---

## 3. Design Principles

### 3.1 Session as actor/job, not prompt chain

A session in autonomous mode must be treated as a durable runtime entity with its own lifecycle, lease, health, and execution checkpoints.

### 3.2 Prompt loop becomes an execution adapter

`prompt.ts` must stop being the top-level owner of autonomy.
It should become one of the execution adapters used by the daemon when the chosen next step requires LLM reasoning.

### 3.3 Daemon owns control-plane truth

The daemon control plane owns:

- lifecycle state
- leases
- scheduling
- worker registry
- checkpointing
- anomaly emission
- canonical derived health state

### 3.4 Conversation is I/O, not scheduler

Real user messages, synthetic summaries, narrations, and assistant replies become events in the system. They are not the canonical scheduling primitive.

### 3.5 No silent fallback

Daemonization must preserve repo policy:

- fail fast
- explicit stop reasons
- operator-visible anomalies
- no hidden fallback mechanisms

---

## 4. Target Topology

```text
User / Web / TUI
      ↓
API Gateway / Session Query Surface
      ↓
Autorunner Control Plane Daemon
      ├─ Session Coordinator
      ├─ Workflow State Reducer
      ├─ Durable Queue / Lease Manager
      ├─ Worker Supervisor
      ├─ System Journal / Event Bus
      └─ Health / Anomaly Deriver
             ↓
      Execution Adapters
      ├─ Prompt Loop Adapter
      ├─ Tool Executor Adapter
      ├─ Subagent Task Adapter
      └─ Question / Approval Adapter
```

### Layer summary

#### A. Gateway layer

Responsibilities:

- auth
- API routing
- session query surfaces
- user command submission
- operator control actions

Not responsible for:

- autonomous scheduling
- worker supervision
- canonical runtime truth

#### B. Autorunner control plane daemon

Responsibilities:

- owns session lifecycle progression
- decides which session runs next
- holds leases/checkpoints/heartbeats
- emits canonical state and anomalies
- invokes execution adapters

#### C. Execution adapters

Adapters translate daemon next-actions into concrete runtime operations.

Examples:

- prompt-loop execution for reasoning slices
- subagent task dispatch
- question / approval stop-handling
- non-LLM system actions

The adapter executes. The daemon remains in control.

---

## 5. Canonical Session Lifecycle State Machine

Current workflow state is too close to UI-level summaries.
Daemon mode needs a more explicit state machine.

## 5.1 Primary lifecycle states

```text
CREATED
↓
IDLE
↓
QUEUED
↓
LEASED
↓
RUNNING
↓
WAITING_SUBAGENT | WAITING_USER | BLOCKED | COMPLETED | DEGRADED
```

### Definitions

- `CREATED`
  - Session record exists; daemon has not yet evaluated it
- `IDLE`
  - No immediate autonomous work scheduled
- `QUEUED`
  - Durable work item exists and is eligible for scheduling
- `LEASED`
  - Control plane has reserved the session for execution
- `RUNNING`
  - An execution adapter is actively progressing the session
- `WAITING_SUBAGENT`
  - Session is intentionally paused on worker completion
- `WAITING_USER`
  - Session needs user answer / approval / decision
- `BLOCKED`
  - Hard stop due to unrecoverable contract violation or operator action needed
- `COMPLETED`
  - Objective is terminally complete
- `DEGRADED`
  - Runtime inconsistency detected; safe execution paused pending review/recovery

## 5.2 Secondary execution states

These are not top-level lifecycle states, but health slices used by operators and scheduler logic.

- `executionState`
  - `healthy | resuming | timed_out | unreconciled | retry_pending | orphaned`
- `workerState`
  - `none | spawning | running | timed_out | failed | detached`
- `interactionState`
  - `no_gate | approval_needed | question_needed | product_decision_needed`

## 5.3 State authority

Only the daemon coordinator + reducer can publish canonical lifecycle state.

Other modules may publish facts/events, but not final truth.

Examples:

- task tool may emit `task.timeout`
- worker supervisor may emit `worker.missing_heartbeat`
- prompt adapter may emit `adapter.prompt.completed`

But lifecycle transitions are reduced centrally.

---

## 6. Event-Sourced Runtime Model

The daemon should be driven by structured runtime events.

## 6.1 Canonical event envelope

```json
{
  "ts": 0,
  "level": "debug|info|warn|error",
  "domain": "session|workflow|task|todo|worker|daemon|adapter|websync|governor",
  "eventType": "task.timeout",
  "sessionID": "...",
  "runID": "...",
  "workerID": "...",
  "messageID": "...",
  "partID": "...",
  "todoID": "...",
  "subSessionID": "...",
  "correlationID": "...",
  "payload": {},
  "anomalyFlags": []
}
```

## 6.2 Event classes

### Session lifecycle
- `session.created`
- `session.queued`
- `session.leased`
- `session.running`
- `session.completed`
- `session.blocked`
- `session.degraded`

### Planner / coordinator
- `planner.next_action_selected`
- `planner.no_actionable_todo`
- `planner.stop_reason_detected`

### Prompt adapter
- `adapter.prompt.started`
- `adapter.prompt.completed`
- `adapter.prompt.failed`

### Worker / subagent
- `worker.spawned`
- `worker.heartbeat`
- `worker.timeout`
- `worker.completed`
- `worker.cancelled`
- `worker.orphan_detected`

### Todo / task linkage
- `todo.promoted_in_progress`
- `todo.completed_from_result`
- `todo.waiting_on_subagent`
- `todo.unreconciled_error_detected`

### User interaction gates
- `interaction.question_opened`
- `interaction.question_answered`
- `interaction.approval_needed`
- `interaction.risk_review_needed`

### Observability / anomaly
- `anomaly.state_mismatch`
- `anomaly.worker_missing`
- `anomaly.sync_stale`
- `anomaly.unreconciled_wait_subagent`

---

## 7. Workflow State Reducer / Runtime Coordinator

The daemon requires a single convergence authority.

## 7.1 Responsibilities

The reducer/coordinator:

- consumes journal events
- updates session runtime state
- derives lifecycle / execution / worker / interaction states
- emits anomalies when facts conflict
- decides whether a queue item should remain queued, pause, or degrade

## 7.2 Example reduction rule

### Case: subagent timeout but stale waiting state remains

Facts:

- latest `worker.timeout`
- no active lease for that worker
- linked todo still says `waitingOn=subagent`
- prompt/tool message part says `error`

Reducer result:

- `lifecycleState = DEGRADED`
- `executionState = unreconciled`
- `workerState = timed_out`
- emit `anomaly.unreconciled_wait_subagent`
- do **not** continue autonomous execution automatically

This is crucial: stale todo metadata must no longer dominate runtime truth.

---

## 8. Queue / Lease / Heartbeat / Checkpoint Model

## 8.1 Durable queue

The existing pending continuation idea should evolve into a durable work queue owned by the daemon.

Queue item structure:

```json
{
  "queueID": "...",
  "sessionID": "...",
  "reason": "new_user_input|resume|retry|subagent_completed|question_answered|operator_resume",
  "createdAt": 0,
  "priority": "normal|high|operator_forced",
  "leaseOwner": null,
  "leaseExpiresAt": null,
  "retryAt": null,
  "attempt": 0
}
```

## 8.2 Lease model

A lease is daemon-owned, not prompt-owned.

Rules:

- one active session lease per session
- lease has TTL
- lease renewal is explicit while adapter is progressing work
- expired lease triggers coordinator review, not blind resumption

## 8.3 Heartbeat model

Two heartbeat classes:

1. **session execution heartbeat**
   - emitted by daemon while adapter is still alive
2. **worker heartbeat**
   - emitted by subagent worker supervisor for delegated tasks

Missing heartbeat should degrade state before any unsafe continuation.

## 8.4 Checkpoints

Checkpointing should capture daemon-progress truth, not just transcript progress.

Checkpoint examples:

- selected next action
- adapter started with execution identity
- worker spawned with linked todo
- user gate opened
- reducer marked session degraded

---

## 9. Prompt Loop as Execution Adapter

This is the most important architectural cut.

## 9.1 Current model

Today:

- prompt loop owns the run
- autonomous continuation injects synthetic user text
- workflow progression happens as a side effect of conversational processing

## 9.2 Target model

Tomorrow:

- daemon chooses a next action
- one action may be `reasoning_turn`
- daemon invokes `PromptLoopAdapter.execute(sessionID, actionContext)`
- prompt adapter returns structured execution output
- reducer updates canonical state

## 9.3 Adapter contract

Prompt adapter input:

```json
{
  "sessionID": "...",
  "runID": "...",
  "action": {
    "kind": "reasoning_turn",
    "goal": "...",
    "todoID": "...",
    "contextPolicy": "normal|docs_preflight|debug_preflight"
  }
}
```

Prompt adapter output:

```json
{
  "result": "completed|paused|blocked|delegated|failed",
  "assistantMessageID": "...",
  "createdTaskIDs": ["..."],
  "openedQuestionID": null,
  "emittedNarration": true,
  "facts": [
    "todo_completed:t1",
    "subagent_spawned:w1"
  ]
}
```

## 9.4 Why this matters

Once prompt loop is just an adapter:

- synthetic user continuation is optional, not required
- daemon can trigger execution from queue events directly
- conversation timeline becomes a record of work, not the work scheduler itself

---

## 10. Subagent Worker Supervision Model

Task tool state should no longer be the primary worker truth.

## 10.1 Worker supervisor responsibilities

- create worker instance
- issue workerID
- track linked session/todo/subsession
- track start / heartbeat / finish / timeout / cancel
- report worker facts to journal

## 10.2 Dual-layer truth model

### Canonical truth
- worker registry / supervisor events

### Presentation surfaces
- task tool part metadata
- session monitor rows
- timeline narrations

The presentation layer reflects supervisor truth, not the other way around.

## 10.3 Worker record shape

```json
{
  "workerID": "...",
  "sessionID": "...",
  "subSessionID": "...",
  "todoID": "...",
  "toolCallID": "...",
  "state": "spawning|running|completed|timed_out|failed|cancelled|orphaned",
  "startedAt": 0,
  "lastHeartbeatAt": 0,
  "finishedAt": null,
  "resultSummary": null
}
```

---

## 11. Conversation Demotion Strategy

The new architecture must demote conversation turns from scheduler primitive to event surface.

## 11.1 Conversation becomes:

- user intent input
- operator guidance surface
- narration surface
- audit trail
- final response surface

## 11.2 Conversation is no longer:

- queue primitive
- session lease primitive
- canonical worker truth
- canonical lifecycle truth

## 11.3 Transitional compatibility

During migration, synthetic messages may still be emitted for:

- user-visible narration
- compatibility with existing transcript views
- some prompt-adapter execution inputs

But these must be treated as compatibility artifacts, not primary scheduling truth.

---

## 12. Health / Anomaly API

The daemon should expose a canonical health view for operators.

## 12.1 Suggested API shape

```json
{
  "sessionID": "...",
  "lifecycleState": "DEGRADED",
  "executionState": "unreconciled",
  "workerState": "timed_out",
  "interactionState": "no_gate",
  "queueState": "leased",
  "runtimeState": "alive",
  "lastAnomaly": {
    "code": "unreconciled_wait_subagent",
    "message": "Timed-out subagent left stale waitingOn=subagent metadata"
  },
  "operatorHint": "Review timed-out worker and reconcile linked todo before resuming",
  "updatedAt": 0
}
```

## 12.2 Consumers

- session side panel
- admin / diagnostics
- CLI inspect
- automated recovery review tools

---

## 13. Migration Plan

## Phase A — Journal substrate

Goal:
- introduce runtime event journal and correlation model

Changes:
- add event schema
- add append/query persistence
- emit events from current workflow-runner / prompt / task / supervisor paths

Non-goals:
- no daemon split yet
- no canonical reducer yet

## Phase B — Reducer and derived health

Goal:
- centralize runtime truth

Changes:
- build reducer/coordinator
- produce canonical health view
- surface anomalies in UI

Non-goals:
- prompt loop still may drive execution for now

## Phase C — Daemon-owned queue and leases

Goal:
- move queue/lease ownership out of prompt loop semantics

Changes:
- daemonized queue scan and lease renewal
- durable session checkpoints
- stronger heartbeat handling

## Phase D — Prompt demotion

Goal:
- turn prompt loop into execution adapter

Changes:
- daemon chooses next action
- prompt adapter returns structured output
- synthetic continuation becomes compatibility-only

## Phase E — Worker supervisor hard split

Goal:
- worker truth becomes supervisor-owned

Changes:
- explicit worker registry
- task/tool surfaces derived from worker events
- orphan/timeout/reap semantics upgraded

## Phase F — Operator-first runtime

Goal:
- expose full health / anomaly / timeline views

Changes:
- admin diagnostics
- session health panel
- event timeline inspector

---

## 14. Feasibility Assessment

## What makes this feasible

- existing workflow metadata can be reused
- existing continuation queue can be evolved, not discarded
- existing planner / todo action metadata remain useful
- Smart Runner governance remains valuable as daemon-side planning intelligence
- current observability surfaces can be rewired onto daemon health output

## What makes this hard

- prompt loop currently still owns too much control
- tool/task/message layers mix presentation with truth
- current queue/resume logic is still server-process local
- migration risks dual authority if old and new control planes coexist too long

## Final feasibility judgment

**Yes, this refactor is feasible.**

But the architectural win does **not** come from adding more autonomous prompt behaviors.
It comes from establishing a new primary execution substrate:

- daemon-owned lifecycle
- event journal
- reducer-owned truth
- worker supervision
- prompt loop demotion

Without that shift, the system will continue to inherit conversation-turn DNA.

---

## 15. Non-goals / Red Lines

- no silent fallback mechanisms
- no hidden cross-provider rescue behavior introduced for daemon convenience
- no UI-only patching that masks missing canonical state
- no second competing source-of-truth between daemon and prompt loop

---

## 16. Recommended Immediate Next Slice

Create implementation spec(s) for:

1. `runtime_event_journal.md`
2. `workflow_state_reducer.md`
3. `session_daemon_lease_model.md`
4. `worker_supervisor_registry.md`

Then start with the smallest vertical slice:

- journal schema
- event emission from current paths
- anomaly capture for subagent-timeout / stale-wait mismatch

That is the lowest-risk entry into daemon architecture.
