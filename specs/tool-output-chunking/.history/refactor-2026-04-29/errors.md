# Errors — tool-output-chunking

## Error Catalogue

Every error code used at runtime must appear here with its canonical message,
triggering condition, recovery strategy, and responsible layer.

- **E_OVERFLOW_UNRECOVERABLE** — every kind in the extended `KIND_CHAIN`
  (including `chunked-digest`) failed verify-after-compact; the resulting
  prompt is still over budget.
  - **Message**: "Cannot reduce session below per-request budget. Last kind tried: <kind>. Estimated prompt: <est> tokens vs budget <budget>. Hint: at least one round contains content larger than the chunked-digest per-chunk floor — usually a single tool output that the tool's self-bounding could not reduce further. Inspect telemetry `tool.output_truncated` for the offending tool call."
  - **Trigger**: `SessionCompaction.run`'s chain walk reached the end and
    every `verifyAfterCompact` call returned `still-too-large`.
  - **Recovery**: structured error returned to runloop. Runloop surfaces
    to user-facing path with the message; user is expected to either
    rephrase the request, narrow scope, or reduce the offending tool's
    output budget per-tool override. Runloop **shall not** retry compaction
    on the same state — that would loop.
  - **Layer**: `compaction.ts` `SessionCompaction.run`; `prompt.ts` runloop
    user-facing surface.

- **E_DIGEST_TOOL_CALL** — digesting LLM emitted a `tool_call` despite
  framing prompt; retry with stricter framing also failed.
  - **Message**: "Chunked-digest aborted: model emitted tool_call on chunk <k>/<N> across <retries> retries (standard + stricter framing). The digesting model is not honouring the digester role."
  - **Trigger**: `tryChunkedDigest` received tool_call response on a chunk
    after 2 stricter-framing retries (3 total attempts on that chunk).
  - **Recovery**: structured error escalates to `SessionCompaction.run`
    which treats chunked-digest as failed for this run. Since
    chunked-digest is the terminal kind, run returns
    `E_OVERFLOW_UNRECOVERABLE` to the runloop. Telemetry preserves
    `chunked_digest.tool_call_failure` count so prompt drift is
    detectable at SG-4 review.
  - **Layer**: `compaction.ts` `tryChunkedDigest`.

- **E_DIGEST_TOO_LARGE** — round count after splitting exceeds
  `chunked_digest_max_chunks`.
  - **Message**: "Chunked-digest cannot fit history into <max> chunks at target <target> tokens/chunk. Round count: <N>. At least one round is larger than the chunk target — upstream tool self-bounding failed for that round."
  - **Trigger**: round splitter output `N > chunked_digest_max_chunks`,
    OR a single round exceeds `chunked_digest_chunk_target_tokens` so
    chunking cannot proceed.
  - **Recovery**: structured error escalates as in
    `E_DIGEST_TOOL_CALL`. The hint identifies that the bottleneck is
    upstream — a tool produced an over-budget output that wasn't bounded
    correctly — so the action is to inspect that tool's slicing
    implementation.
  - **Layer**: `compaction.ts` round splitter inside `tryChunkedDigest`.

- **TOOL_OUTPUT_ATOMIC_OVER_BUDGET** — tool output is atomic (e.g.
  `apply_patch` diff) and exceeds `ctx.outputBudget`; no useful slice can
  be produced.
  - **Message**: "Tool <name> output is atomic and exceeds budget (<natural> tokens vs <budget>). For apply_patch: split the diff into smaller patches. For other atomic tools: narrow the request scope."
  - **Trigger**: `apply_patch` (or any tool listed as atomic) detects its
    natural output exceeds budget and refuses to slice (DD-4 + R-2 last
    scenario).
  - **Recovery**: tool returns this as a structured error to the runloop.
    AI sees the message and decides how to proceed (split commit, narrow
    scope, etc.). No partial application happens.
  - **Layer**: `tool/apply_patch.ts` (and any future atomic tool).

- **TOOL_TRUNCATION_HINT_MALFORMED** — internal sanity check: a tool
  returned a truncated result whose trailing hint does not match the
  required convention (DD-3).
  - **Message**: "Tool <name> returned truncated output without a valid trailing hint. Anchor token missing or fraction/adjustment incomplete."
  - **Trigger**: framework-level post-condition check after tool returns:
    if `tokens > budget * 0.95` AND trailing 3 lines do not contain a
    DD-3 anchor token, raise.
  - **Recovery**: dev-time only. In production this should surface as a
    test failure; if it ever fires at runtime, the tool's slicer has a
    bug. Log error; let the result through (do not suppress) so user
    sees the bug rather than silent malformed output.
  - **Layer**: tool framework post-dispatch validation.

- **TWEAKS_BUDGET_PARSE_ERROR** — tweaks.cfg key for budget cannot be
  parsed as either number or ratio.
  - **Message**: "tweaks.cfg key <key> = <value> is neither a number nor a valid ratio (e.g. '0.3'). Falling back to default."
  - **Trigger**: `parseTweaksOrDefault` could not interpret the value.
  - **Recovery**: log warn, use computed default (DD-2). Per AGENTS.md
    rule 1 this is **not** silent — the warn line is mandatory.
  - **Layer**: `config/tweaks.ts`.

## Recovery Decision Tree

```python
def handle_compaction_error(err):
    if err.code == "E_OVERFLOW_UNRECOVERABLE":
        # surface to user; do not retry; the offending tool needs investigation
        return "stop-and-surface"
    if err.code == "E_DIGEST_TOOL_CALL":
        # escalates to E_OVERFLOW_UNRECOVERABLE inside run; runloop sees only the latter
        return "internal-only"
    if err.code == "E_DIGEST_TOO_LARGE":
        # same — escalates internally to E_OVERFLOW_UNRECOVERABLE
        return "internal-only"
    if err.code == "TOOL_OUTPUT_ATOMIC_OVER_BUDGET":
        # tool layer; surfaced as tool error to AI; AI decides next call
        return "ai-handles"
    if err.code == "TOOL_TRUNCATION_HINT_MALFORMED":
        # dev-time signal only
        return "log-and-continue"
    if err.code == "TWEAKS_BUDGET_PARSE_ERROR":
        return "log-warn-continue-with-default"
    raise UnknownError(err)
```
