# Tasks — compaction-redesign

Phases follow design.md "Migration Sequence". Each phase is independently
reviewable and rolls back cleanly without the next.

## 1. Memory module skeleton + Storage path

- [x] 1.1 Create `packages/opencode/src/session/memory.ts` with `Memory` namespace skeleton (no consumers yet)
- [x] 1.2 Define `SessionMemory`, `TurnSummary` types per `data-schema.json`
- [x] 1.3 Implement `Memory.read(sid)`: returns SessionMemory; falls back to legacy SharedContext + checkpoint per DD-3
- [x] 1.4 Implement `Memory.write(sid, mem)`: writes to `Storage` key `session_memory/<sid>`
- [x] 1.5 Implement `Memory.appendTurnSummary(sid, ts)`: append + bump version + persist
- [x] 1.6 Implement `Memory.markCompacted(sid, {round, timestamp})` for cooldown source-of-truth
- [x] 1.7 Unit test: read/write round-trip; legacy fallback projects SharedContext.Space → SessionMemory shape correctly

## 2. Memory render functions

- [x] 2.1 Implement `Memory.renderForLLM(sid)`: compact provider-agnostic plain text from turnSummaries + auxiliary metadata
- [x] 2.2 Implement `Memory.renderForHuman(sid)`: timeline form with turn boundaries, decisions, file/action chronology
- [x] 2.3 Unit test: both render functions on a populated SessionMemory produce syntactically distinct strings (R-8 acceptance)
- [x] 2.4 Unit test: renderForLLM stays under 30% of typical model context (sanity check on default budget)

## 3. TurnSummary capture at runloop exit

- [x] 3.1 Add capture call at `prompt.ts:1230` (`exiting loop` site): read `lastAssistant` final text part, build TurnSummary
- [x] 3.2 Capture is fire-and-forget (`Memory.appendTurnSummary(...).catch(...)`); does not block runloop return
- [x] 3.3 Skip capture if `lastAssistant` is null or has no text part (e.g. error exit)
- [~] 3.4 Manual smoke deferred to phase 11 (acceptance): requires daemon restart to exercise; unit-tested via `prompt.turn-summary-capture.test.ts` instead

## 4. Single entry point `SessionCompaction.run`

- [x] 4.1 Define `RunInput` / `RunResult` types per data-schema.json
- [x] 4.2 Define `KIND_CHAIN: Record<Observed, KindStep[]>` table literal in `compaction.ts`
- [x] 4.3 Define `INJECT_CONTINUE: Record<Observed, boolean>` table literal
- [x] 4.4 Implement `Cooldown.shouldThrottle(sid, currentRound, threshold)` reading `Memory.lastCompactedAt`
- [x] 4.5 Implement `SessionCompaction.run(input)`: cooldown check → walk chain → write Anchor → mark compacted; emit `log.info` per AGENTS.md rule 1 on every kind transition
- [x] 4.6 Unit test: `run({observed: "rebind"})` never appends synthetic Continue (R-6 acceptance)
- [x] 4.7 Unit test: `run({observed: "manual"})` with non-empty Memory returns "continue" without API call (R-4 acceptance)
- [x] 4.8 Unit test: `run({observed: "provider-switched"})` rejects kinds 3-5 (R-5 acceptance)

## 5. Executor implementations

- [x] 5.1 Narrative executor (C5): reads `Memory.renderForLLM`, budget-checks ≤ 30%, calls anchor-write helper *(done in phase 4)*
- [x] 5.2 Schema executor (C6): reads legacy `SharedContext.snapshot`, calls anchor-write helper (used only when narrative empty)
- [x] 5.3 Replay-tail executor (C7): reads last N raw rounds from message stream, serializes as plain text, calls anchor-write helper
- [x] 5.4 Low-cost-server executor (C8): de-coupled from legacy `tryPluginCompaction` (own helper `buildConversationItemsForPlugin`); gated on provider supporting `session.compact` hook
- [~] 5.5 LLM-agent executor (C9): stub for now; full extraction from legacy `process()` deferred to phase 6+ with runloop wiring
- [x] 5.6 Unit test per executor: schema success/empty/over-budget; replay-tail success/over-budget; low-cost-server success/plugin-null; combined 23 tests pass

## 6. Runloop state-driven evaluation

- [x] 6.1 Implement `deriveObservedCondition(session)` in `prompt.ts` per design.md pseudocode
- [~] 6.2 Wire NEW path before legacy rebind branch (transitional bridge, fall-through to legacy when run returns "stop"); legacy branch is removed in phase 7 after llm-agent extraction
- [~] 6.3 Wire NEW path before legacy overflow / cache-aware branch (same bridge pattern)
- [~] 6.4 Wire NEW path before legacy compaction-request task branch (same bridge pattern). `Memory.requestCompaction` retained.
- [x] 6.5 Verify single `run()` call per iteration: deriveObservedCondition is invoked once and only one `observed` value is returned. Cooldown gate inside run() prevents same-iteration double-fire.
- [x] 6.6 Unit test: deriveObservedCondition fixtures (14 cases) cover null / manual / provider-switched / rebind / overflow / cache-aware / parentID-skip / cooldown-skip / priority ordering. findMostRecentAnchor (3 cases).

## 6b. State-driven extension (added 2026-04-27, DD-11 + DD-12)

- [ ] 6b.1 Add `continuationInvalidatedAt: number | null` field to `Session.execution` schema (DD-11). Storage migration: existing executions read as `null`.
- [ ] 6b.2 Replace `compaction.ts:36` Bus listener body: stop calling `markRebindCompaction(sid)`; instead `Session.updateExecution({sessionID, continuationInvalidatedAt: Date.now()})`.
- [ ] 6b.3 Extend `deriveObservedCondition` to read `session.execution.continuationInvalidatedAt` and return `"continuation-invalidated"` when timestamp newer than lastAnchor.time.created. Insert priority between "manual" and "provider-switched".
- [ ] 6b.4 Drop `if (input.parentID) return null` from `deriveObservedCondition` (DD-12). Narrow if needed: subagents skip only `"manual"` (no UI surface); all other observed values fire.
- [ ] 6b.5 Audit phase 6 transitional flag drain — when run() handles a subagent rebind, must not double-drain something processor.ts will set on a future iteration.
- [ ] 6b.6 Unit tests: continuation-invalidated state-driven priority; subagent rebind via new path; subagent overflow uses subagent's own Memory; sequence S8/S9 fixtures.

## 7. Remove flag-based plumbing

> Phase 7b (LLM-agent extraction) **must complete first**. Without it, deleting the legacy compaction-request branch in prompt.ts removes the only LLM-agent fallback path, regressing empty-Memory `/compact` sessions.

## 7b. LLM-agent extraction (added 2026-04-27 mid-implementation; precedes phase 7)

- [ ] 7b.1 Read `SessionCompaction.process()` carefully and identify the LLM-round core (post-`tryPluginCompaction`, the SessionProcessor.create + processor.process block plus prompt assembly).
- [ ] 7b.2 Extract the core into a new private helper `runLlmCompactionAgent(input): Promise<string | null>` that returns the resulting summary text without writing the anchor.
- [ ] 7b.3 Update `tryLlmAgent` (currently stub returning false) to call the new helper. On success: return `{ok: true, summaryText, kind: "llm-agent"}`. On null/error: return `{ok: false, reason}`.
- [ ] 7b.4 Refactor `process()` to call the same helper internally, eliminating duplicate logic. Anchor write + Continue injection in `process()` remain on the legacy path until phase 7 deletes it.
- [ ] 7b.5 Verify `run({observed: "manual"})` on empty-Memory session now succeeds via tryLlmAgent (not just narrative/schema/replay-tail/low-cost-server). End-to-end test against synthetic empty-Memory fixture.
- [ ] 7b.6 Verify existing `compaction.test.ts` (9 cases) still passes — process() refactor must not change observable behaviour for legacy callers.

- [!] 7.1 Delete `pendingRebindCompaction` Set, `markRebindCompaction`, `consumeRebindCompaction` from `compaction.ts` — BLOCKED on DD-11 (state-driven continuation-invalidated signal design)
- [!] 7.2 Delete `markRebindCompaction` call at `processor.ts:734` — depends on 7.1
- [!] 7.3 Delete `cooldownState` Map; rewrite `recordCompaction` as deprecated shim → `Memory.markCompacted` — BLOCKED on extracting tryLlmAgent so legacy callers can be removed
- [!] 7.4 Code grep verification — depends on 7.1-7.3
- [x] 7.5 Unit test: 2026-04-27 infinite-loop scenario produces exactly one rebind Anchor (S4 acceptance) — 3 cases in `compaction.regression-2026-04-27.test.ts`: INV-3 no-Continue, INV-2 single-anchor-with-cooldown, structural INJECT_CONTINUE table-frozen defense

## 8. Anchor unification (DD-8)

- [ ] 8.1 Drop `lastMessageId` from rebind-checkpoint write path; on-disk format becomes `{sessionID, snapshot, timestamp}`
- [ ] 8.2 Update rebind-startup recovery to read most-recent compaction part from message stream (replaces lastMessageId lookup)
- [ ] 8.3 Legacy checkpoints retain readable `lastMessageId` field; new code ignores it
- [ ] 8.4 Manual smoke: kill daemon mid-session, restart, verify session resumes correctly using new anchor-only recovery path

## 9. Deprecation shim layer

- [ ] 9.1 Create `packages/opencode/src/session/compaction-shims.ts` housing all deprecated APIs
- [ ] 9.2 `SharedContext.snapshot` → delegates to `Memory.renderForLLM`; emits `log.warn`
- [ ] 9.3 `saveRebindCheckpoint` / `loadRebindCheckpoint` → delegate to `Memory.write/read` with snapshot projection; emit `log.warn`
- [ ] 9.4 `SessionCompaction.process` → delegates to `SessionCompaction.run({observed: "manual"})`; emit `log.warn`
- [ ] 9.5 `compactWithSharedContext` → delegates to `SessionCompaction.run` with appropriate trigger; emit `log.warn`
- [ ] 9.6 CI grep: `log.warn` from shims appears zero times in CI test output (proves all in-repo callers migrated)

## 10. UI consumption of renderForHuman

- [ ] 10.1 Identify UI session-list preview code path (in `packages/app/`)
- [ ] 10.2 Replace existing snapshot fetch with `Memory.renderForHuman`
- [ ] 10.3 Manual smoke: session list preview shows timeline-format text instead of XML-ish snapshot
- [ ] 10.4 Add `/compact --rich` flag to API route; smoke-test it skips kinds 1-3 (DD-10)

## 11. Validation + final cutover

- [ ] 11.1 Run full `compaction.test.ts` suite — all 9 existing cases pass
- [ ] 11.2 Run new tests added in phases 1-10
- [ ] 11.3 Manual smoke: trigger account rotation mid-session, verify exactly one rebind Anchor produced (acceptance gate against 2026-04-27 incidents)
- [ ] 11.4 Manual smoke: invoke `/compact` on populated session, verify zero codex API calls (verifiable via codex usage logs)
- [ ] 11.5 Update `specs/architecture.md` "Compaction" section with new 3-concept diagram
- [ ] 11.6 Write `docs/events/event_<YYYYMMDD>_compaction_redesign_complete.md` capturing scope of changes + before/after metrics

## 12. Deprecation removal (next release)

- [ ] 12.1 Delete `compaction-shims.ts` and all deprecated API symbols (DD-6: 1-release window)
- [ ] 12.2 Delete legacy `shared_context/<sid>` Storage reads after configurable threshold (e.g. 90 days idle)
- [ ] 12.3 Run plan-archive.ts to mark this spec `archived`
