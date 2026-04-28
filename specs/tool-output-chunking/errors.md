# Errors — context-management

> Catalogued error codes emitted by the context-management subsystem. Each
> entry: code, user-visible message, structured fields, recovery strategy,
> emitting layer, and the test fixture that exercises it.

---

## Error Catalogue

### E_HYBRID_LLM_FAILED

**Emitted by**: `compaction.ts::runHybridLlmWithRecovery` (DD-6)
**Cause**: Provider returned a non-success HTTP status (e.g. 429, 5xx) on
both attempt 1 and attempt 2 (after stricter-framing retry). If
`compaction.fallbackProvider` is configured, also after the fallback
provider attempt failed.

**User-visible message** (surfaced via TUI / admin event log):
```
Context compaction failed (provider error). Continuing with truncated
journal — earliest <K> rounds dropped from working memory. Original
content remains on disk and can be recalled.
```

**Structured fields** (logged + telemetry):
```json
{
  "code": "E_HYBRID_LLM_FAILED",
  "sessionId": "<sid>",
  "phase": 1 | 2,
  "provider": "<provider>:<model>",
  "httpStatus": 429,
  "attempts": 2,
  "fallbackProviderTried": false | true,
  "fallbackApplied": "keepPriorAnchor + truncateJournalFromOldest",
  "journalRoundsDropped": <K>
}
```

**Recovery**: Graceful degradation per DD-6 step 4 — keep prior anchor;
truncate journal from the oldest-round end until the prompt fits the
per-request budget. Runloop continues. The dropped rounds remain
recoverable via `recall(msgId)` from disk (DD-7).

**Responsible layer**: C3 HybridCompactor (compaction.ts).
**Test fixture**: TV-10 (test-vectors.json).

---

### E_HYBRID_LLM_TIMEOUT

**Emitted by**: `compaction.ts::runHybridLlmWithRecovery` (DD-6)
**Cause**: A single `LLM_compact` HTTP request exceeded
`compaction.llmTimeoutMs` (default 30000). Aborted before the provider
responded.

**User-visible message**:
```
Context compaction timed out (>30s). Continuing with truncated journal
— earliest <K> rounds dropped from working memory.
```

**Structured fields**:
```json
{
  "code": "E_HYBRID_LLM_TIMEOUT",
  "sessionId": "<sid>",
  "phase": 1 | 2,
  "provider": "<provider>:<model>",
  "timeoutMs": 30000,
  "attempts": <which attempt timed out>,
  "fallbackApplied": "keepPriorAnchor + truncateJournalFromOldest",
  "journalRoundsDropped": <K>
}
```

**Recovery**: Same graceful degradation as `E_HYBRID_LLM_FAILED`. The
in-flight request is aborted via `AbortController`; no half-applied
anchor is written.

**Responsible layer**: C3 HybridCompactor.
**Test fixture**: TV-11.

---

### E_HYBRID_LLM_MALFORMED

**Emitted by**: `compaction.ts::runHybridLlmWithRecovery` (DD-6)
**Cause**: `LLM_compact` returned a response that fails one of the
output validators in `hybrid-llm-framing.md` §"Output validation":
- header line missing or malformed
- output size > input size (sanity violation)
- output size > `targetTokens * 1.10` (slack)
- forbidden tokens present (`<thinking>`, `<scratchpad>`,
  `<|im_start|>`, `tool_calls` JSON shapes)
- DROP_MARKERS contained an id whose verbatim content still appears

After 2 attempts (one with stricter framing) the validator still fails.

**User-visible message**:
```
Context compaction returned malformed output from <provider>. Continuing
with truncated journal — earliest <K> rounds dropped from working memory.
This usually indicates the model is misbehaving for this prompt; try
switching provider or starting a new session.
```

**Structured fields**:
```json
{
  "code": "E_HYBRID_LLM_MALFORMED",
  "sessionId": "<sid>",
  "phase": 1 | 2,
  "provider": "<provider>:<model>",
  "validationFailureReason": "header_missing" | "size_overflow" | "sanity_smaller" | "forbidden_token:<which>" | "drop_violated:<id>",
  "attempts": 2,
  "fallbackApplied": "keepPriorAnchor + truncateJournalFromOldest",
  "journalRoundsDropped": <K>
}
```

**Recovery**: Same graceful degradation as above.

**Responsible layer**: C3 HybridCompactor (validator) → falls through to
fallback path.
**Test fixture**: TV-12.

---

### E_OVERFLOW_UNRECOVERABLE

**Emitted by**: `compaction.ts::runPhase2` (DD-9, INV-6)
**Cause**: Phase 2 successfully completed but the resulting prompt
`[system, anchor_new, current_round]` is still over per-request budget.
There is no Phase 3 by design — the chain is bounded at 2.

**User-visible message** (highest priority; shown directly to user, not
just logged):
```
This session has structural bloat that cannot be compacted within the
model's budget. The most recent round alone, plus the system prompt, is
larger than what the model can accept.

Remediation options:
1. Start a new session (recommended).
2. Open the admin panel → Context view → drop pinned items, then retry.
3. If the problem is in current_round itself (e.g., very large input
   message), shorten or split the message.
```

**Structured fields**:
```json
{
  "code": "E_OVERFLOW_UNRECOVERABLE",
  "sessionId": "<sid>",
  "perRequestBudget": <N>,
  "afterPhase2Tokens": {
    "system": <S>,
    "anchor": <A>,
    "currentRound": <C>,
    "total": <S+A+C>
  },
  "remediationHint": "start_new_session"
}
```

**Recovery**: Runloop SURFACES this error to the user via the active
session UI; the next user input is rejected with the same message until
the user takes a remediation action. No automatic recovery — the
condition genuinely indicates content-size > model capacity, and silent
recovery would be data loss.

**Responsible layer**: C3 HybridCompactor (Phase 2 fit check) → Runloop
(surface to user).
**Test fixture**: TV-5.

---

### (Internal, not user-facing) — Validator-rejected Phase 1 retry

Not a top-level error code. Represents the intermediate state where
Phase 1's first attempt failed validation but the stricter retry
succeeded. Logged at `info` level, not surfaced to user, but counted in
telemetry as `phase1_retry_succeeded`.

Used to monitor framing-prompt quality drift over time. If
`phase1_retry_succeeded / phase1_first_attempt > 5%` over a 7-day
window, treat as a signal that the framing prompt needs revision (likely
`amend` mode on DD-3 / DD-11 or hybrid-llm-framing.md).

---

### Error code → recovery summary

| Code | Recoverable? | Runloop continues? | Session usable after? |
|---|---|---|---|
| `E_HYBRID_LLM_FAILED` | Yes (degraded) | Yes | Yes; recall() can recover dropped content |
| `E_HYBRID_LLM_TIMEOUT` | Yes (degraded) | Yes | Yes; same as above |
| `E_HYBRID_LLM_MALFORMED` | Yes (degraded) | Yes | Yes; same as above |
| `E_OVERFLOW_UNRECOVERABLE` | No (user action required) | No (next input rejected) | Only after remediation |
