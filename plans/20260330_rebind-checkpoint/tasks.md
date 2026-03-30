# Tasks

## 1. Implement LLM Shadow Checkpoint Save

- [ ] 1.1 Create checkpoint summarization agent call: use compaction model to summarize current context into a compact summary string (background, non-blocking)
- [ ] 1.2 Update `saveRebindCheckpoint` to call LLM summarization and persist `{ summary, lastMessageId, timestamp }` to disk
- [ ] 1.3 Add SharedContext snapshot as degraded fallback when LLM summarization fails
- [ ] 1.4 Update `shouldRebindBudgetCompact` trigger: tokens > 80K AND rounds since last checkpoint > N
- [ ] 1.5 Update call site in prompt.ts to pass `lastMessageId` and trigger in background

## 2. Refactor Rebind Path to Use Checkpoint as Input Base

- [ ] 2.1 Replace the current `compactWithSharedContext` rebind path (inserts summary message into chain) with checkpoint-based input assembly
- [ ] 2.2 Add message filtering: given `lastMessageId`, return only messages that come AFTER it in the session
- [ ] 2.3 Build rebind input as `[synthetic-context-message-from-checkpoint-summary, ...post-boundary-messages]`
- [ ] 2.4 Ensure the synthetic context message is formatted so the model understands it as prior conversation summary

## 3. Checkpoint Cleanup

- [ ] 3.1 Delete checkpoint file after successful rebind (new continuation established)
- [ ] 3.2 Handle edge cases: checkpoint file already deleted, session deleted, concurrent access

## 4. Validate

- [ ] 4.1 Measure rebind payload size with checkpoint vs baseline (target < 200KB)
- [ ] 4.2 Verify cache hit rate during normal operation (target 97%+)
- [ ] 4.3 Verify fallback to full context when no checkpoint exists
- [ ] 4.4 Test restart → rebind → checkpoint consumed → new checkpoint saved cycle
- [ ] 4.5 Verify LLM checkpoint quality: rebind with summary produces coherent model behavior
