# Proposal: tool-output-chunking → context-management (refactored 2026-04-29)

> **Refactor notice**: This proposal was originally drafted 2026-04-28 around a
> harness-managed compaction extension scoped to "single tool output too big".
> During design-phase discussion the scope expanded to four interrelated
> problems sharing a common root cause (bounded context as a managed resource),
> the original artifacts were snapshotted to `.history/refactor-2026-04-29/`,
> and this proposal was rewritten as the new baseline. Original requirement
> wording preserved verbatim under "Original Requirement Wording (Baseline)";
> evolution captured under "Requirement Revision History".

## Why

Compaction-redesign (merged 2026-04-28, currently `living`) gave us a single
90% overflow gate driven by a state-machine evaluator. Production observation
within the same week revealed that single gate is structurally insufficient.
Four distinct phenomena, each previously treated as separate concerns, share
the same root cause: **the AI's context window is a bounded resource and the
runtime currently provides no mechanism for managing it as such**.

### Problem 1 — Single-tool overflow (type-2)

A single tool result can exceed the entire context budget. Examples observed:
`system-manager_read_subsession` returning 170K tokens; `read` of minified
bundles; `grep` over a monorepo; `webfetch` of large APIs; `bash` with
unbounded stdout; subagent (`task`) outputs that themselves saturated their
parent context. Compaction cannot save these — compaction reduces *history*,
the bottleneck here is the *fresh result about to be appended*.

### Problem 2 — Narrative cross-generation decay

Today's `narrative` compaction kind concatenates `[previous_anchor +
TurnSummaries since previous anchor]` into a new anchor each generation. After
N compactions, content from the earliest rounds exists only as a summary of a
summary of a summary. Information density degrades exponentially with session
length. The original tool_result content is on disk but the AI never sees it
again. Long sessions effectively go blind to their own early history.

### Problem 3 — Mid-multi-step-work loss

When AI is doing a long sequence of related tool calls, compaction firing
mid-workflow can summarize away tool results the AI was about to reference in
the next step. The AI then has to either re-fetch (wasting tokens) or
hallucinate (wasting correctness). Currently observable but not
instrumented; user reports the suspicion that it is happening but cannot be
confirmed without telemetry that does not yet exist.

### Problem 4 — Harness-managed paradigm doesn't match how AI actually works

Layering retention markers, prune kinds, verify-after-compact, and chunked
fallbacks onto the harness was an attempt to make compaction smarter on the
AI's behalf. It was the wrong direction. The AI itself is the only entity
that knows which content matters for the next step, when it is finished using
a result, and how to organise its own work within budget. The harness-side
heuristics will always be guessing, and guessing wrong is the source of all
three problems above.

The right paradigm: **treat AI as a developer working in a context-constrained
environment, expose the budget state, give it self-management primitives, and
keep harness intervention to physical safety nets.** The DOS-era 640K analogy:
programmers managed their own conventional / extended / EMS allocation
because the OS could not guess. Modern context windows are large but still
bounded; the same discipline applies.

## Original Requirement Wording (Baseline)

User's verbatim words during the discussion that produced this scope:

- "context overflow 有兩種。如果是 history 過長，可以靠我們實作的 double phase compaction 來解。如果是當輪的 toolcall 產出過多，就只能靠分塊慢送機制" (2026-04-28, Problem 1)
- "我也留意到一個有趣的現象，在大量連續多個tool call工作中時，還沒返回就發生compaction。我不知道AI如何應對這種情形" (2026-04-29, Problem 3)
- "這件事應該要讓AI自己決定。他在呼叫一個tool並得到結果後，看完這個結果，還要不要留在記憶體中" (2026-04-29, AI agency)
- "預設丟棄是指在compaction的時候丟棄，不是平常沒事亂丟" (2026-04-29, drop semantic clarification)
- "簡單的說，一個資料塊，相同的部位盡量保留在前段" (2026-04-29, cache placement law)
- "toolcall當回決定要的result就浮到delta前面堆著，持續到compaction才收掉" (2026-04-29, stable-prefix layout)
- "我覺得在大量連續工作中，AI本身自己必須要知道context window size的極限並且自行管理配置。而不是我們在旁邊設計一些不符合AI實際工作需求的機制" (2026-04-29, paradigm shift)
- "之前的0 cost compaction我發現一個可能的漏洞，就是每次context滿了都是drop掉toolcall內容然後留下從上個錨點之後的runloop summary集合成串？那這樣上個錨點之前的東西就是永久lost了？" (2026-04-29, Problem 2 surfaced)
- "我想到一個混合式 context(n) = journal(n) + compaction(context(n-1))" (2026-04-29, hybrid formula)
- "而且還兼顧了自稀釋原則" (2026-04-29, attention-driven self-dilution observed)
- "pin/drop/recall算是nice to have吧。也算是留一個窗口給人類去告訴AI這個很重要，那個不重要" (2026-04-29, override scope)
- "AI真的很健忘，重要規定不見得會一直遵守。所以目前的規劃是全部都照顧了" (2026-04-29, redundancy rationale)

## Requirement Revision History

- **2026-04-28**: initial draft. Scope = "Layer 2 tool self-bounding + chunked-digest compaction kind + verify-after-compact". Cursor-protocol design rejected by user same day → Layer 2 reformulated as "tool returns its natural shape with trailing natural-language truncation hint, AI uses tool's existing args for other slices".
- **2026-04-28 (designed state)**: 7 Requirements (R-1..R-7), 11 Decisions (DD-1..DD-11) drafted. Promoted designed.
- **2026-04-29 (refactor — this revision)**: Paradigm shift after observing four interrelated problems. Original artifacts snapshotted to `.history/refactor-2026-04-29/`. New baseline subsumes old work: Layer 2 stays as one of five layers; compaction kind set replaced; harness-side decision logic minimised; AI-end primitives added; cache placement law and self-dilution principle elevated to first-class design constraints.

## Effective Requirement Description

The runtime shall provide AI with **bounded-context resource management** as a
first-class capability. The resulting system has five conceptually distinct
layers, each addressing one failure mode:

### Layer 1 — Hybrid-LLM compaction kind (NEW; central)

Replace the current cost-monotonic chain
(`narrative → replay-tail → low-cost-server → llm-agent → chunked-digest`)
with a single mechanism: a recursive bounded compaction formula running in
two phases. Phase 1 is the normal path; Phase 2 is a fail-safe that should
not fire in normal operation.

**Phase 1 (preserve-pinned, normal path):**

```
new_anchor = LLM_compact( prior_anchor, journal_unpinned )
context[n] = system + new_anchor + pinned_zone + journal_recent + current_round
```

**Phase 2 (everything-into-anchor, fail-safe; expected fire rate ≈ 0):**

```
// Only if Phase 1's resulting context is still over per-request budget
new_anchor = LLM_compact( prior_anchor, journal_all + pinned_zone )
context[n] = system + new_anchor + current_round
```

Where:

- `journal(n)` — recent K rounds of raw conversation, full detail, full
  tool_results, no compression. K is dynamic (bounded by remaining budget
  after anchor + pinned_zone are placed).
- `pinned_zone` — append-only zone collecting tool_results that AI explicitly
  marked pin (Layer 5). Survives Phase 1 verbatim. Absorbed into anchor only
  if Phase 2 fires.
- `anchor(n)` — single assistant message with `summary === true`, content =
  LLM-compacted distillation. Bounded size (target ~30% of model context).
- `LLM_compact(...)` — actual LLM call with bounded input (anchor + journal
  + optionally pinned_zone in Phase 2), outputting the new anchor's summary
  text.

The recursion makes compaction's input size **constant regardless of session
length** — Phase 1 reads `O(anchor + unpinned_journal)`, never `O(full
history)`. This is the formal property the existing narrative kind tries to
provide but does poorly because it concatenates instead of distilling.

The hybrid compaction also accommodates **attention-driven self-dilution**: the
LLM doing the compaction sees both the prior anchor and the recent raw
journal, and naturally re-emphasises content that the AI is still actively
referencing in journal while letting unmentioned content fade to higher
abstraction. Information density per item becomes a function of AI's own
recent attention — no harness rule needed to drive it.

**Phase 2 semantics**: Phase 2 firing is a signalled event, not a routine
path. When it fires, the runtime emits a telemetry event recording (a) what
was in pinned_zone, (b) Phase 1 input/output sizes, (c) why Phase 1 failed
to shrink enough. The expected operational response: investigate AI's pin
behaviour (likely pinning too aggressively) or model-budget settings. A
healthy production deployment should see Phase 2 trigger zero or near-zero
times. If Phase 2 itself still does not produce a fitting context, raise
`E_OVERFLOW_UNRECOVERABLE` to the runloop — at that point the bottleneck is
upstream (a single round contains content larger than the model's whole
budget) and the only remediation is changing the input.

**Internal LLM_compact adaptive sizing (cold-start / legacy resilience)**:
`LLM_compact` itself has two internal modes that the caller does not see:

- `single-pass` (normal): when `sizeof(prior_anchor + journal) <=
  LLM_input_budget`, the call is a single LLM round-trip. ~99% of production
  invocations.
- `chunk-and-merge` (cold-start): when the input exceeds LLM_input_budget,
  `LLM_compact` splits journal at round boundaries, runs the digest
  sequentially (`digest_so_far := LLM_compact(digest_so_far, chunk_k)`), and
  returns the final merged digest. Fires when:
  - Opening a legacy session with 100+ rounds of raw history and no anchor
    yet exists ("誤闖 1000 對話歷史的舊版 session" scenario)
  - Daemon restart that loses anchor state and rebuilds from disk
  - Phase 2 fired with so much pinned_zone + journal that a single LLM
    cannot ingest the combined input

The chunk-and-merge mode is internal — it does not surface as a separate
kind in `KIND_CHAIN`. Externally, the call remains `hybrid_llm`. Internally,
the size check decides the path. This subsumes the originally-planned
`chunked-digest` separate kind into a `LLM_compact` implementation detail,
which is the right level since round-boundary chunking is purely a tactical
input-size accommodation.

### Layer 2 — Tool self-bounding (CARRIED OVER from original spec)

Variable-size tools (`read`, `grep`, `webfetch`, `bash`, `apply_patch`, `task`,
`system-manager_read_subsession`, etc.) cap their own output to
`ctx.outputBudget = min(round(model.context * 0.3), 50_000)` (default formula
in §DD-2 of the prior design, retained). When natural output exceeds budget,
the tool returns a standalone-useful slice on a tool-natural semantic
boundary, with a trailing natural-language truncation hint identifying the
exact tool-arg adjustment to retrieve other parts (`offset=N`, narrower
pattern, `msgIdx_from=K`, etc.). No new wrapper, no cursor protocol — tool
returns its natural string shape.

This is the physical safety net for Problem 1. It is independent of all other
layers and remains useful even if every other layer is disabled.

### Layer 3 — Context visibility (NEW)

Runtime exposes context-budget state to AI continuously. Mechanism (precise
form TBD in design phase):

- A periodic system-message update (or a dedicated metadata channel parsed
  from system role) telling AI: total budget, current usage, room remaining,
  most recent anchor's coverage, journal depth.
- AI is taught (via system prompt / agent guideline) to factor budget into
  multi-step planning: "I have 27K tokens remaining; the next read is likely
  10K; I should consider summarising before continuing."

Without visibility, AI cannot self-manage. With visibility, the rest of the
AI-side machinery becomes usable.

### Layer 4 — AI-end primitives for self-management (NEW; CORE for AI agency)

AI gains direct primitives to shape its own context. Primary forms (mechanism
TBD: assistant-message metadata markers, dedicated tool calls, or reasoning
channel structured commands):

- **`summarize`** — AI can voluntarily run `LLM_compact` on its current
  context before the harness would have triggered it. AI decides timing based
  on budget visibility.
- AI's natural attention in journal already implicitly drives self-dilution
  via Layer 1's hybrid compaction. Most AI context-shaping happens automatic
  through this implicit channel.

### Layer 5 — Override channel (NICE-TO-HAVE; primarily for human intervention)

Three explicit overrides for cases where Layer 1's attention-driven
self-dilution gets it wrong, or where a human knows something AI doesn't:

- **`pin(toolCallIds)`** — mark tool_results that must survive every future
  hybrid compaction verbatim, no matter whether AI continues referencing them.
- **`drop(toolCallIds)`** — mark tool_results AI is definitively finished with;
  next hybrid compaction can omit them entirely from the new anchor.
- **`recall(messageId)`** — retrieve original message content from the
  append-only stream on disk and re-insert it into the live message stream.
  Counterweight to self-dilution: recover specific lost detail when AI
  realises mid-work that a summarised-away fact was actually critical.

Mechanism: assistant-message `metadata` field carries the markers; runtime
parses pre-compaction; hybrid LLM receives explicit instructions about which
items to preserve verbatim or drop. Human use surface: admin panel / TUI
buttons that translate a click into the same metadata markers.

These are **not load-bearing** for the system to function — Layers 1-4 cover
the typical case. Override exists because AI is forgetful (well-documented
behavioural property) and because humans sometimes know better than the AI
what matters.

## Defense-in-Depth Mapping (4 + 1 layers vs failure modes)

| Failure mode | Layer that catches it |
|---|---|
| Single tool dumps too much | Layer 2 (physical safety net) |
| Narrative cross-generation decay | Layer 1 (LLM distillation re-evaluates each generation) |
| Decay still loses something AI ends up needing | Layer 5 `recall` |
| Compaction summarises away mid-multi-step work | Layer 1 attention-driven self-dilution naturally protects what AI is still referencing |
| AI is in budget trouble but harness hasn't fired yet | Layer 3 visibility + Layer 4 voluntary `summarize` |
| AI knows X is critical but isn't actively referencing it (about to need it later) | Layer 5 `pin` |
| AI knows Y is finished and shouldn't waste anchor space on it | Layer 5 `drop` |
| AI forgets to use any of Layers 3-5 | Layer 1's automatic compaction still fires when overflow gate hits; Layer 2 still bounds per-call output |
| Human notices AI getting it wrong | Layer 5 override surfaces (admin UI) |

## Cache Placement Law (design constraint inherited from user's principle)

> "相同的部位盡量保留在前段" — identical content should be kept in earlier
> positions of the prompt. Stable content goes front, mutating content goes
> back.

Specific implications for layer design:

- `[system, anchor, pinned_zone, journal, current_round]` is the canonical
  five-zone prompt order.
- `anchor` is monotonically replaced (not mutated in place) on each compaction.
  Once written, the same byte content sits at the same position until the next
  compaction event — codex prefix cache stable for the whole inter-compaction
  window.
- `pinned_zone` is append-only across compaction windows: when AI marks a new
  pin, the corresponding tool_result content is appended to the zone. Phase 1
  compaction does not mutate the zone (the pinned content stays verbatim
  through anchor regeneration). Phase 2 compaction is the only path that
  empties pinned_zone (everything absorbed into anchor); when it fires, the
  zone resets to empty after the new anchor is written.
- `journal` content is **append-only** during a compaction window; old journal
  entries do not get rewritten or pruned mid-window. Every round just appends
  the new exchange; cache stays warm.
- `pin / drop / recall` markers are stored in assistant-message metadata
  (a non-prompt-affecting field); the markers do not mutate the prompt
  prefix. Pin markers cause the corresponding tool_result content to be
  appended to pinned_zone at the next prompt build. Drop markers cause the
  corresponding tool_result to be substituted with a placeholder during the
  next compaction's input preparation. Recall markers cause original message
  content to be re-loaded from disk and appended to journal.
- Compaction is the only zone-replacement event. It happens when overflow
  triggers (or when AI voluntarily invokes `summarize`). Phase 1 replaces
  only the anchor zone; Phase 2 replaces both anchor and pinned_zone.

This eliminates per-round cache breakage from any retention or graduation
mechanism — both the prior "drop-marked at the front of delta zone"
proposals were rejected (after analysis) precisely because they violated this
law.

## Scope

### IN

- Layer 1: new `hybrid-llm` compaction kind implementing the recursive
  bounded formula; `KIND_CHAIN` simplified to `narrative → hybrid-llm
  → chunked-digest` (or just `hybrid-llm → chunked-digest` if narrative is
  retired; design-phase decision)
- Layer 2: tool self-bounding for the variable-size set + truncation hint
  convention + 5 tweaks.cfg knobs (carried over from original spec)
- Layer 3: context-budget visibility delivered to AI (mechanism TBD)
- Layer 4: voluntary `summarize` primitive
- Layer 5: `pin / drop / recall` override surface (assistant-message metadata
  + parser + admin UI hook)
- Telemetry: per-compaction event capturing input/output sizes, kind chosen,
  pin/drop/recall counts, mid-compaction-loss-suspect detection
- Documentation: `specs/architecture.md` Compaction Subsystem section
  rewritten; agent guidelines updated to teach AI to use Layer 3-5 primitives
- Migration of the on-disk `narrative` mechanism (still 0-cost concat) to the
  new chain — either retired or retained as cheaper fallback before
  hybrid-llm

### OUT

- Type-1 cumulative-history overflow detection (compaction-redesign already
  handles, retained)
- Cooldown / cache utilisation thresholds (compaction-redesign already
  handles)
- Cursor-style pagination protocols (rejected 2026-04-28)
- Provider-side compaction APIs (codex `/responses/compact` etc.) — out of
  scope for this work; the LLM_compact in Layer 1 may use the local agent or
  a dedicated bounded LLM call, but provider-specific endpoints are not part
  of the contract
- Cross-session memory transfer beyond what compaction-redesign already
  provides
- Re-introducing per-round prune (rejected after cache analysis 2026-04-29)

## Non-Goals

- Solve every possible context-budget scenario. The 5-layer design covers
  observed and reasoned-about failure modes; novel scenarios will use Layer 5
  recall as the manual escape hatch.
- Eliminate compaction cost entirely. Each compaction event costs one LLM
  call (Layer 1) plus a one-time cache-prefix break. The goal is to make that
  cost bounded and predictable, not zero.
- Replace `narrative` outright. Design phase will decide whether it stays as
  a 0-cost fallback before hybrid-llm or is retired. Both options are
  defensible.
- Force AI to use Layer 4-5 primitives. AI may rely entirely on automatic
  Layer 1-3 behaviour and still get correct, bounded behaviour. Layer 4-5
  are opt-in optimisations.
- Make the system self-modifying or capable of changing its own design
  (only the harness/runtime evolves; AI's tools and visibility are
  configuration).

## Constraints

- **Cache placement law** must hold at all times — no mutation of prompt
  prefix outside compaction events.
- **Bounded compaction input** — `LLM_compact` reads `O(anchor + journal)`,
  never `O(full history)`. This is the formal property that makes the system
  scalable across long sessions.
- **AI-attention-driven dilution must be implicit** — AI should not need to
  actively manage context for the system to work. The system degrades
  gracefully if AI never uses Layer 4-5.
- **Layer 2 byte-identity for natural-fit outputs** — when a tool's natural
  output fits within budget, the returned string must be byte-identical to
  current behaviour. Codex prefix cache compatibility depends on this.
- **No silent fallback** (AGENTS.md rule 1) — every compaction kind
  transition, every truncation event, every override application emits a
  structured log line.
- **Override is hint, not guarantee** — `pin / drop` are passed to the
  hybrid-llm as instructions; the LLM is expected to honour them but the
  system tolerates LLM ignoring a hint without crashing (telemetry catches
  the drift).
- **Legacy resilience** — opening a session with arbitrary pre-existing
  history (no anchor, hundreds or thousands of rounds, possibly relics of
  previous compaction architectures) must not crash or stall the runtime.
  `LLM_compact` adapts via internal chunk-and-merge when input exceeds the
  LLM's input budget. First-touch of a legacy session may incur one slower
  compaction event; subsequent rounds operate normally.
- **Daemon-restart resilience** — anchor and pinned_zone are derivable from
  the on-disk message stream (the existing single-source-of-truth principle
  from compaction-redesign Phase 13 is preserved). A daemon restart does
  not require special migration; the next prompt-build re-derives state
  from stream walk.

## What Changes

- `packages/opencode/src/session/compaction.ts` — substantially: new
  `tryHybridLlm` kind, simplified `KIND_CHAIN`, integration with hybrid input
  builder
- `packages/opencode/src/session/memory.ts` (or replacement) — new
  representation of `journal` (raw recent rounds, dynamic K) + `anchor` as
  first-class concepts; `Memory.read` semantics adjusted
- `packages/opencode/src/session/prompt.ts` — context-visibility injection
  into system prompt; runloop integrates voluntary-summarize signals
- `packages/opencode/src/session/message-v2.ts` — assistant-message
  `metadata` parser for pin/drop/recall markers (existing metadata field
  reused; no new part type per 2026-04-29 runtime survey)
- `packages/opencode/src/tool/{read,glob,grep,bash,webfetch,apply_patch,task}.ts` —
  self-bounding implementations (carried over from prior design)
- `packages/opencode/src/tool/types.ts` — `ctx.outputBudget` field
- `packages/opencode/src/util/token-estimate.ts` — reused for both layer 2
  and bounded LLM_compact input sizing
- `packages/opencode/src/config/tweaks.ts` — 5 budget knobs (carried over)
- `packages/opencode/src/session/prompt/hybrid-llm-framing.md` (new) — the
  framing prompt template for `LLM_compact`
- `packages/opencode/src/session/prompt/agent-budget-guideline.md` (new) —
  prompt fragment teaching AI to use visibility + voluntary summarize
- Admin UI / TUI hook for pin/drop/recall buttons (Layer 5 human surface)
- `specs/architecture.md` — Compaction Subsystem section rewritten;
  Tool Subsystem section added (self-bounding contract); Context Resource
  section added describing the layered model
- `docs/events/event_<YYYYMMDD>_context-management_landing.md` — final
  landing record
- `templates/etc/opencode/tweaks.cfg.example` — document new knobs

## Capabilities

### New Capabilities

- **Hybrid-LLM compaction**: bounded-input LLM-driven compaction with formal
  size invariant
- **Context visibility**: AI sees its own budget state continuously
- **Voluntary self-summarize**: AI can compact before harness forces it
- **Pin / drop / recall override**: human and AI can explicitly steer
  compaction
- **Single-tool overflow safety net**: Layer 2 (carried over)
- **Attention-driven self-dilution**: emergent property of Layer 1 + raw
  journal — important things stay vivid, unimportant things fade
  automatically

### Modified Capabilities

- `KIND_CHAIN`: simplified; `replay-tail` / `low-cost-server` / `llm-agent`
  retired or absorbed into hybrid-llm
- Tool result string: bounded by `ctx.outputBudget`, may carry trailing
  truncation hint (carried over)
- Anchor message: now sized and shaped by an LLM call rather than a concat,
  but on-stream representation is still `assistant + summary === true`
- Assistant message metadata: new optional fields
  `retainMarkers / dropMarkers` for pin/drop overrides

### Retired Capabilities

- `replay-tail` kind (replaced by hybrid-llm)
- `low-cost-server` kind (replaced by hybrid-llm)
- `llm-agent` kind (replaced by hybrid-llm; the new kind is itself an LLM
  agent but with bounded input, taking the place of the unbounded variant)
- `chunked-digest` kind (subsumed into `LLM_compact`'s internal
  chunk-and-merge mode; not a top-level kind any more)
- `narrative` kind (concatenation-only kind retired; cause of the cross-
  generation decay finding 2026-04-29; replaced by hybrid-llm in all paths)

## Impact

- **Code**: estimated +1500 ~ 2000 lines (Layer 1 hybrid-llm machinery + Layer
  2 carried over + Layer 3 visibility + Layer 4 voluntary summarize + Layer 5
  override surface + tests + agent guidelines). Larger than original spec but
  most increase is from Layers 3-5 which were not in the original.
- **Tests**: ~50 new specs across the five layers
- **AI behaviour**: AI will gradually learn to use visibility + voluntary
  summarize through prompt teaching; expect a transition period where AI
  ignores Layer 3-5 primitives and the system runs on Layer 1-2 alone (still
  correct, just less optimal)
- **Performance**: each compaction event now costs 1 LLM call (was 0 for
  narrative). Trade-off is information quality — narrative concat had 99%
  information loss per generation; hybrid-llm distillation has substantially
  less. Net session-long efficiency: bounded LLM_compact + better quality
  → fewer recall events → fewer total LLM calls
- **Cache**: per cache placement law constraint, cache-disruption events
  remain rare (only at compaction). Inter-compaction window is fully
  append-only. Hit rate at 80–90% utilization band must not regress (>5pp =
  stop gate)
- **Production risk**: Layer 1 is the most invasive change. Migrating from
  `narrative + KIND_CHAIN walk` to `hybrid-llm` requires careful rollout.
  Suggest opt-in flag for early validation; default-on after telemetry
  proves correctness

## Phased Implementation Suggestion (for design phase to refine)

This proposal sets total scope; the design phase will produce ordered
phases. Suggested ordering:

1. **Layer 2 first** (lowest risk, independent value): tool self-bounding +
   truncation hint + tweaks.cfg knobs. Ships independently. (Effectively the
   original spec's content, now positioned as Phase 1.)
2. **Layer 1 hybrid-llm kind**: implement and unit-test against the existing
   compaction trigger. Adds it to KIND_CHAIN but does not retire others yet.
3. **Layer 3 visibility**: inject context-state messages; observe AI
   behaviour change.
4. **Retire replaced KIND_CHAIN entries**: after hybrid-llm proves out,
   retire `replay-tail` / `low-cost-server` / unbounded `llm-agent`.
5. **Layer 4 voluntary summarize**: add the primitive, teach AI in agent
   guideline.
6. **Layer 5 override surface**: pin/drop/recall metadata + parser +
   minimal admin-UI surface.

Each phase is independently mergeable; rollback boundary stays clean.

## Known Gaps

A separate `gaps.md` enumerates 14 identified gaps from the 2026-04-29
post-refactor design discussion. Severity tiers: Critical (must resolve in
design.md before promote → designed), Important (must lock in design),
Implementation Detail (decide during build), Watch (post-merge telemetry).
Design phase shall not promote `proposed → designed` until every Critical
and Important item has either a `design.md` Decision linked or an
explicit deferral with telemetry acceptance criteria. See `gaps.md`.

## Handover Notes

- This proposal supersedes the 2026-04-28 designed-state baseline. Old
  artifacts at `specs/_archive/tool-output-chunking/.history/refactor-2026-04-29/`
  remain readable for reference (especially the Layer 2 design which is
  largely unchanged).
- Slug stays `tool-output-chunking` for now; rename to `context-management`
  is open and can be done with a `git mv` in design phase if user agrees.
- Next promote step: `proposed → designed`. Design phase needs to produce:
  spec.md (Requirements per layer), design.md (Decisions; the LLM_compact
  framing prompt is the most prompt-engineering-heavy artifact), idef0.json
  / grafcet.json (updated for 5-layer flow), c4.json (revised components —
  Memory, Anchor, Journal, HybridCompactor, ContextStatus, OverrideParser,
  ToolFramework + Layer 2 tools), sequence.json (key flows: hybrid
  compaction, voluntary summarize, pin honoured during compaction, recall
  re-injection), data-schema.json (assistant.metadata.retainMarkers /
  dropMarkers shape, ContextStatus message shape, hybrid LLM_compact request
  shape), test-vectors.json (per-layer scenarios), errors.md, observability.md,
  invariants.md.
- The hybrid-llm framing prompt is design-phase's single biggest risk. AI
  must reliably (a) preserve pin'd content verbatim, (b) drop drop'd
  content, (c) re-emphasise content the recent journal references, (d) not
  emit tool_calls. Multiple test vectors and stricter-on-retry framing
  protocol (precedent in original chunked-digest design) likely needed.
