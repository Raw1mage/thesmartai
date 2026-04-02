# Design

## Context

- V2 context sharing prepends full parent history at child startup (avg 100K tokens). For Anthropic/Gemini this is cheap (content cache hit). For Codex it's expensive (full cache write — Responses API is state-reference, not content-based).
- Rebind checkpoint: LLM summary + lastMessageId boundary, 40K token threshold, 10-round cooldown. Designed for daemon restart recovery; repurposable for subagent dispatch.
- Four agent behavior patterns exist implicitly; none have formal dispatch contracts.
- Daemon pattern is absent: cron handles schedule-based triggers but not condition-based persistent monitors.

## Goals / Non-Goals

**Goals:**

- Eliminate Codex subagent first-round cache write via previousResponseId fork
- Reduce non-Codex subagent first-round cost when checkpoint is available
- Formally document Executor / Researcher / Cron / Daemon taxonomy
- Design and implement Daemon agent lifecycle

**Non-Goals:**

- Unify cache behavior across all providers
- Implement full parallel subagent execution (evaluation only)
- Replace Cron subsystem

## Decisions

- **DD-1: Codex fork is provider-gated.** Only `providerId === "codex"` triggers fork dispatch. Anthropic/Gemini continue to use stable prefix (already efficient). Check in `task.ts` at dispatch time.

- **DD-2: Fork seed via codexSessionState exposure.** `llm.ts` `codexSessionState` is currently module-private. Expose a read-only `LLM.getCodexResponseId(sessionID): string | undefined` function. `task.ts` reads this before spawning child session.

- **DD-3: parentMessagePrefix skip is conditional.** In `prompt.ts`, child session startup checks: if `session.parentID` AND `codexForkResponseId` is seeded in child's `codexSessionState` → skip parentMessagePrefix injection for this session. After first round, child builds its own chain normally.

- **DD-4: Checkpoint dispatch is opportunistic, not blocking.** `loadRebindCheckpoint()` is called at dispatch time. If found, used as prefix base. If not, fall back silently. No on-demand checkpoint trigger at dispatch time (avoids blocking user flow).

- **DD-5: Daemon is a new session kind, not a task() subtype.** Daemon agent lifecycle is fundamentally different from Executor/Researcher (no completion handoff, no parent resume). Implement as a new session flag `session.kind = "daemon"` rather than overloading task(). The task() tool can still spawn a daemon by setting this flag.

- **DD-6: Daemon persistence via CronStore pattern.** Daemon sessions are registered in a `daemon-sessions.json` store (parallel to cron's `jobs.json`). On daemon restart, registered daemon sessions are re-spawned. Uses same `recoverSchedules()` pattern as cron heartbeat.

- **DD-7: Daemon notification via Bus + existing announcement channel.** Daemon publishes `DaemonAgentEvent.Triggered` to Bus. The cron delivery subsystem's `announce` mode already routes to main session. Reuse this path rather than building a new notification channel.

- **DD-8: Single-child invariant evaluation deferred to design.md addendum.** Parallel subagent (Researcher type) requires a race condition audit of: Bus subscriber ordering, ProcessSupervisor multi-child state, UI active-child surface, task-worker-continuation multi-completion handling. This is a separate design exercise captured in the tasks below.

## Data / State / Control Flow

**Codex Fork Path:**
```
task() dispatch
  → LLM.getCodexResponseId(parentSessionID) → R_N
  → child session created with codexForkSeed = R_N
  → prompt.ts child startup: parentMessagePrefix skipped
  → llm.ts first call: previousResponseId = R_N injected
  → child builds own chain: C_1 → C_2 → ...
  → on completion: child checkpoint summary → parent continuation message
```

**Checkpoint Dispatch Path (non-Codex):**
```
task() dispatch
  → SessionCompaction.loadRebindCheckpoint(parentSessionID)
  → if found: parentMessagePrefix = [summary msg + messages after lastMessageId]
  → if not found: parentMessagePrefix = full parent history (existing)
  → rest of child lifecycle unchanged
```

**Daemon Lifecycle:**
```
user: "monitor X"
  → main agent: task(type="daemon", condition="...")
  → task.ts: spawn child session with kind="daemon"
  → DaemonStore.register(sessionID, condition, ...)
  → ProcessSupervisor.register(kind="daemon", ...)
  → main agent receives: { daemonSessionId, status: "running" }
  → daemon loop: poll/watch condition
  → condition met → Bus.publish(DaemonAgentEvent.Triggered, detail)
  → delivery.ts announce → main session notification

on daemon restart:
  → DaemonStore.recover() → re-spawn registered daemon sessions
```

## Risks / Trade-offs

- **Codex fork hash mismatch on first round**: child system prompt differs from parent (no AGENTS.md). The `optionsHash` comparison in `llm.ts` compares system+tools. Child's first call has no prior hash to compare against — need to bypass hash check for the seeded responseId (use it unconditionally on first call, then normal hash tracking starts from C_1). → Mitigation: set `optionsHash` to child's own system+tools hash alongside the seeded responseId.

- **Checkpoint summary completeness for subagent**: summary was designed for daemon restart (covers parent's own work), not for subagent dispatch. The summary may lack context a subagent executor needs. → Mitigation: checkpoint-based dispatch is opt-in and only used when checkpoint exists; executor-type subagents should receive the spec/plan directly anyway (not rely on parent history summary).

- **Daemon orphan processes on crash**: if daemon is registered but process dies without clean exit, re-spawn on restart could create duplicates. → Mitigation: DaemonStore includes `pid` + last heartbeat. On recovery, check if pid is still alive before re-spawning.

- **Daemon condition evaluation cost**: daemon loop needs to periodically check conditions. LLM-based condition evaluation is expensive. → Mitigation: for file/log watches, use native watchers (fs.watch, tail). LLM evaluation only for semantic conditions. Daemon type should declare its monitoring strategy at spawn time.

- **Parallel subagent race conditions (deferred)**: relaxing single-child invariant affects Bus event ordering, task-worker-continuation multi-completion, UI surface. Full audit required before any implementation.

## Critical Files

- `packages/opencode/src/tool/task.ts` — dispatch logic, Codex fork seed, daemon kind flag
- `packages/opencode/src/session/prompt.ts` — parentMessagePrefix skip condition
- `packages/opencode/src/session/llm.ts` — codexSessionState exposure, first-call hash bypass
- `packages/opencode/src/session/compaction.ts` — loadRebindCheckpoint reuse at dispatch
- `packages/opencode/src/daemon/index.ts` — daemon lifecycle, recovery integration
- `packages/opencode/src/bus/subscribers/task-worker-continuation.ts` — daemon kind exclusion from completion handoff
- New: `packages/opencode/src/daemon/agent-daemon.ts` — DaemonStore, condition loop, event publish
- `specs/architecture.md` — update with daemon agent module
