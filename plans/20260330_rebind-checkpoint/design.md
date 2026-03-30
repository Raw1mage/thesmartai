# Design

## Context

- Current rebind after daemon restart resends full message history (850KB+) because no compact checkpoint exists.
- `compactWithSharedContext()` exists but inserts a summary message into the live chain, breaking prompt cache.
- SharedContext snapshot is free (local, no LLM) and budget-controlled (~8K tokens).
- The incremental delta fix already reduced per-round payload from 107KB to 3KB, but rebind remains 850KB.

## Goals / Non-Goals

**Goals:**

- Keep a compact rebind base ready on disk at all times.
- Rebind uses checkpoint + recent messages instead of full history.
- Zero disruption to live conversation cache during normal operation.

**Non-Goals:**

- Replacing overflow compaction (that serves a different purpose).
- Achieving sub-10KB rebind (checkpoint itself has inherent size).
- Integrating `/responses/compact` in this iteration.

## Decisions

- Decision 1: Checkpoint is a SHADOW artifact — a separate file on disk, not a message in the session chain. This is the key difference from `compactWithSharedContext()` which inserts a summary message.
- Decision 2: Checkpoint is produced by an **LLM summarization call**, not by SharedContext pattern matching. SharedContext snapshot uses regex without LLM intelligence — quality is unreliable. An occasional LLM call is a better trade-off (low cost, high quality).
- Decision 3: Checkpoint contains LLM-produced summary + message boundary marker (`lastMessageId`). The boundary tells the rebind path where to split: checkpoint covers everything up to `lastMessageId`, only messages after that are "new".
- Decision 4: Rebind builds input as `[checkpoint-as-context-message, ...new-messages]` instead of `[all-messages]`. The checkpoint content is injected as a synthetic context message at the start, followed by only post-boundary messages.
- Decision 5: Checkpoint save is **low-frequency background** (not every round). Triggered when tokens > threshold AND sufficient rounds since last checkpoint. Cost is one LLM call per checkpoint, which is far less than an 850KB rebind.
- Decision 6: The live message chain is NEVER modified by checkpointing. Prompt cache stays intact. Only overflow compaction (existing, different concern) modifies the chain.
- Decision 7: The current `compactWithSharedContext()` rebind path (which inserts summary messages) should be replaced with checkpoint-based input assembly for the continuation invalidation case. Overflow compaction remains unchanged.

## Cost Triangle

| Cost | Without Checkpoint | With LLM Shadow Checkpoint |
|------|-------------------|---------------------------|
| Compaction | 0 | Low (occasional LLM summary) |
| Rebind | 850KB+ | Checkpoint + recent msgs (~100KB) |
| Cache Miss | 0 | 0 (shadow, no chain modification) |

**Economic test:** `checkpoint_cost < rebind_cost`. One LLM summary (read context + few hundred output tokens) << 850KB full-context rebind quota consumption.

## Data / State / Control Flow

### Checkpoint Save (background, low-frequency)

```
prompt.ts: round ends → tokens > 80K AND rounds since last checkpoint > N?
  → YES → saveRebindCheckpoint(sessionID, lastMessageId)
           → call LLM summarization agent (compaction model)
           → receive summary text
           → write { summary, lastMessageId, timestamp } to disk
           → background, does not block the conversation
  → NO  → skip
```

### Checkpoint Load (on rebind after restart)

```
prompt.ts: continuation invalidated flag set
  → loadRebindCheckpoint(sessionID) → { snapshot, lastMessageId } | null
  → if checkpoint exists:
      → filter messages: only messages AFTER lastMessageId
      → build input: [synthetic-context-from-snapshot, ...post-boundary-messages]
      → send to model (small payload)
      → delete old checkpoint file
  → if no checkpoint:
      → fall back to full message rebuild (existing behavior)
```

### Message Assembly on Rebind

```
Normal:  [msg1, msg2, ..., msg100]  → toModelMessages → 850KB input
Rebind:  [checkpoint-context, msg91, ..., msg100] → toModelMessages → ~100KB input
```

The `checkpoint-context` is a synthetic user message containing the SharedContext snapshot text, framed as "Here is the conversation summary so far". It replaces all pre-boundary messages.

## Risks / Trade-offs

- **LLM checkpoint cost**: Each checkpoint costs one LLM summarization call. Mitigated by low frequency (every N rounds, only when over threshold). Far cheaper than 850KB rebind.
- **Summary quality**: LLM summary is lossy by nature. Acceptable for rebind since post-boundary messages provide full recent detail. The summary only needs to carry enough context for the model to understand ongoing work.
- **Boundary staleness**: If checkpoint is old (many rounds since last save), the "new messages" portion grows and rebind payload increases. Mitigated by periodic refresh.
- **First-round cost**: The first round after restart uses the checkpoint, which is a different token sequence from what was cached. Cache miss is inevitable on restart regardless of checkpoint.
- **Subagent sessions**: Not checkpointed (short-lived, parent context handles continuity).
- **SharedContext fallback**: If LLM checkpoint fails (model unavailable), SharedContext snapshot can serve as a degraded fallback — better than 850KB full rebind, even if quality is unreliable.

## Critical Files

- `packages/opencode/src/session/compaction.ts` — checkpoint save/load, threshold check
- `packages/opencode/src/session/prompt.ts` — rebind assembly, checkpoint injection
- `packages/opencode/src/session/shared-context.ts` — snapshot source
- `packages/opencode/src/session/message-v2.ts` — message filtering for post-boundary messages
