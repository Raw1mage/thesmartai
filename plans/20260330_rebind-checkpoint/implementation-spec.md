# Implementation Spec

## Goal

- Make daemon restart rebind use a pre-built checkpoint (~100KB) instead of full message history (850KB+), without disrupting the live conversation's prompt cache.

## Scope

### IN

- Checkpoint save: background LLM summarization call + message boundary marker to disk
- Checkpoint load: read checkpoint on rebind and filter messages to post-boundary only
- Prompt builder: inject checkpoint summary as synthetic context + append only new messages
- Checkpoint cleanup: delete after successful rebind consumption
- Threshold trigger: save when tokens > 80K AND sufficient rounds since last checkpoint
- SharedContext snapshot as degraded fallback when LLM is unavailable

### OUT

- Server-side `/responses/compact` integration (future iteration)
- Overflow compaction changes
- Subagent checkpoint
- Live message chain modification

## Assumptions

- LLM summarization produces sufficient quality for rebind context (post-boundary messages fill in recent detail).
- The message boundary marker (`lastMessageId`) reliably identifies the split point between checkpoint-covered and new messages.
- Background LLM checkpoint call does not compete for quota in a way that blocks the user's conversation (can use a different model or low-priority account).

## Stop Gates

- Stop if SharedContext snapshot is empty or missing for sessions that should have one — indicates the snapshot infrastructure is broken.
- Stop if rebind with checkpoint produces model errors (e.g., tool calls referencing context only in pre-boundary messages) — indicates the boundary split is too aggressive.
- Stop if checkpoint file I/O introduces measurable latency in the prompt loop.

## Critical Files

- `packages/opencode/src/session/compaction.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/message-v2.ts`

## Structured Execution Phases

- Phase 1: Implement LLM shadow checkpoint save. Call compaction agent in background, save summary + `lastMessageId` boundary to disk. SharedContext snapshot as fallback.
- Phase 2: Refactor rebind path in prompt.ts to use checkpoint as input base. Instead of inserting a summary message into the chain (which breaks cache), filter messages to post-boundary only and prepend checkpoint summary as synthetic context.
- Phase 3: Add checkpoint cleanup after successful rebind consumption. Delete the checkpoint file once a new continuation is established.
- Phase 4: Validate by measuring rebind payload size with and without checkpoint. Verify cache hit rate is unaffected during normal operation.

## Validation

- Measure rebind payload size: must be < 200KB with checkpoint (vs 850KB+ baseline).
- Verify prompt cache hit rate stays at 97%+ during normal operation with background checkpoint saves.
- Verify `rebind-checkpoint-{sessionId}.json` contains `snapshot`, `lastMessageId`, `timestamp` fields.
- Verify stale checkpoint files are removed after successful rebind.
- Verify fallback to full context works when no checkpoint exists.

## Handoff

- Build agent must read this spec first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding.
- Build agent must materialize runtime todo from tasks.md.
- Build agent must prefer delegation-first execution when the task slice can be safely handed off.
