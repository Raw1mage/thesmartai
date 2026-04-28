# Phase 2 Milestone — Hybrid-LLM Phase 1 Path Reachable Behind Flag

**Spec**: `specs/tool-output-chunking/` (context-management subsystem)
**Phase**: 2 — Layer 1 hybrid-llm + retire kind chain (PARTIAL — see "What's not done")
**Branch**: `beta/phase-1-context-management`
**Tip**: `2095db6fd` (code) + tests at HEAD
**Master flag**: `compaction_enable_hybrid_llm` in `/etc/opencode/tweaks.cfg`, **default off**

## What

The hybrid-llm compaction kind is now reachable end-to-end on opt-in sessions. When the master flag is on, an `overflow / cache-aware / manual` trigger fires `tryHybridLlmKind`, which builds an `LLMCompactRequest` from `Memory.Hybrid` accessors, dispatches a single-pass `runLlmCompact` LLM round through `SessionProcessor`, validates the returned anchor body against `hybrid-llm-framing.md` §"Output validation", retries once with stricter framing on validation failure, and falls through to the next kind in the chain on persistent failure. Existing kinds remain reachable as fallback; production behaviour with the flag default-off is unchanged.

This is the first slice that actually exercises the new mechanism end-to-end. Prior commits in Phase 2 added types + accessors + validators + framing prompt loading + the recovery wrapper, all dormant until KIND_CHAIN wiring.

## Surface

- **Master flag**: `compaction_enable_hybrid_llm=0|1` in tweaks.cfg. Default 0. When 1, hybrid_llm prepends to chains for `hybridEligible` Observed conditions: `overflow / cache-aware / manual`. Maintenance triggers (`idle / rebind / continuation-invalidated / provider-switched`) untouched (no paid LLM call wanted there).
- **`SessionCompaction.Hybrid` namespace** in `packages/opencode/src/session/compaction.ts`:
  - Types per `data-schema.json`: `Phase` / `InternalMode` / `BudgetSource` / `Anchor` + `AnchorMetadata` / `JournalEntry` / `PinnedZoneEntry` / `ContextMarkers` / `ContextStatus` / `LLMCompactRequest` / `CompactionEvent` / `ErrorCode` / `ValidationFailure` / `LlmCompactResult`.
  - `validateAnchorBody(body, request)`: 5 contract checks (header, size, sanity-smaller, forbidden tokens, drop-respected).
  - `inputTokenEstimate(request)`: char/4 estimator over priorAnchor + journal + pinned_zone.
  - `loadFramingTemplate()`: lazy + cached, reads `packages/opencode/src/session/prompt/hybrid-llm-framing.md` via `Bun.file()`. Falls back to `INLINE_MINIMAL_FRAMING` constant on packaging error.
  - `buildUserPayload(request, meta)`: structured META + PRIOR_ANCHOR + JOURNAL + optional DROP_MARKERS + optional PINNED_ZONE block + produce-now imperative.
  - `wrapPinnedToolMessage(toolPart, sourceMessage, opts?)`: DD-4 envelope wrapper — synthesised user-role message with `[Pinned earlier output] tool '<name>' (round <K>, tool_call_id=<TID>) returned:` header (closes G-1).
  - `materialisePinnedZone(sources, opts?)`: pure mapper over `getPinnedToolMessages` output.
  - `runLlmCompact(sessionID, request, opts)`: single-pass core. Mirrors `runLlmCompactionAgent`'s SessionProcessor pattern. Returns `LlmCompactResult` discriminated union.
  - `runHybridLlm(sessionID, opts)`: recovery wrapper — 1 retry with stricter framing on validation-shaped failure → graceful degradation (keep prior anchor) → `CompactionEvent`.
- **`Memory.Hybrid` accessors** in `packages/opencode/src/session/memory.ts`:
  - `getAnchorMessage(sid, messages?)` → `MessageV2.WithParts | null`
  - `getJournalMessages(sid, {dropMarkers?, includePreAnchor?})` → `MessageV2.WithParts[]` (adjacency invariant preserved when filtering)
  - `getPinnedToolMessages(sid, pinnedIds, messages?)` → `[{message, toolPart}]` (deterministic chronological order)
  - `recallMessage(sid, msgId)` → `MessageV2.WithParts | null` (DD-7 / INV-9; cross-session via sessionID arg per DD-8)
- **KIND_CHAIN extended**: `KindName` gained `'hybrid_llm'`. `tryKind` switch routes to `tryHybridLlmKind`. `run()` walker prepends hybrid_llm to the chain when flag on.
- **5 tweaks knobs** total for compaction (in addition to enableHybridLlm): `llm_timeout_ms=30000`, `fallback_provider=""`, `phase2_max_anchor_tokens=5000`, `pinned_zone_max_tokens_ratio=0.30`. Sync accessor `Tweaks.compactionSync()`.
- **Framing prompt** at runtime path `packages/opencode/src/session/prompt/hybrid-llm-framing.md` (Phase 2.1 git-mv'd from specs/).
- **22 pure-function unit tests** at `packages/opencode/test/session/compaction-hybrid.test.ts`.

## Why

Production observation 2026-04-29: the existing 90% overflow gate from compaction-redesign (`living` since 2026-04-28) doesn't address narrative cross-generation decay. Each narrative compaction concatenates `[previous_anchor + TurnSummaries since previous anchor]` into a new anchor; after N compactions, content from the earliest rounds exists only as a summary of a summary. Information density degrades exponentially. The hybrid-llm kind replaces concatenation with attention-driven LLM distillation: input is bounded (`anchor + journal_unpinned`, not full history) and the LLM re-emphasises content the recent journal still references, naturally letting unmentioned content fade.

## Why this scope (and what's deferred)

Phase 2 was originally 23 tasks. A flag-gated dual-path strategy was chosen over big-bang rewrite because:
- `compaction-redesign` is `living` and production traffic depends on it.
- `INV-1` cache placement law is enforced by byte-identity; any byte-layout change to `[system, anchor]` mid-window breaks codex prefix cache.
- `DD-10` migration matrix: live sessions on disk with old narrative-produced anchors must keep parsing.
- `proposal.md` itself recommends opt-in flag for early validation.

So the actual landing in this milestone is the **minimal coherent end-to-end path**: types + accessors + validators + framing + single-pass core + minimal recovery + KIND_CHAIN wiring + tests. The hybrid_llm kind works for a session that has flag-on, an anchor (or no anchor with small input), no pinned content, and a model whose context can fit a single-pass call.

## What's not done in this milestone (tracked deferred)

- **Phase 2.7 chunk-and-merge**: cold-start path on legacy 1000-round sessions with no anchor + input > LLM input budget. `runLlmCompact` returns `chunk_and_merge_unimplemented` and graceful degradation catches; the runloop falls through to narrative which handles such sessions. Pick up after the simpler path proves out.
- **Phase 2.10 Phase 2 absorb-pinned-zone**: requires pinned_zone to have a producer (Phase 5 Layer 5 override surface). Until then, Phase 2 path code is unreachable.
- **Phase 2.11 starvation `E_OVERFLOW_UNRECOVERABLE`**: depends on 2.10.
- **Phase 2.13 buildPrompt 5-zone explicit refactor**: deferred to Phase 5. Until pinned_zone is non-empty, the 5-zone canonical layout is byte-identical to today's `[system, anchor+journal+current_round]`. Doing the explicit zone refactor now would be code-clarity-only with no runtime effect, and the rewrite risks INV-1 cache-placement-law violations.
- **Phase 2.15 pin cap forcing Phase 2**: depends on 2.10.
- **Phase 2.16 explicit migration fixture tests**: the migration logic itself works (any `assistant + summary === true` is accepted as `priorAnchor` per DD-10), but per-row fixtures aren't yet authored.
- **Phase 2.18 cross-provider regression**: needs LLM stub harness.
- **Phase 2.19 failure injection**: needs LLM stub harness.
- **Phase 2.20 daemon-restart**: needs daemon-spawn integration test.
- **Phase 2.21 cache hit-rate post-merge gate**: requires real workload telemetry; deferred to post-merge with flag default-off until proven.
- **Phase 2.12 retire legacy kinds (`tryNarrative` / `tryReplayTail` / `tryLowCostServer` / `tryLlmAgent`)**: explicitly deferred until flag default flips on. Removing them now while flag is off would leave production with no compaction at all.

These open items live in `specs/tool-output-chunking/tasks.md` with `[!]` blocked-with-inline-reason markers. They form a coherent Phase 2 follow-up chunk for a future session.

## Loop / process notes

This phase was driven in normal batched turns after the user halted an earlier ScheduleWakeup loop. Each batch landed one logical chunk (foundation → validators+framing → runLlmCompact+wrapper → KIND_CHAIN+pinned-envelope → tests). The flag-gated strategy turned a "rewrite the world" risk into a "ship a dormant alternate path" risk. The deferred items are not blocked by missing design — they are blocked by intentional ordering (prove the simpler path first) or external dependencies (Phase 5 Layer 5; LLM stub harness; real telemetry).

## Commits (beta branch since Phase 1 close)

```
HEAD test(compaction): Phase 2.17 partial — Hybrid pure-function unit tests
2095db6fd feat(compaction): Phase 2.14 + KIND_CHAIN wiring — hybrid_llm reachable behind flag
57fcd5461 feat(compaction): Phase 2.6 + 2.9 — runLlmCompact + minimal recovery wrapper
00744f29d feat(compaction): Phase 2.8 + 2.6 partial — validators + framing prompt
f0da1e9dd feat(compaction): Phase 2.4/2.5 — Memory.Hybrid accessors + recallMessage
d8b058a15 feat(compaction): Phase 2.3 — Hybrid sub-namespace types + master flag
4e89f29ef feat(compaction): Phase 2.2 — add 4 hybrid-llm compaction knobs
(rename)  Phase 2.1 — move hybrid-llm framing prompt into runtime path
```

## Next

To prove the path on real traffic before flipping the default:
1. Set `compaction_enable_hybrid_llm=1` in `/etc/opencode/tweaks.cfg` on a non-production daemon.
2. Restart the daemon.
3. Observe `[compaction] hybrid_llm compaction succeeded` and `[compaction] hybrid_llm failed_then_fallback` log lines over a few sessions. Cache hit-rate at 80–90% utilisation must not regress > 5pp vs the baseline (handoff.md Stop Gate 1).
4. If quality regresses, flip flag back to 0 and the legacy chain takes over immediately — no migration needed.

Phase 2 follow-up (the `[!]` deferred items) is the next coherent slice if telemetry proves correctness; otherwise it goes into a "Phase 2 hardening" follow-up after the framing prompt + validator contract is iterated on.
