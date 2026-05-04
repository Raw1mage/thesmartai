# Spec: tool-output-chunking

## Purpose

The runtime must remain stable when a single tool invocation produces output that
would, on its own, exceed the active model's context window. compaction-redesign
(2026-04-28, living) solved cumulative-history overflow (type-1) but cannot solve
the case where a single fresh tool result is larger than the model's prompt
budget; compaction can only reduce *history*, not the result that is about to be
appended.

This spec defines two co-operating behaviours that together close the gap:

1. **Tool self-bounding** — variable-size tools cap their own output to a
   per-call budget and, if the natural output would exceed the budget, return a
   *standalone-useful* slice plus a natural-language hint telling the AI which
   tool parameters to adjust to retrieve the other parts.
2. **Chunked-digest compaction** — when accumulated history (after self-bounding)
   still exceeds the budget that even narrative-kind compaction cannot recover
   (e.g. multi-round large outputs all relevant), the runtime drives the model
   itself through a chunk-by-chunk digest pass and persists the resulting digest
   as an Anchor.
3. **Verify-after-compact** — every compaction completion is followed by a
   re-estimate of the resulting prompt size; if the estimate still exceeds the
   per-request budget, the runtime escalates to the next compaction kind or to
   chunked-digest as the terminal fallback.

Implementation details live in `design.md`; concrete data shapes live in
`data-schema.json`; functional decomposition in `idef0.json`; state model in
`grafcet.json`.

## Scope

In scope:

- Public behaviour of the tool-context `outputBudget` field.
- Public behaviour of every variable-size tool when its natural output exceeds
  budget (truncation discipline + standalone-useful slice + hint format).
- Public behaviour of the new compaction kind `chunked-digest` and its place in
  `KIND_CHAIN`.
- Public behaviour of the new `verify-after-compact` step inside the compaction
  pipeline.
- The `/etc/opencode/tweaks.cfg` knobs that override the default budget.

Out of scope:

- Type-1 overflow (compaction-redesign, living).
- Cooldown mechanics (compaction-redesign).
- Cursor-style pagination protocols (explicitly rejected by user 2026-04-28 —
  tools must reuse their existing parameters; no new wrapper structure).
- Model-side context-window enlargement.
- UI or TUI changes; the user-visible truncation hint is plain text inside the
  tool's existing string output.

## Requirements

### Requirement: R-1 Tool framework provides `ctx.outputBudget`

The tool execution framework **shall** populate a numeric `ctx.outputBudget`
field on every tool-call's invocation context. The field gives the tool a hard
ceiling on the size (in tokens, estimated via the runtime's existing
`estimateTokenCount` helper) of the single string it returns to the runtime.

#### Scenario: default budget is derived from active model context

- **GIVEN** a tool call is being executed
- **AND** the active model's `limit.context` is C tokens
- **AND** no tweaks.cfg override is in effect for this tool
- **WHEN** the framework computes `ctx.outputBudget`
- **THEN** `ctx.outputBudget = min(round(C * 0.3), 50_000)`

#### Scenario: tweaks.cfg override applies

- **GIVEN** `tweaks.cfg` defines `tool_output_budget_default = 30000`
- **AND** `tweaks.cfg` defines `tool_output_budget.read_subsession = 15000`
- **WHEN** the framework computes `ctx.outputBudget` for `read_subsession`
- **THEN** `ctx.outputBudget = 15000`
- **AND** for any tool without a per-tool override, `ctx.outputBudget = 30000`

#### Scenario: ratio-form override applies

- **GIVEN** `tweaks.cfg` defines `tool_output_budget_default = 0.25`
- **AND** the active model has `limit.context = 200_000`
- **WHEN** the framework computes `ctx.outputBudget`
- **THEN** `ctx.outputBudget = 50_000` (200_000 × 0.25)

### Requirement: R-2 Variable-size tools self-bound to budget

Every tool whose natural output size depends on user-supplied parameters or
external state (the *variable-size set*: `read`, `glob`, `grep`, `webfetch`,
`bash`, `apply_patch`, `task` (subagent output), `system-manager_read_subsession`,
plus any external MCP tool listed under `variable_size_tools` in the
enablement registry) **shall** ensure the string it returns does not exceed
`ctx.outputBudget` tokens.

#### Scenario: natural output already fits — no change

- **GIVEN** a `read` call with default `limit=2000` against a 500-line file
- **WHEN** the tool runs
- **THEN** the tool returns the natural full output unchanged
- **AND** no truncation hint is appended

#### Scenario: natural output exceeds budget — return standalone-useful slice

- **GIVEN** a `read` call with `limit=2000` against an 8421-line minified bundle
- **AND** the natural output would be 120_000 tokens
- **AND** `ctx.outputBudget = 50_000`
- **WHEN** the tool runs
- **THEN** the tool returns a slice that, when token-estimated, is `≤
  ctx.outputBudget`
- **AND** the returned slice is **standalone-useful** — readable on its own,
  cut on a tool-natural semantic boundary (line, paragraph, message, file,
  match, etc.), never mid-token-mid-line-mid-byte

#### Scenario: truncated output carries a natural-language hint

- **GIVEN** a tool truncated its output per the previous scenario
- **WHEN** the tool returns the slice
- **THEN** the slice's trailing 1–3 lines are a plain-English (or plain-Chinese,
  matching session locale) hint identifying:
  - that the output was truncated (using the literal token `[Truncated]`,
    `[Output truncated]`, or `[輸出已截斷]` for log-grep stability)
  - what fraction of the underlying content this slice represents
  - the *exact* tool-arg adjustment to retrieve other parts (e.g.
    `Use offset=1500 to continue.` for `read`, `Use msgIdx_from=200` for
    `read_subsession`, `Narrow your pattern` for `grep`)
- **AND** the hint is part of the same string the runtime appends to the
  message stream (no wrapper field, no structured cursor object)

#### Scenario: short-output tool unchanged

- **GIVEN** a tool listed under `short_output_tools` (`echo`, `cron_create`,
  `question`, etc.)
- **WHEN** the tool runs
- **THEN** the framework does not enforce `ctx.outputBudget` against it
- **AND** the tool's output is returned verbatim regardless of size (in
  practice these tools never approach the budget)

### Requirement: R-3 No cursor protocol, no wrapper

The tool result schema **shall not** introduce any new wrapper field, cursor
token, hasMore flag, or block-index marker. The string the runtime receives
from a tool **is** the string forwarded to the model — exactly as before.

#### Scenario: legacy callers see no behaviour change

- **GIVEN** an existing TUI / IDE / SDK consumer that reads `tool_result.text`
- **WHEN** any tool returns a truncated slice with a natural-language hint
- **THEN** the consumer reads `tool_result.text` and sees the slice plus hint
  inline, with no schema change
- **AND** the consumer requires no migration

### Requirement: R-4 New compaction kind `chunked-digest`

The compaction subsystem **shall** recognise a new kind `chunked-digest`,
positioned at the tail of every observed-flow's `KIND_CHAIN` (after `llm-agent`),
escalating to it when (a) `llm-agent` itself returned a digest still exceeding
the per-request budget, or (b) `llm-agent` is unavailable and prior cheaper
kinds all returned digests still exceeding budget.

#### Scenario: chunked-digest splits on round boundaries

- **GIVEN** the compaction subsystem invokes `chunked-digest`
- **WHEN** it splits the message stream
- **THEN** every chunk boundary falls between a closed *round* — a (user
  message, assistant message with all its tool_calls resolved) pair
- **AND** no tool_call / tool_result pair is split across chunks
- **AND** the system-prompt and the most recent unfinished round (if any) are
  excluded from the chunked input and re-attached after digestion

#### Scenario: chunked-digest sends framing prompt with each chunk

- **GIVEN** chunked-digest is processing chunk *k* of *N*
- **WHEN** it builds the request to the LLM
- **THEN** the request consists of three sections in order:
  - `[digest_so_far]` — the accumulated digest from chunks 1..k-1 (empty for
    k=1)
  - `[chunk_payload]` — chunk *k*'s rounds, verbatim
  - `[framing_prompt]` — a fixed instruction that re-casts the model from
    *executor* to *digester*: it must not perform any task, it must produce
    a JSON-shaped digest of the chunk (entities, decisions, file references,
    open threads), and it must not call tools

#### Scenario: chunked-digest writes terminal anchor

- **GIVEN** chunks 1..N have all been digested
- **WHEN** chunked-digest finalises
- **THEN** the merged digest is written into the message stream as an Anchor
  message (assistant role, `summary === true`)
- **AND** the original user request that triggered the overflow is appended
  after the Anchor
- **AND** the runloop re-evaluates state; the next prompt build sees the
  Anchor + the re-appended user request, not the pre-digest history
- **AND** the digest, once written, is treated like any other Anchor by
  `Memory.read` — no special chunked-digest flag persists

#### Scenario: framing prompt prevents tool calls during digestion

- **GIVEN** chunked-digest is executing chunk *k*
- **WHEN** the LLM responds
- **THEN** if the response contains any `tool_call`, the runtime treats this
  as a digest failure and retries the chunk with a stricter framing prompt
- **AND** after 2 retries the runtime aborts chunked-digest and surfaces an
  error to the runloop (no infinite digest-retry loop)

### Requirement: R-5 `KIND_CHAIN` placement

`SessionCompaction.run`'s priority chain **shall** be extended so that
`chunked-digest` follows `llm-agent` for every `observed` value where
`llm-agent` is currently the terminal kind.

#### Scenario: cost-monotonicity preserved

- **GIVEN** the chain is `narrative → replay-tail → low-cost-server →
  llm-agent → chunked-digest`
- **WHEN** any kind succeeds and produces a digest that fits budget
- **THEN** the chain stops; later kinds are not attempted
- **AND** chunked-digest is reached only when every cheaper kind either
  failed structurally or produced a still-too-large digest

### Requirement: R-6 Verify-after-compact

After every compaction kind reports success, the compaction subsystem
**shall** re-estimate the resulting prompt size and treat the kind as failed
(escalating to the next kind in the chain) if the estimate still exceeds the
per-request budget.

#### Scenario: cheaper kind succeeds but result is still too large

- **GIVEN** the runloop calls `SessionCompaction.run` with `observed:
  "overflow"` and `tokens.total = 290_000` against a 272_000-token model
- **AND** narrative kind writes an Anchor and reports success
- **WHEN** the verify-after-compact step re-estimates the resulting
  message-stream's prompt size
- **THEN** if the estimate is still > the model's per-request budget, the
  subsystem treats narrative as failed for this overflow event
- **AND** the chain advances to `replay-tail`, then if needed to
  `low-cost-server`, then `llm-agent`, then `chunked-digest`

#### Scenario: terminal escalation reaches chunked-digest

- **GIVEN** all earlier kinds failed verify-after-compact
- **WHEN** chunked-digest runs and reports success
- **THEN** verify-after-compact runs once more
- **AND** if the prompt still exceeds budget after chunked-digest, the
  subsystem returns a structured error (`E_OVERFLOW_UNRECOVERABLE`) to the
  runloop instead of silently looping
- **AND** the runloop surfaces the error to the user with a hint that one or
  more individual messages exceed even the most aggressive digest's
  per-message floor

#### Scenario: no infinite verify loop

- **GIVEN** any kind reported success
- **WHEN** verify-after-compact runs
- **THEN** it runs at most once per kind invocation
- **AND** the chain's escalation path is bounded by the chain length (5
  kinds; max 5 verify checks per compaction event)

### Requirement: R-7 Configuration knobs in tweaks.cfg

`/etc/opencode/tweaks.cfg` **shall** support these new keys (all optional;
all with documented defaults):

- `tool_output_budget_default` — number-or-ratio; falls back to
  `min(model.context * 0.3, 50_000)` if absent
- `tool_output_budget.<tool_name>` — number-or-ratio per-tool override
- `chunked_digest_chunk_target_tokens` — target size per chunk submitted to
  the LLM during chunked-digest (default `40_000`)
- `chunked_digest_max_chunks` — hard ceiling on chunk count (default `8`;
  if exceeded, raise `E_DIGEST_TOO_LARGE`)
- `verify_after_compact` — boolean; default `true`; only `false` for
  diagnostic / regression replay

#### Scenario: ratio-form keys parse identically across tool and digest

- **GIVEN** `tool_output_budget_default = 0.3` (ratio form)
- **AND** `chunked_digest_chunk_target_tokens = 40000` (absolute form)
- **WHEN** the runtime loads tweaks.cfg
- **THEN** both keys parse cleanly using the existing tweaks parser; no
  parser fork is introduced

## Acceptance Checks

A change is accepted as completing this spec when, in addition to the
per-Requirement scenarios:

- The full bun test suite for `packages/opencode/src/tool/` and
  `packages/opencode/src/session/compaction.ts` passes.
- A live regression: a session that historically overflowed at
  `read_subsession` of a 200K-token transcript now completes the next LLM
  call without `Codex WS: Your input exceeds the context window` errors.
- A live regression: an artificial 8-round large-output session that would
  previously overflow despite narrative compaction now completes via
  chunked-digest, with telemetry recording every kind that was tried before
  chunked-digest succeeded.
- The codex prefix-cache hit rate at the 80%–90% utilization band does not
  regress more than 5 percentage points relative to the pre-change baseline.
- `docs/events/event_<YYYYMMDD>_tool-output-chunking_landing.md` records
  the merge.
