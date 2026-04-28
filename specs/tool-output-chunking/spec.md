# Spec: tool-output-chunking (context-management)

> Behavioural requirements derived from `proposal.md` (refactor-2026-04-29
> baseline). Format: `### Requirement:` blocks with GIVEN/WHEN/THEN scenarios.
> Each requirement maps to one or more layers in the 5-layer model. Acceptance
> checks at end of file.

## Purpose

Provide the runtime with **bounded-context resource management** as a first-class
capability so that:

1. A single oversized tool result cannot crash a round.
2. Cross-generation narrative decay is replaced by attention-driven distillation.
3. AI doing multi-step work does not lose tool_results it is still actively
   referencing.
4. AI gains visibility into its own budget and primitives to manage it.
5. Humans retain an override surface for cases where automatic behaviour fails.

The system is designed so that Layer 1 + Layer 2 alone produce **correct,
bounded** behaviour; Layer 3 / 4 / 5 are **opt-in optimisations** that improve
quality but are not load-bearing for correctness (`fall-through invariant`,
see invariants.md).

---

## Requirements

### Requirement: R-1 — Per-tool output bounding (Layer 2)

Variable-size tools must cap their own output to a budget derived from the
active model's context window before returning.

#### Scenario: read of a 200KB minified bundle

- **GIVEN** the active model has context window 200K tokens
- **AND** `outputBudget = min(round(200_000 * 0.30), 50_000) = 50_000` tokens
- **AND** the file `dist/bundle.js` is ~120K tokens
- **WHEN** the AI calls `read({path: "dist/bundle.js"})`
- **THEN** the tool returns the first slice ending on a tool-natural boundary
  (≤ 50_000 tokens of file content)
- **AND** the tool appends a trailing natural-language hint: `[... truncated;
  call read again with offset=<N> to continue, or limit=<K> for a window]`
- **AND** the returned string is byte-identical to current behaviour for any
  read call whose natural output is ≤ `outputBudget`

#### Scenario: bash with unbounded stdout

- **GIVEN** `outputBudget = 50_000`
- **WHEN** the AI runs a `bash` command emitting 200K tokens of stdout
- **THEN** the tool returns the first ~50K tokens of stdout combined with the
  command's exit code and stderr (still on a line boundary)
- **AND** appends: `[... stdout truncated at 50000 tokens; re-run with redirection
  to a file then read the file in slices]`
- **AND** never returns >`outputBudget` tokens of content

#### Scenario: subagent task whose own output saturates parent context

- **GIVEN** parent's `outputBudget = 50_000`
- **AND** child subagent finished with a 170K-token result message
- **WHEN** the parent's `task` tool packages the child result
- **THEN** parent receives a result ≤ `outputBudget` containing the child's
  final assistant message (or a Layer 2 truncation thereof)
- **AND** parent receives a hint: `[child session id=<X>; full output via
  system-manager_read_subsession with msgIdx_from=<K>]`

### Requirement: R-2 — Hybrid-LLM compaction with bounded input (Layer 1, Phase 1)

Compaction shall use a recursive bounded formula whose input size is `O(anchor
+ unpinned_journal)`, not `O(full history)`.

#### Scenario: normal-path compaction

- **GIVEN** session has prior anchor (~30K tokens) + 12 rounds of journal (~40K
  tokens) + 3 items in pinned_zone (~6K tokens) + current round (~5K tokens)
- **AND** total context exceeds the configured overflow gate
- **WHEN** runtime triggers compaction
- **THEN** runtime invokes `LLM_compact(prior_anchor, journal_unpinned)` —
  pinned_zone is NOT input
- **AND** the new anchor's output size ≤ `anchor_target_tokens` (default
  ≈ 30% of model context)
- **AND** the resulting `[system, anchor, pinned_zone, journal_recent,
  current_round]` fits the per-request budget
- **AND** a structured log line `[compaction] kind=hybrid_llm phase=1
  input_tokens=<X> output_tokens=<Y> pinned_count=<Z>` is emitted

#### Scenario: cold-start on a 1000-round legacy session

- **GIVEN** a session with 1000 rounds of raw history loaded from disk
- **AND** no prior anchor exists yet
- **AND** combined input exceeds the LLM's input budget
- **WHEN** runtime triggers compaction
- **THEN** `LLM_compact` enters internal `chunk-and-merge` mode
- **AND** journal is split at round boundaries; digest is built sequentially
  (`digest_so_far := LLM_compact(digest_so_far, chunk_k)`)
- **AND** the final merged digest is returned as the new anchor
- **AND** the chunk-and-merge mode is logged but is NOT a separate `KIND_CHAIN`
  entry — externally the call remains `hybrid_llm`

### Requirement: R-3 — Phase 2 fail-safe absorbs pinned_zone

If Phase 1's resulting context still exceeds the per-request budget, Phase 2
absorbs `pinned_zone + journal_all` into a stricter-framed anchor.

#### Scenario: pinned_zone over-saturated

- **GIVEN** Phase 1 finished but resulting context is 5% over the per-request
  budget because `pinned_zone` itself is 60K tokens
- **WHEN** runtime detects Phase 1's output still overflows
- **THEN** runtime invokes `LLM_compact(prior_anchor, journal_all + pinned_zone)`
  with `framing.strict = true` (target ≤ 5_000 tokens, ruthless drop)
- **AND** new context = `[system, anchor, current_round]` (pinned_zone reset to
  empty)
- **AND** telemetry event `phase2_fired` is emitted with: pinned_zone size,
  Phase 1 input/output sizes, framing reason
- **AND** if Phase 2 itself still does not fit, runtime raises
  `E_OVERFLOW_UNRECOVERABLE` to the runloop (no Phase 3)

### Requirement: R-4 — Cache placement law (canonical zone order)

The prompt sent to the model must always have the canonical five-zone order:
`[system, anchor, pinned_zone, journal, current_round]`. Inter-compaction
windows are append-only.

#### Scenario: round added between compactions

- **GIVEN** a session in steady state with anchor frozen at round N
- **WHEN** the AI completes round N+1 (no compaction triggered)
- **THEN** the prompt for round N+2 is `[system, anchor, pinned_zone, journal
  ++ round_N+1, current_round_N+2]`
- **AND** the byte content of `[system, anchor, pinned_zone]` is identical to
  the round N+1 prompt (codex prefix cache hit)
- **AND** no item in `journal` is rewritten or pruned

#### Scenario: pin marker added mid-window

- **GIVEN** AI emits a pin marker for tool_call_id=T7 in round N+1
- **WHEN** the prompt is built for round N+2
- **THEN** the corresponding tool_result content is appended to `pinned_zone`
  as a synthesised user message: `[Pinned earlier output] tool '<name>'
  (round <K>) returned: <verbatim content>` (per DD-G1, see design.md)
- **AND** the original tool_call/tool_result pair stays adjacent in `journal`
  (not extracted)
- **AND** no other byte in the prompt prefix changes

### Requirement: R-5 — Context visibility to AI (Layer 3)

The runtime must expose the AI's current budget state continuously so the AI
can factor it into multi-step planning.

#### Scenario: AI plans a long sequence under budget pressure

- **GIVEN** total budget 200_000, current usage 173_000, room remaining 27_000
- **WHEN** the runtime builds the next round's prompt
- **THEN** a system-role message (or dedicated metadata channel) carries the
  fields: `total_budget`, `current_usage`, `room_remaining`,
  `anchor_coverage_rounds`, `journal_depth_rounds`
- **AND** the AI's system prompt instructs it to factor these into multi-step
  planning ("if next read is likely 10K and you need to keep doing N more
  steps, consider voluntary summarize first")

### Requirement: R-6 — Voluntary self-summarize primitive (Layer 4)

AI shall be able to invoke `LLM_compact` voluntarily before the harness would
have triggered it.

#### Scenario: AI summarises before risky read

- **GIVEN** AI has 27K room remaining and needs to read a file likely > 30K
- **WHEN** AI emits a `summarize` directive (tool call, assistant metadata,
  or reasoning channel — exact mechanism per DD-S1)
- **THEN** runtime invokes the same `LLM_compact` machinery as a forced
  compaction
- **AND** the new anchor replaces the prior one
- **AND** the AI's next round starts with freshly-budgeted context

### Requirement: R-7 — Override channel: pin / drop / recall (Layer 5)

AI and humans shall be able to mark tool_results for pinning, dropping, or
re-injection.

#### Scenario: pin protects content across compactions

- **GIVEN** tool_call T7 returned a config table the AI will reference 5 rounds
  later
- **WHEN** AI emits `pin(T7)` in the round following T7
- **AND** a Phase 1 compaction fires before round T7+5
- **THEN** T7's content survives verbatim in the post-compaction prompt as a
  synthesised pinned-zone entry (per R-4)

#### Scenario: drop releases content for next compaction

- **GIVEN** tool_call T9 returned a 30K listing the AI is finished using
- **WHEN** AI emits `drop(T9)`
- **AND** the next Phase 1 compaction fires
- **THEN** T9's content is excluded from `LLM_compact`'s input (or replaced
  with a placeholder) so the new anchor does not waste tokens summarising it

#### Scenario: recall re-injects from disk

- **GIVEN** content from round 3 was distilled into the anchor and the original
  tool_result is no longer in the live message stream
- **AND** AI realises mid-round 47 it needs the original content
- **WHEN** AI emits `recall(msg_id_from_round_3)`
- **THEN** runtime reads the original message from disk
- **AND** appends it to journal tail framed as: `[Recalled from earlier]
  tool '<name>' (round 3) returned: <verbatim>` (per DD-G5)
- **AND** recall is idempotent — a second recall of the same msg_id is a no-op
- **AND** the recalled content is itself subject to R-1 self-bounding if it
  exceeds budget

### Requirement: R-8 — Pinned_zone cap and absorption (defensive)

Pinned_zone shall not grow without bound; over-pinning shall trigger
absorption rather than starvation.

#### Scenario: AI defensively pins everything

- **GIVEN** `pinned_zone_max_tokens = round(model_context * 0.30)` (e.g. 60_000
  for a 200K model)
- **WHEN** the cumulative pinned content exceeds the cap
- **THEN** the next compaction event is forced into Phase 2 (absorb pinned
  into anchor), regardless of whether Phase 1 would have fit
- **AND** telemetry tracks `pin_density_per_session` for outlier detection

### Requirement: R-9 — Subagent context management ownership

Subagents (`task` tool) use the same hybrid-llm machinery; their compaction is
billed to the subagent's own account; their anchor / journal / pinned_zone
persist on disk for parent recall.

#### Scenario: parent recalls from completed subagent

- **GIVEN** a subagent session `S2` has completed and its message stream is on
  disk
- **WHEN** the parent emits `recall(sessionId=S2, msg_id=M9)`
- **THEN** runtime loads `M9` from `S2`'s on-disk stream
- **AND** appends it to parent's journal tail framed as: `[Recalled from
  subagent S2] <verbatim>`

#### Scenario: subagent overflows its own context

- **GIVEN** a subagent's context overflows mid-execution
- **WHEN** the subagent's runtime triggers compaction
- **THEN** the same hybrid-llm machinery runs in the subagent's runloop
- **AND** the LLM_compact call is billed to the subagent's selected account /
  model (not the parent's)

### Requirement: R-10 — LLM_compact failure handling

`LLM_compact` failures (network, timeout, malformed output) shall not stall the
runloop; recovery is graceful with bounded retries.

#### Scenario: provider rate limit during compaction

- **GIVEN** `LLM_compact` is invoked and the provider returns 429
- **WHEN** the runtime catches the error
- **THEN** runtime retries exactly 1 time (configurable cap)
- **AND** if the retry fails too, runtime falls back to: keep prior anchor,
  truncate journal at the oldest-round boundary until the prompt fits
- **AND** error event `E_HYBRID_LLM_FAILED` is emitted with retry count and
  fallback applied

#### Scenario: malformed compaction output

- **GIVEN** `LLM_compact` returns content larger than `(prior_anchor +
  journal)` (sanity violation)
- **WHEN** runtime sanity-checks the new anchor size
- **THEN** runtime rejects the output, retries once with stricter framing
- **AND** if still malformed, falls back per the above
- **AND** error event `E_HYBRID_LLM_MALFORMED` is emitted

#### Scenario: hard timeout

- **GIVEN** `LLM_compact` takes longer than 30s (configurable)
- **WHEN** the timeout fires
- **THEN** the in-flight request is aborted
- **AND** the same fallback path runs
- **AND** error event `E_HYBRID_LLM_TIMEOUT` is emitted

### Requirement: R-11 — Provider-agnostic anchor schema

Anchor content must be portable across providers so a session can switch
provider mid-life without losing context.

#### Scenario: session switches from gpt-5.4 to anthropic

- **GIVEN** the prior anchor was produced by gpt-5.4's `LLM_compact`
- **AND** the framing prompt requires plain Markdown / structured text only
  (no `<thinking>`, no provider-specific tokens, no tool_call shapes)
- **WHEN** the next compaction is invoked under anthropic
- **THEN** anthropic's `LLM_compact` reads the prior anchor without parse
  errors and produces a structurally similar new anchor
- **AND** the anchor envelope carries `anchor.version: 1` for forward
  compatibility

### Requirement: R-12 — Migration of pre-existing sessions

Live sessions with various pre-existing histories (narrative anchors from
compaction-redesign, no-anchor legacy, SharedContext relics) must continue
working with the new mechanism.

#### Scenario: opening session with old narrative anchor

- **GIVEN** a session has an `assistant + summary === true` message produced
  by the old narrative kind
- **WHEN** the new runtime loads the session
- **THEN** it accepts the message as a valid anchor (schema unchanged)
- **AND** the next compaction uses hybrid-llm with this anchor as prior

#### Scenario: opening session with no anchor

- **GIVEN** a session has 200 rounds of raw history and no anchor message
- **WHEN** the next compaction triggers
- **THEN** hybrid-llm enters cold-start (chunk-and-merge mode per R-2)
- **AND** the resulting anchor is persisted to the on-disk message stream

#### Scenario: SharedContext / rebind-checkpoint relics

- **GIVEN** a session contains stale SharedContext or rebind-checkpoint state
  on disk (already retired by Phase 13.2-B but cached)
- **WHEN** the new runtime loads the session
- **THEN** these relics are ignored (no parse error, no use)
- **AND** the prompt is rebuilt from the message-stream single source of truth

### Requirement: R-13 — Telemetry per compaction event

Every compaction event shall emit a structured telemetry record sufficient for
post-merge analysis and cost auditing.

#### Scenario: structured event per event

- **GIVEN** any compaction (Phase 1, Phase 2, voluntary, cold-start)
- **WHEN** the event completes (success or fallback)
- **THEN** a JSON event is appended to the telemetry stream containing at
  minimum: `event_id`, `session_id`, `kind=hybrid_llm`, `phase`, `mode`
  (single-pass / chunk-and-merge), `input_tokens`, `output_tokens`,
  `pinned_count_in/out`, `dropped_count_in`, `recall_count_in`,
  `voluntary` (bool), `latency_ms`, `cost_usd_estimate`, `result`
  (`success` / `failed_then_fallback` / `unrecoverable`)
- **AND** the event MUST be emitted before the runloop continues to the next
  round

---

## Acceptance Checks

A build is acceptance-ready when ALL of the following hold:

1. R-1 verified: every variable-size tool listed in design.md DD-2 emits ≤
   `outputBudget` for an artificially over-sized input fixture.
2. R-2 verified: a 12-round session triggers a single Phase 1 compaction whose
   `LLM_compact` input ≤ `anchor + journal_unpinned` (proven by log inspection).
3. R-3 verified: a forced over-pinned fixture triggers Phase 2 with
   `phase2_fired` event present; the result fits per-request budget.
4. R-4 verified: prompt prefix byte hash unchanged across rounds within an
   inter-compaction window (codex cache hit ≥ 95% in the band).
5. R-5 verified: budget metadata visible in system prompt of every round.
6. R-6 verified: an explicit `summarize` directive triggers compaction that
   matches forced-compaction behaviour bit-for-bit (same machinery).
7. R-7 verified: pin / drop / recall integration test covers all three primitives
   end-to-end including idempotent recall and across-compaction pin survival.
8. R-8 verified: pinned_zone cap enforced; over-pinning forces Phase 2.
9. R-9 verified: subagent overflow integration test passes; parent cross-session
   recall returns disk content.
10. R-10 verified: failure injection tests for rate-limit / timeout / malformed
    each follow the documented fallback path.
11. R-11 verified: cross-provider regression test (gpt-5.x ↔ anthropic ↔
    codex) on identical prior anchor input produces structurally similar
    output (judged by the framing prompt's contract checks, not byte
    equality).
12. R-12 verified: legacy-session fixtures (narrative anchor, no-anchor 200
    rounds, no-anchor 1000 rounds, SharedContext relic) all open successfully
    and produce a valid post-compaction prompt.
13. R-13 verified: telemetry events present for every compaction; spot-check
    sample matches schema in data-schema.json.
14. invariants.md statements all hold under fixtures (cache placement law;
    Layer 1+2 self-sufficiency without Layers 3-5; bounded LLM_compact input).
15. Cache hit-rate at 80–90% utilisation band does not regress > 5pp vs the
    pre-merge `living` baseline (compaction-redesign).

If any item is not yet provable at design time, design.md must record the
deferred verification with telemetry-acceptance criteria (G-12 / G-13 style).
