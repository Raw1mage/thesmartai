# Design: tool-output-chunking (context-management)

> Architecture-level decisions implementing `spec.md`'s R-1..R-13 within
> opencode's runtime. Each Decision (DD-N) is dated and version-aware. Decisions
> closing a Critical or Important gap reference the gap ID (e.g. `closes G-1`).

## Context

The current compaction subsystem (compaction-redesign, `living` since
2026-04-28) implements one overflow gate plus a cost-monotonic chain
(`narrative → replay-tail → low-cost-server → llm-agent → chunked-digest`).
Production observation surfaced four failure modes the chain does not
adequately address — see `proposal.md` Why section. The redesign keeps the
overflow-gate trigger from compaction-redesign but replaces the kind chain
with a single bounded-input mechanism plus four supporting layers.

## Goals / Non-Goals

### Goals

- Replace the kind chain with a single mechanism whose input size is bounded
  irrespective of session length.
- Close all 6 Critical gaps and 3 Important gaps from `gaps.md` before
  promotion to `designed`.
- Preserve cache placement law (zone order + append-only inter-compaction
  windows) inherited from compaction-redesign.
- Make Layer 1 + Layer 2 self-sufficient for correctness; Layers 3-5 are
  opt-in.

### Non-Goals

- Eliminate the cost of compaction (each event still costs 1 LLM call).
- Replace `narrative` outright — keep it as a 0-cost fallback path is
  considered in DD-12 below.
- Solve multi-modal content beyond text (deferred per G-14).

---

## Decisions

### DD-1 — Five-zone canonical prompt order (cache placement law)

**Decision (2026-04-29)**: The prompt sent to the model shall always be
`[system, anchor, pinned_zone, journal, current_round]` in that order.
Inter-compaction windows are append-only; only compaction events mutate
`anchor` and (Phase 2 only) `pinned_zone`. `journal` is append-only between
compactions.

**Rationale**: Cache placement law (proposal §"Cache Placement Law"); stable
prefix at the front, mutating content at the back. Codex prefix cache TTL
relies on byte-identical leading bytes round-to-round.

**Implementation site**: `packages/opencode/src/session/prompt.ts` —
prompt-build function asserts the zone order and emits a structured warning
if any caller violates it.

### DD-2 — Layer 2 outputBudget formula and tool list

**Decision (2026-04-29, carried over from refactor-2026-04-29 prior
designed-state spec)**:

```ts
ctx.outputBudget = Math.min(Math.round(model.contextWindow * 0.30), 50_000)
```

Default 50K cap; 30% of context window otherwise (smaller of two).

Tools that must self-bound (each implements its own slice + truncation hint):

- `read` — slice by line count from `offset`; hint includes `offset=N` for
  next slice
- `glob` / `grep` — cap match list; hint includes narrower pattern suggestion
- `bash` — cap stdout/stderr by line + token; hint suggests redirect-to-file
- `webfetch` — cap response body by token; hint includes byte-range header
  example
- `apply_patch` — bound the patch summary (not the patch input); hint
  references batch-mode for very large patches
- `task` — bound the child's final assistant message; hint references
  `system-manager_read_subsession` with `msgIdx_from`
- `system-manager_read_subsession` — paginated by `msgIdx_from / msgIdx_to`
  already; honour outputBudget by reducing the default page size

**Tweaks knobs** (`/etc/opencode/tweaks.cfg`):
- `tool.outputBudget.absoluteCap = 50000` (token, default)
- `tool.outputBudget.contextRatio = 0.30` (default)
- `tool.outputBudget.minimumFloor = 8000` (so very small models still get a
  workable slice)
- `tool.outputBudget.taskOverride = 60000` (task tool may have a slightly
  larger budget because child summaries are usually high-density)
- `tool.outputBudget.bashOverride = 40000` (bash typically lower-density)

**Rationale**: Already validated in 2026-04-28 designed baseline. Carried
unchanged.

**Implementation site**: `packages/opencode/src/tool/types.ts` adds
`ctx.outputBudget`; each tool listed above implements its own bounding.

### DD-3 — Hybrid-LLM kind replaces the kind chain

**Decision (2026-04-29)**: `KIND_CHAIN` is reduced to a single entry:
`hybrid_llm`. Retired entries (deleted from chain): `replay-tail`,
`low-cost-server`, unbounded `llm-agent`, `chunked-digest`. `narrative` is
retained only as the fall-through path described in DD-12.

`hybrid_llm` has two phases (Phase 1 / Phase 2) and one internal mode
(single-pass / chunk-and-merge). Phase 2 firing is a signalled event.

**Rationale**: Single mechanism with bounded input is the central insight of
the refactor; multiple kinds were heuristic guessing.

**Implementation site**: `packages/opencode/src/session/compaction.ts` —
new `tryHybridLlm` function; `KIND_CHAIN` constant rewritten;
`tryReplayTail` / `tryLowCostServer` / `tryLlmAgent` / `tryChunkedDigest`
deleted (not flagged behind a feature toggle — direct replacement per the
plan-builder `refactor` semantics).

### DD-4 — Pinned content shape: synthesised user-message envelope (closes G-1)

**Decision (2026-04-29)**: `pinned_zone` MUST NOT contain bare `tool_result`
messages. Each pinned item is materialised as a synthesised **user role**
message with text content:

```
[Pinned earlier output] tool '<tool_name>' (round <K>, tool_call_id=<TID>)
returned:
<verbatim tool_result content>
```

Original `tool_call` and `tool_result` pair stays adjacent in `journal`
(unmoved). The synthesised user message lives in `pinned_zone` as a separate
copy of the content.

**Rationale**: All major providers (OpenAI, Anthropic, Codex, Google) reject
prompts where `tool_call` is separated from its `tool_result`. Wrapping the
content in a user-role message preserves the content's attention while
satisfying provider validation. Adjacency rule for the original pair is
preserved because the original pair is untouched — only a copy is wrapped.

**Trade-off**: Pinned content is duplicated (once in journal as native
tool_result, once in pinned_zone as wrapped user message) until the next
Phase 1 compaction (which will replace the anchor and re-evaluate journal
content; the wrapped pinned copy survives as long as the pin is active).
Token cost of duplication is bounded by `pinned_zone_max_tokens` (DD-5).

**Implementation site**: `packages/opencode/src/session/prompt.ts` —
pinned_zone materialisation step in prompt-build.

**Closes**: G-1.

### DD-5 — Pinned_zone hard cap forces Phase 2 (closes G-4)

**Decision (2026-04-29)**: `pinned_zone_max_tokens = round(model_context * 0.30)`
(default; configurable via `tweaks.cfg`). When the cumulative wrapped pinned
content (sum of user-message envelope sizes) would exceed the cap at the next
prompt build:

1. The next compaction event is forced into Phase 2, regardless of whether
   Phase 1 input would have fit
2. After Phase 2 absorbs pinned_zone into the anchor, telemetry emits
   `pin_density_high` warning with the offending session_id

**Tweaks knob**: `compaction.pinnedZone.maxTokensRatio = 0.30`

**Telemetry**: per-session `pin_density = pinned_zone_tokens /
total_context_tokens`; aggregated dashboard alert > p95 threshold.

**System prompt teaching**: the budget guideline (`agent-budget-guideline.md`,
new) instructs AI: "pin is a scarce resource; only mark items you will
re-reference. Prefer `recall` over over-pinning."

**Rationale**: Without the cap, AI defensive-pinning behaviour creates a
second unbounded growth path. Hard cap + teaching + telemetry cover the
three axes of the failure mode.

**Implementation site**: `packages/opencode/src/session/prompt.ts` (cap
check in prompt-build); `compaction.ts` (Phase 2 forcing path).

**Closes**: G-4.

### DD-6 — LLM_compact failure handling and fallback chain (closes G-3)

**Decision (2026-04-29)**: `LLM_compact` failures follow this recovery
ladder:

1. **Sanity check on output**: new anchor size must be `< (prior_anchor +
   journal_input)`. If not, treat as malformed.
2. **Single retry**: 1 retry with stricter framing prompt (target size
   reduced, ruthlessness emphasised).
3. **Provider fallback**: if a fallback model/account is configured for
   compaction (via `tweaks.cfg` `compaction.fallbackProvider`), retry once
   on that provider before giving up.
4. **Graceful degradation fallback**: keep prior anchor; truncate journal
   from the oldest-round end until `[system, anchor, pinned_zone,
   journal_truncated, current_round]` fits per-request budget. Log the
   truncated round IDs.
5. **Hard timeout**: 30s per attempt (`compaction.llmTimeoutMs = 30000`).

Errors emitted (catalogued in `errors.md`):
- `E_HYBRID_LLM_FAILED` — generic provider error after retries exhausted
- `E_HYBRID_LLM_TIMEOUT` — timeout exceeded
- `E_HYBRID_LLM_MALFORMED` — sanity check failed both attempts

In all three error cases, the runtime continues with the graceful-degradation
fallback path; the runloop never stalls.

**Implementation site**: `packages/opencode/src/session/compaction.ts` —
`runHybridLlmWithRecovery` wrapper; `errors.md` catalogue; failure-mode
test fixtures in `test-vectors.json`.

**Closes**: G-3.

### DD-7 — Recall semantics: full disk content, journal-tail insertion, idempotent (closes G-5)

**Decision (2026-04-29)**:

1. `recall(msg_id)` retrieves the **original disk content** (full,
   untruncated) — not the Layer 2-truncated version that may exist in the
   stream. Disk is the single source of truth.
2. The recalled content is inserted at the **journal tail** (most recent
   position before `current_round`) framed as a synthesised user message:
   ```
   [Recalled from earlier] tool '<name>' (round <K>, msg_id=<MID>) returned:
   <verbatim disk content>
   ```
3. Recall is **idempotent**: a second recall of the same `msg_id` within the
   same compaction window is a no-op (the recalled content is already in
   journal).
4. The recalled content is itself subject to **Layer 2 self-bounding** — if
   the disk content exceeds `outputBudget`, it is truncated with a hint
   pointing to the disk source for further pagination.
5. **Cross-session recall**: `recall(session_id, msg_id)` retrieves from
   another session's on-disk stream (used by parent → completed subagent
   recall, see DD-8).

**Implementation site**: `packages/opencode/src/session/memory.ts` —
`recallMessage` function; assistant-metadata parser routes
`recallMarkers` to this function pre-prompt-build.

**Closes**: G-5.

### DD-8 — Subagent uses identical machinery; billed to subagent account (closes G-7)

**Decision (2026-04-29)**:

1. Subagents (`task` tool) run their own runloop with the **same
   hybrid-llm machinery** — no fork, no sub-mechanism.
2. Subagent compaction `LLM_compact` calls are billed to the **subagent's
   own account/model** (matches the subagent's primary work, consistent
   with how the parent's compaction is billed to the parent's account).
3. Subagent's anchor / journal / pinned_zone persist to the subagent's
   own on-disk message stream (same persistence model as any session).
4. After subagent finishes, the parent can recall any message from the
   subagent's stream via cross-session recall: `recall(session_id=S2,
   msg_id=M9)` per DD-7.

**Rationale**: Single mechanism principle (also see DD-3). Subagent is
"just another session" from the compaction subsystem's view.

**Implementation site**: `packages/opencode/src/tool/task.ts` (no change
required — it already spawns a child session that runs the same runloop);
`memory.ts` `recallMessage` accepts an optional `session_id` parameter.

**Closes**: G-7.

### DD-9 — Phase 2 starvation handling: bounded chain, no Phase 3 (closes G-8)

**Decision (2026-04-29)**:

1. Phase 2 uses **stricter framing**: `framing.strict = true` causes the
   prompt to require `target_tokens ≤ 5_000` (configurable
   `compaction.phase2.maxAnchorTokens`) and explicit instructions to drop
   detail ruthlessly.
2. If Phase 2 still does not produce a fitting context, the runtime raises
   `E_OVERFLOW_UNRECOVERABLE` with user-facing message:
   `"This session has structural bloat that cannot be compacted within the
   model's budget. Consider starting a new session, or use the admin panel
   to drop pinned items and retry."`
3. **No Phase 3** — the chain length is bounded at 2 by design. Infinite
   escalation is forbidden.

**Tweaks knob**: `compaction.phase2.maxAnchorTokens = 5000`

**Implementation site**: `packages/opencode/src/session/compaction.ts` —
`runPhase2` function; `errors.md` catalogues `E_OVERFLOW_UNRECOVERABLE`
with remediation guidance.

**Closes**: G-8.

### DD-10 — Migration matrix for in-flight live sessions (closes G-9)

**Decision (2026-04-29)**: Each pre-existing on-disk state is handled as
follows (no migration script; runtime adapts on next prompt-build):

| Pre-existing state | Handling |
|---|---|
| Old narrative anchor (`assistant + summary === true`) | Accepted as valid anchor (schema unchanged); next compaction uses hybrid-llm with this as `prior_anchor` |
| No anchor, ≤ 50 rounds | Hybrid-llm single-pass on first compaction trigger |
| No anchor, > 50 rounds (input exceeds LLM input budget) | Hybrid-llm cold-start (chunk-and-merge mode internal to LLM_compact) |
| SharedContext / rebind-checkpoint state on disk | Ignored (already retired by Phase 13.2-B); prompt is rebuilt from message-stream SSOT |
| Partial / corrupted anchor (parse error) | Treat as no-anchor; cold-start path |
| New tweaks.cfg keys absent | Defaults applied per DD-2/5/6/9 specifications |

No DB migration. No flag-day. Sessions adapt on next compaction.

**Test fixtures** (in `test-vectors.json`): one session per row above; each
fixture's first prompt-build round is the verification target.

**Implementation site**: `packages/opencode/src/session/memory.ts`
prompt-build's anchor-detection branch; `compaction.ts` cold-start branch.

**Closes**: G-9.

### DD-11 — Anchor schema: provider-agnostic plain text + version field (closes G-6)

**Decision (2026-04-29)**:

1. The anchor message envelope is unchanged at the message-shape level
   (`assistant + summary === true`).
2. The anchor's **content shape** is plain Markdown / structured text only:
   - No `<thinking>` / `<scratchpad>` tags
   - No provider-specific tokens (no `<|im_start|>`, no Claude `<antml>`,
     no Codex tool-call shapes)
   - No embedded `tool_call` / `tool_result` JSON blocks
3. The anchor content begins with a header line:
   ```
   [Context Anchor v1] generated at <ISO-8601> by <provider>:<model>
   covering rounds [<earliest>..<latest>]
   ```
   The `v1` token is the schema version for forward compatibility.
4. The framing prompt for `LLM_compact` includes this shape contract; output
   that violates the contract is rejected as malformed (per DD-6).

**Cross-provider regression test** (in `test-vectors.json`): identical
`(prior_anchor, journal_unpinned)` input run against gpt-5.x / anthropic /
codex must each produce a schema-compliant anchor whose content covers
the same key facts (judged by a contract-checks script comparing presence
of named entities, decisions, file paths from the input).

**Implementation site**:
`packages/opencode/src/session/prompt/hybrid-llm-framing.md` (new) holds
the framing prompt; `compaction.ts` validates output against the
contract.

**Closes**: G-6.

### DD-12 — Narrative kind retired (no fallback retention)

**Decision (2026-04-29)**: The `narrative` compaction kind is **retired**.
It is not retained as a 0-cost fallback before hybrid-llm. Reasoning:

1. Narrative was the source of the cross-generation decay finding (Problem 2
   in proposal); keeping it would re-introduce the bug in any session that
   triggered it before hybrid-llm's overflow gate fired.
2. Hybrid-llm's chunk-and-merge mode (DD-3 internal mode) already provides
   a graceful path for the legacy "first compaction on giant history"
   scenario that narrative would have been useful for.
3. The 1-LLM-call cost of hybrid-llm Phase 1 is bounded and small (one call
   per overflow event, with 30s cooldown from compaction-redesign); the
   "cheaper fallback" optimisation is not worth the regression risk.

**Trade-off considered and rejected**: a "narrative-then-hybrid" chain
would let cheap rounds use narrative and only escalate to hybrid-llm when
size demanded. Rejected because it re-introduces the cost-monotonic chain
that the refactor explicitly eliminated; the heterogeneity of compaction
events would also defeat the per-event telemetry simplicity gained by
having one kind.

**Implementation site**: `packages/opencode/src/session/compaction.ts` —
`tryNarrative` and the `KIND_CHAIN` entry deleted.

### DD-13 — Layer 1+2 self-sufficiency invariant (closes G-2)

**Decision (2026-04-29)**: The system MUST remain correct (bounded context,
no crashes, journal preserved within budget) when AI never invokes any
Layer 4 or Layer 5 primitive (no `summarize`, no pin / drop / recall).

This is documented as a first-class invariant in `invariants.md`. Test
fixtures in `test-vectors.json` include "AI never uses Layer 3-5" cases
that must pass.

Layer 4-5 primitives are gradually introduced post-Layer-1+2-merge:
- Phase 1 ships Layers 1+2 only (proposal §"Phased Implementation
  Suggestion" item 1-2)
- Phase 2 ships Layer 3 visibility (item 3)
- Phase 3 ships Layer 4 voluntary summarize (item 5)
- Phase 4 ships Layer 5 override surface (item 6)

Each phase is independently mergeable; rollback boundary stays clean.

**Closes**: G-2.

### DD-14 — Layer 4 voluntary summarize mechanism

**Decision (2026-04-29)**: AI invokes voluntary summarize via a **dedicated
tool call** named `compact_now`:

```ts
tool compact_now {
  reason: string  // why AI is requesting (logged to telemetry)
}
```

Why a tool call rather than assistant-message metadata or reasoning channel:

1. Tool calls are first-class transport across all providers (no
   provider-specific metadata channel inconsistency).
2. Tool calls are visible in the message stream (auditable) and naturally
   flow through the existing tool-dispatch machinery.
3. Tool calls have a return value; the runtime can return budget-after
   stats (`{room_remaining_after: 80_000, anchor_size: 28_000}`) so the
   AI can plan its next step.

The `compact_now` tool's handler triggers the same `runHybridLlm` path as
a forced compaction; it is not a separate kind.

**Implementation site**: `packages/opencode/src/tool/compact-now.ts` (new);
registered in tool registry behind `compaction.voluntarySummarize.enabled`
flag (default true once Phase 3 ships).

### DD-15 — Layer 5 override mechanism: assistant metadata markers + admin UI

**Decision (2026-04-29)**: Pin / drop / recall markers live in
**assistant-message metadata** field (`message.metadata.contextMarkers`),
parsed pre-prompt-build:

```ts
message.metadata.contextMarkers = {
  pin?: ToolCallId[]      // ids of tool_results to pin to pinned_zone
  drop?: ToolCallId[]     // ids of tool_results to drop from next compaction
  recall?: { sessionId?: SessionId, msgId: MsgId }[]  // ids to recall
}
```

Why metadata over a dedicated tool call:

1. Markers are a side-effect of normal AI work (the AI doesn't need a tool
   round-trip; it tags during thinking).
2. Tool calls would consume a round per marker, which is too expensive for
   what is essentially a tag.
3. The metadata field already exists in `message-v2.ts`; no new part type
   needed (per 2026-04-29 runtime survey).

**Human surface**: admin panel and TUI add buttons for pin / drop /
recall. Click translates into the same metadata markers attached to a
synthesised assistant message ("[manual override 2026-04-29 by user]").

**Implementation site**:
- `packages/opencode/src/session/message-v2.ts` — metadata schema
  documented (no new field; reuse existing `metadata` slot)
- `packages/opencode/src/session/prompt.ts` — pre-prompt-build parser
  walks recent messages, applies pin/drop/recall to the prompt-build state
- Admin UI hook (separate phase per DD-13)

---

## Risks / Trade-offs

- **Framing prompt fragility**: `LLM_compact`'s framing prompt is the
  single biggest risk. Wrong framing → bad anchors → cascading session
  quality loss. Mitigation: dedicated `hybrid-llm-framing.md`; cross-provider
  regression test (DD-11); failure-mode tests (DD-6).

- **Codex prefix-cache regression**: any zone-order change or in-place
  mutation to anchor / pinned_zone breaks cache. Mitigation: cache-rate
  acceptance check (spec.md acceptance #15); monitoring alert if hit-rate
  regresses > 5pp at 80–90% utilisation band.

- **Pin defensive over-use**: AI may treat pin as "free safety" and pin
  excessively. Mitigation: hard cap (DD-5) + telemetry + system-prompt
  teaching.

- **Provider switch mid-session**: anchor produced by one provider may not
  be read cleanly by another. Mitigation: provider-agnostic shape (DD-11);
  cross-provider regression test.

- **Cold-start latency on legacy 1000-round sessions**: 30-60s first-touch
  delay (G-10). Mitigation: TUI / admin progress indicator; cached anchor
  written to disk so subsequent opens skip; optional background prefetch.

- **Telemetry volume**: per-event JSON could be high-volume on busy
  installations. Mitigation: events are small (<1KB each); 30s cooldown
  on compaction limits frequency naturally; existing observability stack
  handles similar event rates.

## Critical Files

- `packages/opencode/src/session/compaction.ts` — central rewrite
- `packages/opencode/src/session/memory.ts` — anchor / journal / pinned_zone
  representation; recall function
- `packages/opencode/src/session/prompt.ts` — five-zone prompt build;
  pinned_zone materialisation; metadata-marker parser
- `packages/opencode/src/session/prompt/hybrid-llm-framing.md` (new) —
  framing prompt; provider-agnostic contract
- `packages/opencode/src/session/prompt/agent-budget-guideline.md` (new)
  — system-prompt fragment teaching AI to use Layer 3-5 primitives
- `packages/opencode/src/session/message-v2.ts` — metadata schema doc
- `packages/opencode/src/tool/types.ts` — `ctx.outputBudget`
- `packages/opencode/src/tool/{read,glob,grep,bash,webfetch,apply_patch,task,system-manager_read_subsession}.ts`
  — Layer 2 self-bounding implementations
- `packages/opencode/src/tool/compact-now.ts` (new) — Layer 4 voluntary
  summarize tool
- `packages/opencode/src/config/tweaks.ts` — new knobs per DD-2/5/6/9
- `templates/etc/opencode/tweaks.cfg.example` — document new knobs
- `specs/architecture.md` — Compaction Subsystem section rewrite; new
  Tool Subsystem (self-bounding contract) section; new Context Resource
  layered-model section
- Admin / TUI surface (Phase 4) — minimum pin/drop/recall UI

## Phased Implementation (refined from proposal)

Per DD-13, ship in independently-mergeable phases:

| Phase | Scope | State after merge |
|---|---|---|
| 1 | Layer 2 self-bounding + tweaks knobs (DD-2) | living |
| 2 | Layer 1 hybrid-llm kind, retire chain (DD-3, DD-4, DD-5, DD-6, DD-9, DD-11, DD-12) | living |
| 3 | Layer 3 context visibility (R-5) | living |
| 4 | Layer 4 `compact_now` tool (DD-14) | living |
| 5 | Layer 5 override metadata + admin/TUI (DD-15) | living |

Each phase passes its own subset of `spec.md` acceptance checks before
merge. plan-builder's tasks.md (drafted at `planned` state) will reflect
these phases as `## N. Phase` blocks.

## Open Decisions for Build Phase

- **DD-S1** (Layer 4 mechanism choice): tool call confirmed (DD-14). If
  build-phase reveals tool-call latency is unacceptable, revisit metadata-
  marker variant.
- **DD-S2** (visibility delivery channel for R-5): system-role periodic
  injection vs. dedicated metadata channel. Defer to Phase 3 build.
- **DD-S3** (admin UI exact shape): defer to Phase 5 build.
