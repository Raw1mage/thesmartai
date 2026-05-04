# Proposal: compaction-redesign

## Why

The compaction subsystem has accreted seven loosely-related concepts that together
implement what is conceptually one feature ("reduce a session's context size before
the next round"):

1. `SharedContext.Space` — per-session structured state filled by regex extraction each turn
2. `snapshot` string — `formatSnapshot(space)` render output
3. rebind checkpoint — disk file (`rebind-checkpoint-<sid>.json`) holding `{snapshot, lastMessageId}`
4. compaction summary message — `summary:true` assistant message in the session stream
5. `compaction-request` part — user-message task marker for runloop pickup
6. `pendingRebindCompaction` — in-memory `Set<sessionID>` flag
7. `cooldownState` — in-memory `Map<sid, lastCompactionRound>`

Triggers (overflow / rebind / manual) × execution kinds (snapshot / plugin / LLM agent)
form a 9-cell matrix; each cell has its own quirks (auto:true vs false, recordCompaction
or not, inject "Continue" or not, clear pendingRebindCompaction or not). This is the
substrate that produced the two most recent compaction incidents:

- **2026-04-27 runloop rebind-compaction infinite loop** (`event_20260427_runloop_rebind_loop.md`)
  — phantom mid-stream account-switch detection × `auto:true` synthetic Continue ×
  missing cooldown gate produced 408-message infinite loop in 3 minutes.
- **2026-04-27 /compact priority-0 + cooldown gap** (`event_20260427_compaction_priority_and_cooldown_gap.md`)
  — manual `/compact` always took plugin path → triggered codex 5h burst limit →
  rotation → rebind compaction fired on top → two compactions back-to-back.

Both incidents share a root: the matrix has cells that **shouldn't exist** but exist by
accident, and decision logic is scattered across three trigger sites instead of one.

The recent fix consolidated the symptom but not the structure. With seven concepts and
nine matrix cells still in place, the next regression is a question of when, not if.

This redesign collapses the seven concepts to four (**Memory / Anchor / Schedule /
Cooldown**), forces a single decision point with an explicit trigger × intent contract,
and replaces `SharedContext`'s regex extraction with **TurnSummary** narrative
(per-turn AI self-summary captured at runloop exit) — so manual `/compact` finally
gets a path that preserves causal reasoning, not slot-filled metadata.

## Original Requirement Wording (Baseline)

- 2026-04-27 (this session, paraphrased exact wording):
  > 「我想再順便把我們的compaction的邏輯收斂一下，目前真的好亂。
  > sharedcontext, checkpoint, snapshot, compaction這麼多東西，有必要拆得這麼細嗎？」
  > 「先做需求情境表。」
  > 「為什麼要compact？因為context window有限。」
  > 「compact分成幾種？1. 免費server side compaction, 2.自費server side compaction,
  > 3.免費自動整理(shared context, snapshot, checkpoint...)」
  > 「觸發原則：免費的盡量做，不得已再用自費的。」
  > 「什麼時候會使用compaction的落地產物？1. session剛做完compaction的時候 2. daemon
  > restart 3. account rotation」
  > 「就用這個來拆解我們真正需要的compaction類型，把原本雜亂的邏輯收斂。寫一個plan
  > 來記錄這些分析規劃，形成實作計畫」

- Earlier in same session, on the underlying narrative source:
  > 「其實每個runloop結束時，AI都會給一個格式還滿工整的小型summary。
  > 但是如果能保留所有runloop的summary，去除過程，應該就是一個精簡化且有整體脈絡
  > 的sharedcontext」

- Earlier still, on the regex extraction critique:
  > 「這樣的shared context似乎是機械式的把固定格式的內容填入，其實有一點失去脈絡邏輯」

## Requirement Revision History

- 2026-04-27: initial draft created via plan-init.ts
- 2026-04-27: filled with requirements scenario matrix derived from discussion
  (4 dimensions × concrete cells); Memory / Anchor / Schedule / Cooldown
  consolidation target documented; TurnSummary narrative source proposed.

## Effective Requirement Description

The compaction subsystem **must** be reorganized so that:

1. **Conceptual surface** is reduced from 7 to **3** concepts (Memory,
   Anchor, Cooldown — Schedule eliminated per DD-1; Cooldown may further
   collapse into Memory if recency is cheaply derivable from Anchor lookup,
   to be decided in design.md). Each concept has one canonical implementation.
2. **A single entry point** `SessionCompaction.run({sessionID, observed,
   step})` replaces the three scattered trigger sites in `prompt.ts`. All
   decisions (cooldown gate, kind selection, anchor write, continue-injection)
   live in this entry point's decision tree. **Triggers are observed
   conditions, not scheduled signals** (per DD-1).
3. **Trigger × Kind matrix** is collapsed: kinds are picked by an explicit
   priority chain (free narrative → free schema → free replay tail → low-cost
   server-side → LLM agent), monotonic in cost, gated by intent (system-driven
   `auto:true` vs user-driven `auto:false`). Low-cost server-side (codex/openai
   `/responses/compact`) retains priority over LLM agent in every trigger
   that admits paid kinds.
4. **Memory** uses `TurnSummary[]` (per-runloop AI self-summary, captured at
   runloop exit) as the primary narrative source. The current regex extraction
   becomes auxiliary metadata only (file index, action log) — never the body
   of a snapshot.
5. **Anchor** unifies "compaction summary message" and "rebind checkpoint
   `lastMessageId`" — both are ways to mark a boundary in the message stream;
   the redesign represents both with a single Anchor concept persisted alongside
   Memory.
6. **Schedule eliminated** (per DD-1). `pendingRebindCompaction` flag is
   deleted; `compaction-request` user-message part remains as an
   already-state-driven artifact for manual `/compact`. All "should I compact?"
   decisions are made by re-evaluating observable session state each runloop
   iteration; nothing is "scheduled for next time".
7. **Cooldown** stays as-is conceptually (one mechanism already), but becomes
   the responsibility of the single entry point — never duplicated across
   call sites.
8. **Backward compatibility**: callers of the existing `SessionCompaction.process`,
   `compactWithSharedContext`, `markRebindCompaction`, `consumeRebindCompaction`,
   `recordCompaction`, `SharedContext.snapshot`, `saveRebindCheckpoint`,
   `loadRebindCheckpoint` continue to work during migration; deprecation shims
   delegate to the new `run` entry. Old call sites are removed in a later phase.
9. **Two consumers of compaction artifacts** are explicitly distinguished:
   "next LLM call" (provider-agnostic narrative, machine-precision) vs
   "human-readable UI/debug" (timeline, scannable). The new render layer
   produces both forms from the same Memory.

## Scope

### IN

- Restructure `packages/opencode/src/session/compaction.ts` and adjacent
  pieces of `shared-context.ts`, `prompt.ts`, `processor.ts` so the four
  concepts (Memory, Anchor, Schedule, Cooldown) are the only public surface.
- Introduce `TurnSummary` capture point in `prompt.ts` runloop exit
  (`exiting loop` site, currently line ~1230).
- Introduce single entry point `SessionCompaction.run({sessionID, trigger,
  step})`; refactor the three call sites in `prompt.ts` (manual /compact via
  task, rebind, overflow / cache-aware) to call it.
- Replace SharedContext regex extraction's role as primary snapshot body
  with TurnSummary narrative; SharedContext continues to track files/actions
  as metadata only.
- Distinguish "next LLM call" form vs "human UI" form of the snapshot render.
- Update the seven existing compaction triggers (overflow, cache-aware, idle,
  rebind, manual `/compact`, provider switch, continuation invalidation) to
  pass through the single entry point with explicit trigger labels.
- Migrate the two persistence layers (`Storage` for SharedContext.Space,
  `Global.Path.state/rebind-checkpoint-*.json` for checkpoint) into one
  Memory artifact with one persistence path.
- Update `event_20260427_*` documents with cross-references to this plan.

### OUT

- **Building a new compaction provider / engine** (Anthropic-side or otherwise).
  This plan reorganizes how we *use* existing compaction surfaces.
- **Changing the codex `/responses/compact` quota cost behaviour**. Whether
  the codex endpoint should count toward 5h burst limit is upstream; we just
  classify it as `paid server-side`.
- **UI work** beyond exposing the human-readable render to existing TUI/web
  views that already consume snapshot. New UI surfaces for browsing TurnSummary
  history are deferred.
- **Changing message-stream filtering semantics** (`filterCompacted`). The
  Anchor concept replaces the existing summary message + checkpoint
  `lastMessageId`; `filterCompacted`'s contract is preserved.
- **Cross-session memory transfer** (multi-session memory, parent↔child
  beyond what subagent currently does).

### Non-Goals

- Achieving "perfect" semantic summarization. TurnSummary leverages what AI
  already writes; we do not commission a separate summarization model run
  per turn.
- Eliminating all compaction cost. Paid server-side and LLM agent paths
  remain available as fallbacks when free narrative path is insufficient.
- Refactoring the runloop or processor structure. Touch surface is limited
  to what the four-concept consolidation requires.

## Constraints

- **AGENTS.md rule 1** ("禁止靜默 fallback"): every fallback transition
  between kinds (free narrative → schema → paid server-side → LLM agent) must
  surface a log line; missing kinds must throw, not silently degrade.
- **No daemon kill / spawn** during plan execution (per project AGENTS.md
  Daemon Lifecycle Authority): rebuild + restart only via `system-manager:
  restart_self`.
- **XDG backup before plan execution** (project AGENTS.md): whitelist
  including `accounts.json`, `opencode.json`, etc., into
  `~/.config/opencode.bak-<YYYYMMDD-HHMM>-compaction-redesign/`.
- **Existing message-stream contract** preserved: `filterCompacted` continues
  to truncate at the most recent compaction-typed part; Anchor concept must
  produce that part shape.
- **Storage migration** must be on-touch peaceful (existing
  `shared_context/<sid>` and `rebind-checkpoint-*.json` files keep working
  during transition; new code reads from new path, falls back to old; old
  removal is a later phase).
- **Test coverage** must not drop. Existing 9 cases in `compaction.test.ts`
  must still pass; new entry point gets new coverage.
- **Provider-agnostic narrative**: TurnSummary is plain text, never carries
  provider-specific tool-call format. This makes provider-switch and
  cross-provider rebind safe.

## What Changes

- New module `packages/opencode/src/session/memory.ts` (or equivalent)
  housing `SessionMemory` (Memory) + Anchor write helpers + Schedule queue +
  Cooldown.
- `compaction.ts` shrinks dramatically: most logic moves to `memory.ts`;
  remaining is the `run()` entry-point decision tree + execution-kind
  implementations (free narrative, free schema-fallback, plugin, LLM agent).
- `shared-context.ts` keeps file/action tracking but loses primary snapshot
  responsibility; `formatSnapshot` becomes one of two render targets
  (machine-readable for LLM) under the new Memory render layer.
- `prompt.ts` runloop:
  - exit point captures TurnSummary into Memory.
  - three current compaction call sites become one `SessionCompaction.run`
    invocation each, distinguished only by trigger label.
- `processor.ts:707` mid-stream account-switch detection still calls
  `markRebindCompaction`, but `markRebindCompaction` is renamed/wrapped to
  push onto the unified Schedule queue.
- Rebind checkpoint disk format gains a `version` field; old checkpoints
  remain readable via a one-line migration (read old shape, project to new).
- Documentation in `specs/architecture.md` updated to describe the four
  concepts; old SharedContext / checkpoint sections retired.

## Capabilities

### New Capabilities

- **TurnSummary capture**: AI's natural per-runloop self-summary is captured
  at the `exiting loop` site and appended to Memory as a narrative entry.
- **Single compaction entry point**: `SessionCompaction.run({sessionID,
  trigger, step})` makes trigger source explicit and decision logic centralized.
- **Two-form Memory render**: machine-readable form (compact, provider-agnostic)
  for next LLM call; human-readable form (timeline + decisions) for UI/debug.
- **Schedule queue inspection**: pending compactions become introspectable
  (one place to look, not split across in-memory flag + message-stream task).
- **Trigger × Kind matrix as data**: the decision policy lives in a table
  literal, not scattered across `if` branches.

### Modified Capabilities

- **`/compact` (manual)**: now routes through the same `run()` with
  `trigger: "manual"`; its kind selection prioritizes free narrative
  (TurnSummary) over plugin (paid server-side) over LLM agent. Result: most
  manual `/compact` calls become free and never touch quota.
- **Overflow auto-compaction**: now `trigger: "overflow"`; same priority
  chain, but `auto:true` semantics (synthetic Continue allowed) preserved
  via explicit field on Schedule entry.
- **Rebind compaction**: now `trigger: "rebind"`; never injects synthetic
  Continue (the bug from the 2026-04-27 infinite loop incident becomes
  structurally unrepresentable in the new entry point).
- **Subagent context inheritance**: still uses Memory, but reads from the
  unified shape rather than two separate places (SharedContext + checkpoint).
- **Continuation-invalidation handling**: `markRebindCompaction` is replaced
  by a Schedule-queue enqueue with `trigger: "continuation_invalidated"`;
  consumer is the single entry point.

## Impact

### Code

- `packages/opencode/src/session/compaction.ts` — major restructure
- `packages/opencode/src/session/shared-context.ts` — role narrowed
- `packages/opencode/src/session/prompt.ts` — three call sites collapsed to
  one entry point per trigger; runloop exit gains TurnSummary capture
- `packages/opencode/src/session/processor.ts` — `markRebindCompaction`
  rename / wrapper
- New: `packages/opencode/src/session/memory.ts` (or chosen name)
- Existing tests `compaction.test.ts` (9 cases) — kept; new tests added for
  `run()` entry point, TurnSummary capture, two-form render

### APIs

- `SessionCompaction.run` — new public function
- `SessionCompaction.process`, `compactWithSharedContext`, `markRebindCompaction`,
  `consumeRebindCompaction`, `recordCompaction`, `SharedContext.snapshot`,
  `saveRebindCheckpoint`, `loadRebindCheckpoint` — kept as deprecated shims
  during migration phase; later removal in a follow-up

### Persistence

- `Storage` key `shared_context/<sid>` — kept; superset structure adds
  `turnSummaries[]`. Old shape readable via migration helper.
- `Global.Path.state/rebind-checkpoint-<sid>.json` — kept readable; new writes
  go to unified Memory persistence; old file removal in follow-up phase.

### Operators / Users

- `/compact` UI: behaviour change — most invocations become instantaneous
  and free of quota; only fall through to plugin/LLM when narrative path
  insufficient.
- Subagent inheritance: improved fidelity (narrative instead of regex
  metadata), no API surface change.
- Daemon restart: rebind restoration unchanged from user perspective; under
  the hood reads new Memory.

### Docs

- `specs/architecture.md` — Compaction section rewritten to describe four
  concepts.
- `docs/events/event_20260427_runloop_rebind_loop.md` — cross-reference added
  pointing to this plan as the structural follow-up.
- `docs/events/event_20260427_compaction_priority_and_cooldown_gap.md` —
  cross-reference added for the same reason.
- New event log on plan creation: `docs/events/event_20260427_compaction_redesign_plan.md`.

---

## Requirements Scenario Matrix (Working Notes — to be promoted into design.md)

The following matrix is the substantive analysis from the 2026-04-27 discussion;
it lives here in proposal.md until the plan is promoted to `designed` state, at
which point it moves into `design.md`. Captured here in proposal so the
"why" stays anchored.

### Why compact? (4 reasons)

| # | Trigger | Motivation | Frequency | User-overridable? |
|---|---|---|---|---|
| 1 | Context window approaches model limit | Avoid API rejection (`context_too_long`) | Common | No (must compact or break) |
| 2 | KV cache prefix growing too long | Reset cache budget; reduce per-request prefix cost | Periodic | Yes (`config.compaction.auto`) |
| 3 | Provider switch mid-session | Old provider's tool-call format unreadable by new provider | Rare | No (would otherwise fail) |
| 4 | Continuation invalidated (e.g. codex `previous_response_id` rejected) | Re-establish context without re-sending full history | Periodic on long sessions | No |

### Compaction kinds (4 kinds)

| # | Kind | Cost | Quality | Cross-provider safe? | Available today? |
|---|---|---|---|---|---|
| 1 | Free local — narrative (proposed: TurnSummary) | $0 | High (AI self-curated) | Yes (plain text) | No (this plan introduces it) |
| 2 | Free local — schema (current: SharedContext regex) | $0 | Low (slot-filling, no causal reasoning) | Yes (plain text) | Yes |
| 3 | Free local — replay tail (truncate + keep last N raw turns) | $0 | High but bulky | Yes | Partially (used by some paths) |
| 4 | Low-cost server-side (codex / openai `/responses/compact`) | 1 dedicated API call, smaller footprint than full LLM round; counts toward 5h burst but cheaper than kind 5 | High (codex/openai narrative) | No (codex/openai format) | Yes (codex / openai providers only) |
| 5 | LLM agent (full LLM round summarizing the session) | 1 full LLM completion, most expensive | Highest (custom prompt template) | Yes (text) | Yes (any provider) |

> Note: the user's original framing was "free server-side / paid server-side /
> free local". A truly **free** server-side compaction does not exist on any
> provider we support today. What does exist is the **low-cost server-side**
> tier (kind 4) — currently codex / openai's `/responses/compact` only. It
> still consumes 5h burst quota but is markedly cheaper than running a full
> LLM agent round (kind 5), so it retains priority over kind 5 in every
> trigger's chain. If a future provider exposes a genuinely-free server-side
> endpoint, it slots in as a new kind between 3 and 4 without disturbing the
> existing order.

### Trigger × Kind decision policy (priority chain)

```
trigger=overflow / cache-aware / idle    (system-driven, auto:true allowed)
    1. free narrative (TurnSummary)        if Memory.turnSummaries fits 30% budget
    2. free schema (SharedContext)         if narrative empty/missing
    3. free replay tail                    if both above empty (rare; first turn)
    4. low-cost server-side                if free paths can't fit budget AND provider supports it (codex/openai)
    5. LLM agent                           final fallback when 1-4 unavailable / insufficient

trigger=rebind / continuation_invalidated  (system-driven, auto:false — never inject Continue)
    1. free narrative                      preferred
    2. free schema                         fallback
    3. free replay tail                    fallback
    (paid kinds NOT used — rebind is maintenance, not enrichment)

trigger=provider_switch                    (system-driven, auto:false)
    1. free narrative                      ONLY (must be provider-agnostic)
    2. free schema                         fallback
    (replay tail NOT used — old format unreadable by new provider;
     low-cost server-side NOT used — codex/openai format unreadable by new provider)

trigger=manual /compact                    (user-driven, auto:false; user wants quality)
    1. free narrative                      preferred (with --rich flag: skip to step 3)
    2. low-cost server-side                if narrative insufficient AND provider supports it (codex/openai)
    3. LLM agent                           final fallback
    (NOT free schema — schema doesn't preserve reasoning, defeats user intent)
```

The chain is **monotonic in cost**: each step is at least as expensive as
the previous one. The principle "免費的盡量做，不得已再用自費的" maps directly
onto step 1-3 (free) → 4 (low-cost) → 5 (most expensive). Kind 4's
priority over kind 5 is preserved in every trigger that admits paid kinds.

This matrix becomes the data literal `KIND_PRIORITY_BY_TRIGGER` inside the
single entry point.

### Artifact form × Consumer

| Artifact form | Next LLM call | Human UI / debug |
|---|---|---|
| Compact provider-agnostic text (current `formatSnapshot` shape) | ✓ primary | ✗ unreadable past 100 lines |
| Timeline-with-decisions render (proposed: human form) | ✗ wasteful | ✓ primary |
| Compaction summary message in stream (anchor) | ✓ implicit (filterCompacted reads it) | ✓ scrollable in UI |
| Rebind checkpoint disk file | Boot-time recovery only | Out-of-band only |

The redesign produces both forms from the same Memory; the consumer picks.

### When are artifacts used? (7 scenarios)

| # | Scenario | Artifact consumed | Currently |
|---|---|---|---|
| 1 | Next LLM call after compaction | Anchor (summary message in stream) | ✓ works |
| 2 | Daemon restart recovery | Memory persistence + Anchor | ✓ via rebind checkpoint |
| 3 | Account rotation mid-session | Memory + Anchor | ✓ via rebind checkpoint |
| 4 | Provider switch mid-session | Memory (must be provider-agnostic narrative) | Partially — schema works, narrative would be better |
| 5 | Subagent context inheritance | Parent's Memory | ✓ via SharedContext.snapshot + checkpoint |
| 6 | Session resume (user reopens older session) | Memory + Anchor | ✓ via filterCompacted reading anchor |
| 7 | UI session-list preview | Memory human-form render | Partially — only raw snapshot, hard to scan |

---

## Design Decisions (locked in proposal stage, 2026-04-27)

These decisions resolve the open questions enumerated below; design.md
inherits them as constraints.

### DD-1 — Schedule concept eliminated; state-driven evaluation

**Original question**: Should the "compact next round" signal be persisted
(in-memory flag vs message-stream task vs hybrid)?

**Decision**: Neither. The Schedule concept is removed entirely. Each
runloop iteration **re-evaluates** whether compaction is warranted based on
**observable session state** (current memory size, provider, account,
message-stream anchors, pending compaction-request user messages), not based
on flags set by previous iterations.

**Why**: "下一論該不該做 compaction，下一輪的 runtime/AI 決定。因為你永遠
不知道下一輪會不會換 daemon、換 provider、換 account" — flags set at time T
may be stale by time T+1 (daemon restart, rotation, provider switch).
State-driven evaluation is the only correct discipline.

**Implications**:
- `pendingRebindCompaction` flag (and its `markRebindCompaction` /
  `consumeRebindCompaction` API) is **deleted**, not unified.
- `processor.ts:707` mid-stream account-switch handler stops calling
  `markRebindCompaction`. It just updates the session's pinned identity;
  the next runloop iteration notices the divergence between the new
  identity and the last anchor's identity, and decides whether to compact.
- Manual `/compact` continues to use the existing `compaction-request`
  user-message part — but reframed as "user intent recorded in the message
  stream", not as "queued task". This is already state-driven (the request
  lives in observable session state); the implementation barely changes.
- The 4-concept consolidation (Memory / Anchor / Schedule / Cooldown) is
  revised to **3 concepts** (Memory / Anchor / Cooldown). Cooldown may
  further collapse into Memory if recency can be cheaply derived from
  Anchor lookup; that's a §design.md detail.
- The single entry point `SessionCompaction.run({trigger, ...})` shifts
  shape: `trigger` is no longer "what scheduled this", it is "what
  condition was observed". Triggers become enum labels for log/event
  attribution, not separate code paths.

**Effective Requirement 2** in this proposal is updated to reflect that
the single entry point's input is **observed conditions**, not scheduled
work.

### DD-2 — TurnSummary captured at runloop exit only; raw tail as fallback

**Original question**: Capture TurnSummary at `exiting loop` only, or also
at finish=tool-calls boundaries inside autonomous runs?

**Decision**: Capture **only at runloop exit** (the natural turn-end where
finish≠tool-calls). For mid-run crashes (autonomous mode interrupted before
the runloop reaches exit), recovery uses **the last N rounds of raw
messages** as fallback, not partial TurnSummary.

**Why**: TurnSummary must be high-fidelity narrative; partial mid-run
captures would record speculative-future text ("我接下來要做 X") rather
than completed-work summary. Two-tier strategy preserves narrative quality
when normal AND crash-resilience when abnormal, without polluting Memory
with low-quality partial summaries.

**Implications**:
- TurnSummary Memory entry has exactly one capture point: `prompt.ts:1230`
  area (the `exiting loop` site), reading `lastAssistant`'s final text part.
- Recovery path (rebind / daemon restart mid-autonomous) reads `last N raw
  rounds` from the session message stream as fallback context, in addition
  to whatever Memory is available.
- "Raw tail kind" (kind 3 in the kinds matrix) gains a concrete consumer:
  rebind-recovery-during-autonomous-mid-run.

### DD-3 — Migration: new path primary, fallback to old on read

**Original question**: Single new persistence path with migration overlay,
or dual-write window across releases?

**Decision**: **New path primary, fallback to old on read**. Writes go
exclusively to the new SessionMemory persistence; reads check new path
first, fall through to old `SharedContext` storage / `rebind-checkpoint-*.json`
file if new is missing. First successful read of an old-only session
triggers a one-time write of the projected new shape (lazy migration on
touch).

**Why**: Simplest model, no dual-write overhead, no drift risk between two
copies. Old data fades naturally as sessions are accessed; cold sessions
keep their old format until touched. Fail-loud on read fallback (log a
WARN per AGENTS.md rule 1) so we know when migration is still in flight.

**Implications**:
- `Storage` key `shared_context/<sid>` and disk file `rebind-checkpoint-<sid>.json`
  remain readable indefinitely until explicit cleanup phase.
- New SessionMemory persistence path TBD in design.md (likely a single
  `session_memory/<sid>` Storage key with both turnSummaries[] and
  fileIndex/actionLog co-located).
- Old-format readers can be removed after a configurable threshold (e.g.
  90 days since last write) in a follow-up cleanup phase, not in this plan.

### DD-4 — File location: session/memory.ts

**Original question**: New file `session/memory.ts` vs new top-level `memory/`
namespace vs stay inside `compaction.ts`.

**Decision**: New file `packages/opencode/src/session/memory.ts`, parallel
to `prompt.ts`, `processor.ts`, `compaction.ts`, `shared-context.ts`.

**Why**: Memory is conceptually a session subsystem (lives per-session,
reads session.execution, drives session compaction). Top-level `memory/`
namespace would oversell scope; staying in `compaction.ts` would obscure
the conceptual boundary.

**Implications**:
- `shared-context.ts` shrinks: file/action tracking remains there but
  exposed via Memory's API as auxiliary metadata; primary snapshot
  responsibility moves to `memory.ts`.
- `compaction.ts` shrinks: only the `run()` entry point + execution-kind
  implementations (low-cost server-side via plugin, LLM agent) stay; all
  state lives in `memory.ts`.

### DD-5 — Render API: two independent functions

**Original question**: Two independent functions `renderForLLM()` /
`renderForHuman()` vs one function with `{mode: "llm" | "human"}` parameter?

**Decision**: **Two independent functions** — `Memory.renderForLLM(sid)` and
`Memory.renderForHuman(sid)`.

**Why**: The two consumers have unrelated optimization paths (LLM render
prioritizes token compactness and provider-agnostic plain text; human
render prioritizes scannable timeline + decisions + chronology). Sharing
one function with a mode flag would invite shared internal logic that
neither consumer needs. Independent functions keep each render's evolution
unconstrained.

**Implications**:
- `Memory.renderForLLM(sessionID): string` — used by `compactWithSharedContext`
  and any `next-LLM-call` path.
- `Memory.renderForHuman(sessionID): string` — used by UI session-list
  preview, debug dumps, `/compact` confirmation toast text.
- `formatSnapshot(space)` (current `shared-context.ts`) is renamed and
  becomes the implementation backing `renderForLLM`; it loses the human-form
  responsibility entirely.

### DD-6 — Deprecation shim lifetime: 1 release (aggressive)

**Original question**: How many releases should the deprecated shim layer
(SharedContext.snapshot, saveRebindCheckpoint, SessionCompaction.process,
markRebindCompaction, etc.) live before removal?

**Decision**: **1 release** — the next release after this plan ships
removes the shim layer.

**Why**: This codebase is a single-tenant product line (no external plugin
ecosystem locked to old API surface; all callers are within the repo).
Aggressive removal forces clean migration in the same release window,
prevents dual-path drift, keeps the codebase focused on the new shape.
A 2-3 release window would leave both paths active long enough for new
code to be written against the deprecated shims out of habit.

**Implications**:
- `tasks.md` (planned phase) **must** include a "remove deprecated shim"
  task as the last phase before `verified` promotion.
- All in-repo callers of the old API are migrated within this plan; no
  external compatibility window.
- Deprecation warnings (`log.warn("…deprecated, migrate to Memory.…")`)
  fire from every shim during the bridge phase, so any forgotten caller
  surfaces in CI logs immediately.

---

## Next Step

Promote to `designed` state and draft `design.md`, `c4.json`,
`sequence.json`, `data-schema.json`. With DD-1 in particular, the design
work is now smaller (no Schedule subsystem to design) but the runloop
state-evaluation logic needs careful specification — that becomes a key
section of `design.md`.
