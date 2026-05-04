# Errors — compaction-redesign

## Error Catalogue

Every error code used at runtime must appear here with its canonical message,
triggering condition, recovery strategy, and responsible layer.

- **COMPACT_KIND_CHAIN_EXHAUSTED** — every kind in `KIND_CHAIN[observed]` was
  attempted; none succeeded.
  - **Message**: "Compaction chain exhausted for observed=<observed>; no kind produced a usable summary."
  - **Trigger**: `run()` walked the full chain for the given `observed`
    value with no kind returning summary text.
  - **Recovery**: return `"stop"` from `run()`; runloop continues without
    a fresh anchor (next iteration will re-evaluate). For `observed ∈
    {rebind, continuation-invalidated, provider-switched}`, this means the
    paid kinds were intentionally not in the chain — log warn and continue.
  - **Layer**: `compaction.ts` `SessionCompaction.run`

- **COMPACT_BUDGET_OVERFLOW** — narrative summary text exceeds 30% of active
  model context budget.
  - **Message**: "Narrative snapshot is <est> tokens, exceeds 30% budget of <budget> tokens for model <id>; falling through to next kind."
  - **Trigger**: kind=narrative, `Math.ceil(snap.length / 4) > Math.floor((model.limit.context || 0) * 0.3)`
  - **Recovery**: log info, fall through to next kind in chain (per
    AGENTS.md rule 1, must be a fail-loud transition not silent skip).
  - **Layer**: `memory.ts` Narrative executor

- **COMPACT_LEGACY_SHIM_USED** — deprecated API surface invoked.
  - **Message**: "Deprecated <api> called; migrate to <new-api>."
  - **Trigger**: any function in `compaction-shims.ts` is called.
  - **Recovery**: shim delegates to new API; logs warn so callers surface
    in CI grep before next-release removal.
  - **Layer**: `compaction-shims.ts` (every shim)

- **COMPACT_PROVIDER_SWITCH_NO_NARRATIVE** — provider switch detected but
  Memory has no narrative content available.
  - **Message**: "Provider switch from <old> to <new> but Memory has no turnSummaries; cannot construct provider-agnostic anchor."
  - **Trigger**: `observed=provider-switched`, kind chain `[narrative,
    schema]` both unavailable.
  - **Recovery**: return `"stop"`; provider switch must wait until narrative
    accumulates (typically one user turn). Fail loud — the next call
    against the new provider with no anchor would inevitably tool-format
    error.
  - **Layer**: `compaction.ts` `SessionCompaction.run`

- **MEMORY_LEGACY_FALLBACK_FAILED** — read fell back to legacy path but
  legacy data was malformed.
  - **Message**: "Memory.read fallback to legacy <path> for session <sid> failed: <err>."
  - **Trigger**: new-path empty, legacy SharedContext or rebind-checkpoint
    file unreadable / wrong shape.
  - **Recovery**: return empty SessionMemory; do NOT throw. Subsequent
    runloop iteration will treat session as fresh.
  - **Layer**: `memory.ts` `Memory.read`

- **MEMORY_TURN_SUMMARY_APPEND_FAILED** — Storage write of new TurnSummary
  failed.
  - **Message**: "Failed to persist TurnSummary for session <sid>: <err>."
  - **Trigger**: Storage backend error during `Memory.appendTurnSummary`.
  - **Recovery**: log error, do NOT block runloop return. The capture is
    fire-and-forget; missing one TurnSummary degrades fidelity but does
    not break correctness. Raw-tail fallback still covers crash recovery.
  - **Layer**: `prompt.ts` runloop exit handler

- **COMPACT_PLUGIN_HOOK_FAILED** — `session.compact` plugin invocation
  threw or returned malformed data.
  - **Message**: "Plugin session.compact failed: <err>; falling through to LLM agent."
  - **Trigger**: kind=low-cost-server executor's plugin call rejected,
    timed out, or returned non-conforming `compactedItems`.
  - **Recovery**: log warn, fall through to next kind (LLM agent).
    Behaviour matches existing `tryPluginCompaction` failure handling.
  - **Layer**: `compaction.ts` Low-cost-server executor

## Error Code Format

- UPPER_SNAKE_CASE, domain-prefixed (`COMPACT_*`, `MEMORY_*`).
- Codes are stable; messages may be revised (with `[SUPERSEDED]` marker
  in history if changed).

## Recovery Strategies

| Strategy | When |
|---|---|
| `fall-through` | Kind chain transition: log info, proceed to next kind in `KIND_CHAIN[observed]` |
| `stop-runloop` | `run()` returns `"stop"`; outer runloop honours and exits cleanly |
| `degrade-silently-then-log` | Memory persistence write failure: do not block runtime, log error for offline triage |
| `delegate-deprecated` | Shim invoked: forward to new API + log warn |

Every error code above maps to exactly one strategy.
