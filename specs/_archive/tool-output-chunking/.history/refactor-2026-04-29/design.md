# Design: tool-output-chunking

## Context

`compaction-redesign` (merged 2026-04-28, currently `living`) collapsed the
context-management surface to a single 90% overflow gate. That spec assumed
overflow could be solved by reducing *history*. Production reality, observed
the same week, refuted that assumption:

- `system-manager_read_subsession` returning ~170K tokens of a long subsession
  transcript flooded the next prompt to 297K against a 272K context.
- Large `read` against minified bundles, `grep` against monorepo, full
  `webfetch` of API JSON, unbounded `bash` stdout, and `task` subagent
  outputs that themselves saturated their parent context all produce the
  same shape: *one fresh tool result, larger than what the model can
  digest, even with all prior history already compacted to zero*.

Compaction cannot save this. The bottleneck is not the past, it is the
present.

The fix has to act *before* the tool result is concatenated into the message
stream — it has to make sure no single result is too large to absorb in
isolation. And as a backstop, when accumulated multi-round large outputs
together still exceed budget despite each one being individually bounded,
the runtime must be able to drive the model through digesting them in
chunks rather than aborting.

## Goals / Non-Goals

### Goals

- **Single-result ceiling.** No tool, on a single call, can produce a string
  larger than the per-call output budget.
- **Familiar shape.** Tools return their existing string shape. No cursor
  protocol, no wrapper struct, no `hasMore` flag, no block index. Truncation
  is signalled in plain language inside the same string. (User directive
  2026-04-28: "原本 toolcall 回傳什麼，就給什麼。不要創造新概念".)
- **Slice usefulness.** A truncated slice is, on its own, useful — readable
  on a tool-natural boundary (line, paragraph, message, match), never cut
  mid-token-mid-byte.
- **AI-driven continuation.** When AI wants more of a truncated output, it
  re-calls the same tool with the tool's existing arguments adjusted
  (`offset`, narrower `pattern`, smaller `msgIdx` window, `| head` in
  `bash`). The framework does not create a new continuation primitive.
- **Chunked-digest as terminal compaction kind.** When even narrative
  compaction cannot squeeze history below budget — typically because
  several already-bounded large outputs have accumulated — the runtime
  walks the model through chunk-by-chunk digestion as the final fallback
  before declaring overflow unrecoverable.
- **Verify-after-compact.** Every compaction kind's success is
  re-validated against the resulting prompt size; failure escalates to the
  next kind in the chain. Eliminates the 2026-04-28 19:35:01-class race
  where a kind reported success while the prompt was still too large.

### Non-Goals

- Lazy pagination protocol with cursors. Explicitly rejected.
- New tool result schema fields. The string is the string.
- Cross-tool unification of how to "get the next slice". Each tool reuses
  its own arguments; AI learns from the natural-language hint.
- Forcing the user to set `outputBudget`. The default formula must be
  intuitive enough that 99% of installs never touch the knob.
- Solving the model's own context limit. That is a model-side concern.
- Handling type-1 history overflow. compaction-redesign already does that.
- Automatic retry of every tool that returns an over-budget result. If a
  tool cannot produce a useful slice within budget, that is a tool
  implementation bug; the framework reports a hard error rather than
  silently looping.

## Decisions

### DD-1 Tool result shape stays a single string

The tool execution result, as forwarded by `Tool.execute` to the runtime,
remains a single string. No new fields. The truncation signal is a
trailing 1–3 lines of plain language, parseable by the AI but invisible to
schema-strict consumers.

**Why:** user directive 2026-04-28; legacy callers (TUI, IDE, SDK) need
zero migration; AI is the consumer that benefits from the hint and AI
already parses prose well; introducing a wrapper field cascades into
serialisation, persistence, replay, and provider-side interop.

### DD-2 `ctx.outputBudget = min(round(model.context * 0.3), 50_000)` by default

Per-call budget defaults to the smaller of (a) 30% of the active model's
context window or (b) 50K tokens. Both halves of `min()` exist on purpose:
the ratio scales naturally with smaller models (32K context → 9.6K
budget) while the absolute cap protects large-context models (1M context
→ 50K budget, not 300K) from a single tool monopolising the prompt.

**Why:** 30% leaves room for system prompt + history + future tool calls
in the same iteration; 50K absolute cap is large enough for ~1500 lines of
average code (the `read` happy path) and small enough that even a
worst-case tool fits 5 invocations into a 272K-context model alongside a
modest history.

### DD-3 Truncation hint is plain language with a literal anchor token

Every truncated tool result ends with 1–3 lines containing one of the
literal tokens `[Truncated]`, `[Output truncated]`, or `[輸出已截斷]`,
followed by:

- the fraction (e.g. `1500 of 8421 lines`)
- the exact arg adjustment to retrieve other parts (e.g.
  `Use offset=1500 to continue.`)

**Why:** AI parses prose well, but log-grep and regression tests need a
stable anchor. Reserving these three tokens makes telemetry queries
trivial without imposing structured-output cost. Locale variants exist
because the user-visible content of the tool result already follows
session locale; keeping the hint in the same locale avoids a code-mixed
prompt.

### DD-4 Tool implementation is responsible for slicing on semantic boundary

Each variable-size tool decides where to cut its own output. `read` cuts
at line boundary, `grep` cuts at match boundary, `read_subsession` cuts at
message boundary, `bash` cuts at byte boundary preceded by a newline scan
for the nearest line end (best-effort), `apply_patch` rejects with an
error if the diff itself exceeds budget (`apply_patch` slicing has no
useful semantic), `task` (subagent output) cuts at
paragraph-then-sentence-then-line, `webfetch` cuts at HTML-element
boundary if structured else at paragraph then line.

**Why:** centralising slicing in the framework would force a single
heuristic (e.g. char-count) that produces unreadable mid-line cuts for
some tools and over-trims for others. Each tool already knows its own
semantic units.

### DD-5 New compaction kind `chunked-digest` appended after `llm-agent`

`KIND_CHAIN` becomes `narrative → replay-tail → low-cost-server →
llm-agent → chunked-digest`. Chunked-digest is reached only when every
cheaper kind either failed structurally or produced a digest that
verify-after-compact still flagged as too large.

**Why:** chunked-digest is the most expensive kind (multiple round-trips
to the model, each consuming both prompt and output tokens), so cost
monotonicity demands it sits at the end. Placing it *after* `llm-agent`
rather than as a sibling keeps the chain a strict ordering — at most one
escalation per gate evaluation.

### DD-6 Chunked-digest splits at round boundaries only

A *round* = `(user msg, assistant msg with all tool_calls resolved)` pair.
Chunked-digest never splits inside a round. The system prompt and the
most recent unfinished round (if any) are excluded from the chunked input
and re-attached after digestion.

**Why:** splitting inside a round breaks the tool_call/tool_result
pairing, which corrupts the message stream that the digesting LLM sees as
its own history. Round granularity is the smallest unit that keeps every
tool call paired with its result.

### DD-7 Chunked-digest framing prompt forbids tool calls and re-roles AI

Each chunk submitted to the digesting LLM ships with a fixed
`[framing_prompt]` (full text in `data-schema.json`) that:

- explicitly re-roles the model from *executor* to *digester*
- specifies the JSON-shaped digest output (entities, decisions, file refs,
  open threads)
- forbids tool calls in this turn
- on tool-call response, runtime treats as digest failure and retries
  with a stricter framing prompt; aborts after 2 retries

**Why:** the digesting model is reading its own past role-played
executions; without explicit re-roling it tries to "continue" the task
instead of summarising it (observed in early prompt-engineering
prototypes).

### DD-8 Chunked-digest writes a normal Anchor; no new persistence shape

When chunked-digest finalises, the merged digest becomes an Anchor
message (assistant role, `summary === true`) — the same shape as
narrative kind's output. The runtime appends the original triggering user
request after the Anchor; the runloop re-evaluates state on the next
iteration.

**Why:** consistency. Memory.read, Cooldown.shouldThrottle, the
state-driven evaluator, and replay all already understand Anchor messages.
Adding a `chunked-digest`-flavoured persistence shape would fork those
paths.

### DD-9 Verify-after-compact is a step inside `SessionCompaction.run`, not in the runloop

After every kind reports success, `run` itself re-estimates the resulting
prompt size (`estimateMsgsTokenCount(msgs)` already exists from
compaction-redesign's state-driven evaluator) and treats the kind as
failed if the estimate still exceeds the per-request budget. The runloop
is unaware of this — it just calls `run` and gets back either success
(verified) or `E_OVERFLOW_UNRECOVERABLE`.

**Why:** placing verify in the runloop would mean every overflow gate
needed to know about chain escalation. Keeping it inside `run` preserves
the contract: the runloop calls `run`, `run` either fixes the problem or
explains why it can't.

### DD-10 Five tweaks.cfg knobs, all with safe defaults

`tool_output_budget_default`, `tool_output_budget.<tool_name>`,
`chunked_digest_chunk_target_tokens`, `chunked_digest_max_chunks`,
`verify_after_compact`. Schemas and defaults in `data-schema.json`.

**Why:** the `tweaks.cfg` precedent (per `feedback_tweaks_cfg.md` memory)
is that hardcoded thresholds belong in tweaks.cfg with ratio-or-absolute
syntax and fallback defaults. Following that pattern keeps the surface
familiar.

### DD-11 Phase ordering: framework first, two PoC tools, then chunked-digest, then remaining tools

Implementation order:

1. Framework: `ctx.outputBudget` plumbed through `Tool.execute`; tweaks.cfg
   knobs parsed.
2. PoC tools: `read` and `system-manager_read_subsession` rewritten to
   self-bound. End-to-end test that an over-budget read produces a
   useful slice + correct hint.
3. `chunked-digest` kind added; framing prompt iterated against test
   vectors; `KIND_CHAIN` extended; `verify-after-compact` step added.
4. Remaining variable-size tools rewritten one at a time, each with
   per-tool semantic-boundary tests.
5. `errors.md`, `observability.md`, `invariants.md`, telemetry, regression
   suite finalised.

**Why:** the user explicitly accepted the proposal's MVP-first hint. PoC
tools de-risk the framework before scaling out; chunked-digest can be
designed and tested independently of how many tools self-bound, but
testing it end-to-end requires at least one self-bounding tool to
generate realistic over-budget pressure.

## Risks / Trade-offs

| # | Risk | Mitigation |
|---|------|-----------|
| R-1 | Plain-language hint fails to teach AI to adjust args | Test vectors per tool exercising the most common argument-adjustment paths; framing-prompt-style anchor tokens stay stable across releases for log-grep |
| R-2 | Chunked-digest framing prompt yields tool_calls anyway | 2-retry policy with stricter prompt; abort with `E_DIGEST_TOOL_CALL` after retries; telemetry counts retry rate so prompt drift is detectable |
| R-3 | Chunked-digest itself overflows because individual rounds are huge | `chunked_digest_max_chunks=8` ceiling; if exceeded, raise `E_DIGEST_TOO_LARGE`; spec-level acceptance: an individual round larger than `chunked_digest_chunk_target_tokens` is an upstream tool-self-bounding failure, not a chunked-digest failure |
| R-4 | Verify-after-compact infinite loop if every kind fails | Bounded by chain length (5 kinds); after the last kind, raise `E_OVERFLOW_UNRECOVERABLE` |
| R-5 | tweaks.cfg ratio parsing diverges from existing parser | Reuse the existing tweaks.cfg parser used for compaction overflow threshold; integration test that ratio + absolute keys parse identically across both subsystems |
| R-6 | Codex prefix-cache hit rate drops because tool outputs change shape | Self-bounding only kicks in when output exceeds budget; below budget, output is byte-identical to current; acceptance check requires ≤5pp regression in cache hit rate at 80–90% utilization band |
| R-7 | A tool's natural slicing semantics are wrong (e.g. `read` cutting mid-statement in a JSON file) | Slicing is line-based; the AI's hint reads `Use offset=N` so AI can re-call with a different range; for catastrophic cases the AI can fall back to `grep` or `bash cat | jq` |
| R-8 | Subagent output truncated mid-thought | `task` slicing cut at paragraph-then-sentence-then-line; subagent's final result is normally already a structured summary so the slice usually contains the conclusion; the parent agent receives the truncation hint and can re-dispatch with narrower scope |
| R-9 | Chunked-digest produces a digest that misses key information | Framing prompt requires explicit "open threads" section so partially-resolved threads survive; 2026-04-28 production observation that narrative kind alone usually suffices means chunked-digest invocations are rare; quality issues, when they occur, surface in the next iteration as the runloop re-evaluates state |

## Critical Files

- `packages/opencode/src/tool/types.ts` — adds `outputBudget` to tool ctx
- `packages/opencode/src/tool/{read,glob,grep,bash,webfetch,apply_patch,task}.ts` — self-bound implementations
- `packages/opencode/src/tool/system-manager-read-subsession.ts` (or location of the MCP shim) — self-bound implementation
- `packages/opencode/src/tool/index.ts` (or framework dispatch) — populate `ctx.outputBudget` from tweaks.cfg + active model
- `packages/opencode/src/session/compaction.ts` — add `tryChunkedDigest`, extend `KIND_CHAIN`, add `verifyAfterCompact` step inside `run`
- `packages/opencode/src/session/prompt/chunked-digest-framing.md` (new) — framing prompt source
- `packages/opencode/src/session/prompt.ts` — surface `E_OVERFLOW_UNRECOVERABLE` to runloop user-facing path
- `packages/opencode/src/config/tweaks.ts` — parse the 5 new knobs, ratio-or-absolute
- `packages/opencode/src/util/token-estimate.ts` — already exists from compaction-redesign; reused unchanged

## Open Questions (resolved during design promotion)

- ~~Cursor encoding shape?~~ → DD-1: no cursor; plain-language hint.
- ~~Phase 1 MVP scope?~~ → DD-11: framework + 2 PoC tools + chunked-digest, then expand.
- ~~Default budget formula?~~ → DD-2: `min(round(C × 0.3), 50_000)`.
- ~~Where does verify-after-compact live?~~ → DD-9: inside `SessionCompaction.run`.
- ~~`chunked-digest` as kind or escalation from `llm-agent`?~~ → DD-5: kind, appended at end of `KIND_CHAIN`.
