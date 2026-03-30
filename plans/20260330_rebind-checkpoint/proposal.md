# Proposal

## Why

- Daemon restart invalidates Codex WS continuation (`previous_response_not_found`), forcing a full-context rebind of 850KB+ payload.
- Current compaction only triggers on overflow (~380K tokens), far too late for rebind budget.
- Compacting the live message chain destroys 97% prompt cache hit rate — unacceptable for normal operation.
- Need a shadow checkpoint mechanism that keeps a compact rebind base ready on disk without touching the live conversation.

## Original Requirement Wording (Baseline)

- "compaction後得到的持久化checkpoint data pack，只留給rebind用"
- "正常對話沒有發生任何daemon restart或中斷問題的時候，繼續保持原本context的正常增長，以免cache巨量miss"
- "原本是要打包1~100回合的history，但因為1~90回合的內容已經有checkpoint compact pack，就只要打包compact pack + 91~100回合的內容當做rebind"

## Requirement Revision History

- 2026-03-30: Initial design from incremental-delta RCA session.
- 2026-03-30: Clarified that checkpoint MUST NOT disrupt live cache. Checkpoint is a shadow artifact for restart recovery only.
- 2026-03-30: Clarified that compaction trigger uses data size / token count threshold, not unconditional.

## Effective Requirement Description

1. During normal operation, quietly produce a compaction checkpoint in the background when estimated rebind payload exceeds a threshold.
2. The checkpoint is persisted to disk and never touches the live message chain — prompt cache stays intact.
3. On daemon restart + continuation invalidation, use the checkpoint as the rebind input base instead of the full message history.
4. The rebind payload becomes: checkpoint (compact) + messages since checkpoint (recent) — significantly smaller than full history.
5. The checkpoint mechanism uses SharedContext snapshot (free, local) as the primary source. Server `/responses/compact` endpoint is a future enhancement for higher-quality compaction.

## Scope

### IN

- Background checkpoint save triggered by token threshold
- Checkpoint file persistence per session on disk
- Rebind path that uses checkpoint as input base instead of full message reconstruction
- Message boundary tracking: which messages are covered by the checkpoint vs which are "new"
- Stale checkpoint cleanup

### OUT

- Changing the live conversation's message chain or compaction behavior
- Server-side `/responses/compact` integration (future enhancement)
- Changing the overflow compaction threshold or logic
- Subagent checkpoint (main sessions only)

## Non-Goals

- Replacing the existing overflow compaction mechanism
- Achieving zero-cost rebind (some cost is inevitable; goal is minimum viable rebind)
- Making checkpoints human-readable (they are machine artifacts)

## Constraints

- MUST NOT modify the live message chain — checkpoint is a parallel shadow artifact.
- MUST NOT trigger prompt cache invalidation during normal operation.
- Checkpoint production must be non-blocking (fire-and-forget background operation).
- Must work with the existing `filterCompacted` / `toModelMessages` pipeline.

## What Changes

- Checkpoint save: background snapshot to disk when tokens > threshold, tracking the message boundary.
- Checkpoint load: on rebind, read checkpoint and use as input base for prompt assembly.
- Prompt builder: when checkpoint exists and rebind is needed, build input from checkpoint + only post-checkpoint messages instead of all messages.
- Cleanup: remove stale checkpoint files when sessions are deleted or checkpoint is consumed.

## Capabilities

### New Capabilities

- **Rebind checkpoint**: operators can restart daemon without paying 850KB+ full-context rebind cost.
- **Background checkpoint save**: system maintains a restart-ready compact state without user action.

### Modified Capabilities

- **Rebind path**: uses checkpoint as input base instead of reconstructing from all messages.
- **Compaction trigger**: new threshold-based trigger independent of overflow.

## Impact

- Affected runtime modules: compaction.ts, prompt.ts, codex-websocket.ts (continuation state).
- Affected storage: new `rebind-checkpoint-{sessionId}.json` files in state directory.
- Affected operators: rebind payload size drops from 850KB to estimated < 100KB.

## Cost Triangle Analysis

Three costs are in tension — any compaction strategy must be evaluated against all three:

| Cost | Description |
|------|-------------|
| **Compaction cost** | Token/quota consumed by producing the checkpoint |
| **Rebind cost** | Payload size of full-context resend after restart |
| **Cache miss cost** | Prompt cache invalidation from modifying the live message chain |

| Strategy | Compaction | Rebind | Cache Miss | Verdict |
|----------|-----------|--------|------------|---------|
| No compact | 0 | High (850KB) | 0 | Restart kills quota |
| Frequent compact (modify chain) | Medium (LLM) | Low | **High** | Cache destruction |
| SharedContext snapshot (free) | 0 | Medium | 0 | **Quality unreliable** — pattern matching without LLM intelligence |
| **LLM shadow checkpoint** | **Low** (occasional) | **Low** | **0** | **Optimal** |

**Selected strategy: LLM shadow checkpoint.** An occasional LLM call produces a high-quality summary checkpoint saved to disk as a shadow artifact. The live message chain is never modified, preserving prompt cache. On restart, rebind uses the checkpoint + recent messages instead of full history.

**Economic test:** `compaction_cost < expected_rebind_cost × restart_probability`. One LLM summary call (~input tokens to read context + few hundred output tokens) is far cheaper than an 850KB rebind. Even if restart only happens once per session, the checkpoint pays for itself.

### Why SharedContext Snapshot Is Insufficient

SharedContext uses pure pattern matching (regex for "發現", "root cause", etc.) to extract goal/discoveries/state from assistant text. No LLM intelligence involved. System prompt does not mandate structured output for these patterns. Result: snapshot quality depends on whether the LLM happened to use matching keywords — unreliable as a rebind base.

## Planning Lessons

- Prompt cache hit rate is a first-class constraint — any compaction strategy must be evaluated against cache disruption.
- The cost triangle (compaction / rebind / cache miss) must be explicitly analyzed for every compaction strategy.
- "Free" does not mean "good enough" — SharedContext snapshot is free but unreliable. Occasional LLM cost for reliable quality is a better trade-off.
- Shadow artifacts (parallel to live chain, never modifying it) are the only way to avoid cache disruption.
