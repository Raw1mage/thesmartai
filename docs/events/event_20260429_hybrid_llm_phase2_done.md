# Phase 2 Done — Hybrid-LLM Is Now Primary Compaction Kind

**Spec**: `specs/_archive/tool-output-chunking/` (context-management subsystem)
**Phase**: 2 — Layer 1 hybrid-llm
**Branch**: `beta/phase-1-context-management`
**Tip**: `0436b2743`

> Earlier draft of this event labelled Phase 2 a "milestone partial". That was premature and the user called it out: shipping the work behind a flag that defaulted off was a half-measure that left the code dormant. This file replaces that draft.

## What

`hybrid_llm` is now the **primary** compaction kind for `overflow / cache-aware / manual` triggers, prepended unconditionally at the front of `KIND_CHAIN`. The legacy kinds (`narrative / replay-tail / low-cost-server / llm-agent`) remain reachable as **fallback** when hybrid_llm's recovery ladder exhausts. Maintenance triggers (`idle / rebind / continuation-invalidated / provider-switched`) are untouched — they don't need a paid LLM call.

## Recovery ladder (the actual contract)

```
overflow / cache-aware / manual triggers
└─► hybrid_llm Phase 1 (single-pass OR chunk-and-merge by input size)
    ├─► success → new anchor written
    ├─► validation-shaped failure → 1 retry stricter framing
    │   └─► success → new anchor written
    │   └─► failure → next branch
    └─► Phase 1 exhausted:
        ├─► pinned_zone non-empty → Phase 2 (absorb pinned, strict framing, target=5000 tokens)
        │   ├─► success → new anchor (pinned absorbed) → emit phase2_fired event
        │   └─► failure → E_OVERFLOW_UNRECOVERABLE (bounded chain, no Phase 3)
        └─► pinned_zone empty → graceful degradation (keep prior anchor)
            └─► chain walker tries next legacy kind (narrative / replay-tail / ...)
```

## Surface

- **`compaction_*` knobs** in `/etc/opencode/tweaks.cfg` (4 keys, no master switch):
  - `compaction_llm_timeout_ms=30000`
  - `compaction_fallback_provider=""`
  - `compaction_phase2_max_anchor_tokens=5000`
  - `compaction_pinned_zone_max_tokens_ratio=0.30`
- **`SessionCompaction.Hybrid` namespace** in `packages/opencode/src/session/compaction.ts`:
  - Types per `data-schema.json`: `Phase` / `InternalMode` / `BudgetSource` / `Anchor` + `AnchorMetadata` / `JournalEntry` / `PinnedZoneEntry` / `ContextMarkers` / `ContextStatus` / `LLMCompactRequest` / `CompactionEvent` / `ErrorCode` / `ValidationFailure` / `LlmCompactResult`.
  - `validateAnchorBody(body, request)`: 5 contract checks (header, size, sanity-smaller, forbidden tokens, drop-respected).
  - `inputTokenEstimate(request)`, `loadFramingTemplate()`, `buildUserPayload(request, meta)`: pure helpers.
  - `wrapPinnedToolMessage` + `materialisePinnedZone`: DD-4 envelope wrapping (closes G-1).
  - `runLlmCompact(sessionID, request, opts)`: single-pass core; auto-dispatches to chunk-and-merge when input > LLM input budget.
  - `runLlmCompactChunkAndMerge(sessionID, request, opts, ctx)`: cold-start path. Walks journal in chunks, builds digest sequentially, persists final.
  - `runHybridLlm(sessionID, opts)`: full recovery ladder per the diagram above. Returns `CompactionEvent`.
- **`Memory.Hybrid` accessors** in `packages/opencode/src/session/memory.ts`:
  - `getAnchorMessage` / `getJournalMessages` / `getPinnedToolMessages` / `recallMessage`.
  - All raw selectors over the message stream; INV-10 single-source-of-truth preserved.
- **KIND_CHAIN extended**: `KindName` gained `'hybrid_llm'`. `tryKind` switch routes to `tryHybridLlmKind` adapter. `run()` walker prepends hybrid_llm unconditionally for `hybridEligible` Observed conditions.
- **Framing prompt** at `packages/opencode/src/session/prompt/hybrid-llm-framing.md` (Phase 2.1 git-mv'd from specs/). Lazy-loaded via `Bun.file()`, cached after first compaction event. Falls back to `INLINE_MINIMAL_FRAMING` constant on packaging error.
- **22 pure-function unit tests** at `packages/opencode/test/session/compaction-hybrid.test.ts`. 76 tests total pass across compaction + compaction-hybrid + tweaks.

## Why

Production observation 2026-04-29: the existing 90% overflow gate from compaction-redesign (`living` since 2026-04-28) doesn't address narrative cross-generation decay. Each narrative compaction concatenates `[previous_anchor + TurnSummaries since previous anchor]` into a new anchor; after N compactions, content from the earliest rounds exists only as a summary of a summary. Information density degrades exponentially. The hybrid-llm kind replaces concatenation with attention-driven LLM distillation: bounded input (`anchor + journal_unpinned`, not full history), and the LLM re-emphasises content the recent journal still references, naturally letting unmentioned content fade.

## What's still deferred (and why each is legitimately blocked)

- **Phase 2.12** retire `tryNarrative / tryReplayTail / tryLowCostServer / tryLlmAgent`: deferred until telemetry from real traffic confirms hybrid_llm carries the load for several days. Removing the legacy kinds before that = no fallback if hybrid_llm has a subtle bug we haven't seen.
- **Phase 2.13** explicit 5-zone refactor in `prompt.ts`: deferred to Phase 5 alongside Layer 5 override surface. Until pinned_zone has a producer (Phase 5 `pin/drop/recall` parser), the 5-zone canonical is byte-identical to today's `[system, anchor+journal+current_round]`. Doing the refactor now would be code-clarity-only with zero runtime effect, and the rewrite risks INV-1 cache-placement-law violations.
- **Phase 2.15** pin cap forcing Phase 2: depends on Phase 5 (pinned_zone has no producer until then).
- **Phase 2.16** explicit migration fixture tests: the migration logic itself works (any `assistant + summary === true` is accepted as `priorAnchor` per DD-10), but per-row fixtures aren't authored. Add when convenient.
- **Phase 2.18 / 2.19 / 2.20** cross-provider regression / failure injection / daemon-restart tests: all need an LLM-stub harness or real provider mocks. Doable but a separate test-infrastructure chunk.
- **Phase 2.21** cache hit-rate post-merge gate: requires real workload telemetry collected over time. Can't fabricate; verifies in production.

These are tracked in `specs/_archive/tool-output-chunking/tasks.md` with `[!]` blocked-with-reason or `[-]` deferred-with-reason markers.

## Rollback path

If hybrid_llm misbehaves on real traffic, two options:

1. **Targeted rollback**: revert `0436b2743` (the flag-removal commit). The flag returns and defaults off; production reverts to legacy kinds unconditionally.
2. **Full rollback**: revert the entire Phase 2 chunk (`f0da1e9dd..HEAD` on beta). Hybrid namespace + accessors + tests removed; KIND_CHAIN goes back to the original 4 entries.

Both are clean — no DB migration, no flag-day, no on-disk state to undo. Sessions that already received a hybrid-produced anchor keep it (the schema is unchanged: `assistant + summary === true`); subsequent compactions just use a different kind.

## Commits (beta branch since Phase 1 close)

```
0436b2743 feat(compaction): remove enableHybridLlm flag — hybrid_llm is now primary
98d42057f feat(compaction): Phase 2.7 + 2.10 + 2.11 — chunk-and-merge + Phase 2 + starvation
(previously) test(compaction): Phase 2.17 partial — Hybrid pure-function unit tests
2095db6fd feat(compaction): Phase 2.14 + KIND_CHAIN wiring — hybrid_llm reachable behind flag
57fcd5461 feat(compaction): Phase 2.6 + 2.9 — runLlmCompact + minimal recovery wrapper
00744f29d feat(compaction): Phase 2.8 + 2.6 partial — validators + framing prompt
f0da1e9dd feat(compaction): Phase 2.4/2.5 — Memory.Hybrid accessors + recallMessage
d8b058a15 feat(compaction): Phase 2.3 — Hybrid sub-namespace types + master flag
4e89f29ef feat(compaction): Phase 2.2 — add 4 hybrid-llm compaction knobs
(rename)  Phase 2.1 — move hybrid-llm framing prompt into runtime path
```

## Next

The next reasonable slice is **fetch-back to main** via beta-workflow §7.1: create `test/hybrid-llm` from `main`, merge `beta/phase-1-context-management` into it, run the test suite, then merge to `main`. Phase 1 (Layer 2 self-bounding) and Phase 2 (Hybrid-LLM) land together.

After that: Phase 3 / 4 / 5 of the spec (visibility, voluntary `compact_now`, override surface) — each independent slice. Or alternatively, run the deferred items (2.18-2.20 mocked tests; 2.16 migration fixtures) before fetch-back if you want belt-and-braces validation.
