# Observability — context-management

> Telemetry events, derived metrics, structured logs, and alerts for the
> 5-layer context-management subsystem. Each event maps to spec.md R-13
> and `data-schema.json#/definitions/CompactionEvent`.

---

## Events

### `compaction.event`

Emitted by `compaction.ts::runHybridLlmWithRecovery` after every
compaction event (success, fallback, or unrecoverable). Schema:
`data-schema.json#/definitions/CompactionEvent`.

**Required fields** (spec.md R-13): `eventId`, `sessionId`, `kind`,
`phase`, `internalMode`, `inputTokens`, `outputTokens`, `result`,
`latencyMs`, `emittedAt`.

**Optional fields**: `pinnedCountIn/Out`, `droppedCountIn`,
`recallCountIn`, `voluntary`, `costUsdEstimate`, `errorCode`.

**Emit timing**: synchronous before runloop continues to next round
(INV-7).

### `phase2_fired`

Sub-event of `compaction.event` with `phase=2`. Logged separately for
alerting because Phase 2 is expected to be near-zero-rate in healthy
operation (proposal §"Phase 2 semantics").

**Additional fields**:
- `triggerReason`: `"phase1_overflow"` | `"pinned_zone_over_cap"`
- `pinnedZoneSizeBeforeTokens`
- `phase1InputTokens` (if triggerReason=phase1_overflow)
- `phase1OutputTokens` (if triggerReason=phase1_overflow)

### `tool.output_truncated`

Emitted by Layer 2 (C6 ToolFramework) whenever `ctx.outputBudget` was
exceeded and the tool sliced its output.

**Fields**:
```json
{
  "sessionId": "<sid>",
  "toolName": "read|glob|grep|bash|webfetch|apply_patch|task|...",
  "toolCallId": "<tcid>",
  "naturalSizeTokens": <N>,
  "sliceTokens": <S>,
  "outputBudget": <B>,
  "hint": "<truncation hint string>"
}
```

### `recall.applied`

Emitted by `memory.ts::recallMessage` after a successful recall (single-
or cross-session).

**Fields**:
```json
{
  "sessionId": "<sid>",
  "recalledFromSession": "<sid_other> | null",
  "msgId": "<mid>",
  "recallSizeTokens": <N>,
  "wasIdempotentSkip": false | true
}
```

### `pin.applied` / `drop.applied`

Emitted by `OverrideParser` (C4) when a pin or drop marker is applied.

**Fields**:
```json
{
  "sessionId": "<sid>",
  "toolCallId": "<tcid>",
  "actor": "ai" | "human",
  "pinnedSizeTokens": <N>  // pin only
}
```

---

## Metrics

| Metric | Formula | Healthy band |
|---|---|---|
| `compaction.rate_per_session_per_hour` | count(`compaction.event`) / sessions / hour | < 5 (else G-13 runaway) |
| `phase2.fire_rate` | count(`phase2_fired`) / count(`compaction.event`) | < 0.01 (1%) |
| `compaction.fallback_rate` | count(events with `result=failed_then_fallback`) / count(`compaction.event`) | < 0.005 (0.5%) |
| `compaction.unrecoverable_rate` | count(events with `result=unrecoverable`) / count(`compaction.event`) | == 0 (any non-zero is investigation-worthy) |
| `compaction.latency.p50` / `p95` / `p99` | latencyMs distribution | p95 < 8000ms; p99 < 25000ms (TIMEOUT triggers at 30000) |
| `pin_density.per_session` | session.pinnedZoneTokens / session.totalContextTokens | p95 < 0.30 (cap is 0.30; over = forced Phase 2) |
| `voluntary_summarize.rate` | count(events with `voluntary=true`) / count(`compaction.event`) | post-merge baseline; G-12 retire threshold < 0.05 over 90 days |
| `tool.truncation_rate` | count(`tool.output_truncated`) / count(tool calls) | observe baseline; investigate per-tool spikes |
| `recall.usage` | count(`recall.applied` with wasIdempotentSkip=false) / sessions / day | observe baseline |
| `cache.hit_rate.utilisation_80_90_band` | provider-side prefix-cache hits at 80–90% utilisation | post-merge must NOT regress > 5pp vs pre-merge baseline (handoff.md stop gate 1) |
| `phase1.retry_succeeded_rate` | count(events with `phase=1` AND retry succeeded) / count(`phase=1` first attempts) | < 0.05 over 7-day window (else framing prompt drift) |

---

## Logs (human-readable, structured)

`info` level — per compaction:
```
[compaction] kind=hybrid_llm phase=1 mode=single-pass session=<sid>
  input_tokens=72341 output_tokens=28104 pinned_count=3 dropped_count=0
  recall_count=0 voluntary=false latency_ms=4231 result=success
```

`info` level — per Layer 2 truncation:
```
[tool] truncated tool=read session=<sid> call=<tcid>
  natural=120432 slice=49984 budget=50000
  hint="[... truncated; call read again with offset=49984 to continue]"
```

`warn` level — Phase 2 fired:
```
[compaction] phase2_fired session=<sid> reason=pinned_zone_over_cap
  pinned_size=78421 cap=60000 phase1_skipped=true
```

`warn` level — fallback applied:
```
[compaction] fallback session=<sid> error=E_HYBRID_LLM_FAILED
  http_status=429 attempts=2 fallback=truncate_journal_from_oldest
  rounds_dropped=4
```

`error` level — unrecoverable:
```
[compaction] unrecoverable session=<sid> after_phase2_total=205431
  per_request_budget=200000 system=2104 anchor=4892 current_round=198435
```

`info` level — Phase 1 retry succeeded (drift signal):
```
[compaction] phase1_retry_succeeded session=<sid>
  first_failure=size_overflow output_tokens=72103 target=60000
  retry_output_tokens=51022
```

---

## Alerts

### A1 — `phase2.fire_rate` over threshold

**Condition**: `phase2.fire_rate > 0.02` over 1 hour
**Severity**: warn
**Action**: investigate sessions with phase2_fired events; usually
indicates a session pinning aggressively or an unexpected workload pattern.
**Suggested response**: review pin density per session in offending
window; consider tightening `compaction.pinnedZone.maxTokensRatio`.

### A2 — `compaction.unrecoverable_rate` non-zero

**Condition**: any event with `result=unrecoverable` in the last 1 hour
**Severity**: page (because user is blocked)
**Action**: contact affected user; investigate session for content-size
> model capacity (single oversized current_round, system prompt bloat,
runaway anchor).

### A3 — `compaction.fallback_rate` over threshold

**Condition**: `compaction.fallback_rate > 0.02` over 1 hour
**Severity**: warn
**Action**: check provider health (rate limits, outages); if persistent,
ensure `compaction.fallbackProvider` is configured and reachable.

### A4 — `pin_density.per_session` outlier

**Condition**: any session with `pin_density > 0.50` for > 30 minutes
**Severity**: info
**Action**: review session AI behaviour for over-pinning; consider
guidance update in `agent-budget-guideline.md`.

### A5 — `cache.hit_rate.utilisation_80_90_band` regression

**Condition**: post-merge 7-day rolling hit rate regresses > 5pp vs
pre-merge baseline
**Severity**: page
**Action**: STOP further rollout; investigate cache placement law
violations (INV-1) — most likely a recent task accidentally mutated a
prompt prefix.

### A6 — `phase1.retry_succeeded_rate` over threshold

**Condition**: `phase1.retry_succeeded_rate > 0.05` over 7-day window
**Severity**: warn
**Action**: framing prompt drift signal; review `hybrid-llm-framing.md`
for prompt/contract mismatch with current provider behaviour. Consider
`amend` mode on DD-11 or hybrid-llm-framing.md.

---

## Dashboards (suggested layout)

**Compaction Overview** (per-session and aggregate):
- compaction rate (per hour, per session)
- phase distribution (Phase 1 vs Phase 2)
- result distribution (success / failed_then_fallback / unrecoverable)
- latency histograms (p50/p95/p99)
- voluntary vs forced ratio

**Layer 2 Tool Bounding**:
- truncation rate per tool
- top-N tools by total truncated tokens
- distribution of natural-vs-budget ratios

**Layer 5 Override Usage**:
- pin / drop / recall counts (last 24h)
- pin density per active session (top 20)
- recall hit rate (recovered content tokens)

**Cache Health**:
- prefix cache hit rate at utilisation bands [40-60, 60-80, 80-90, 90+]
- comparison against pre-merge baseline

---

## Retention

- Raw event stream: 30 days (covers G-12 / G-13 deferral telemetry
  windows in gaps.md and adequately seeds the post-merge alerting).
- Aggregated metrics: 1 year (cost/cache trend analysis).
- Per-session compaction event detail: cleared with the session itself.
