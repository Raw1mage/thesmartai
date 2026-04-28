# Tasks — tool-output-chunking

Phases follow design.md DD-11. Each phase is independently reviewable and
rolls back cleanly without the next. Phase 2's PoC tools are the gate that
de-risks the framework before phase 4 fans out to the rest.

## 1. Tool framework: ctx.outputBudget plumbing

- [ ] 1.1 Add `outputBudget` field to tool invocation context type in `packages/opencode/src/tool/types.ts` (or framework module)
- [ ] 1.2 In tool dispatch, compute `ctx.outputBudget = parseTweaksOrDefault(toolName, model)` per DD-2
- [ ] 1.3 Implement `parseTweaksOrDefault(toolName, model)` reading `tool_output_budget.<name>` then `tool_output_budget_default` then computed default `min(round(C*0.3), 50_000)`
- [ ] 1.4 Extend `packages/opencode/src/config/tweaks.ts` to parse the 5 new keys (DD-10) using ratio-or-absolute syntax shared with existing compaction overflow threshold parser
- [ ] 1.5 Unit test: budget formula returns 9_600 for 32K context, 50_000 for 272K context, 50_000 for 1M context (caps cleanly)
- [ ] 1.6 Unit test: per-tool override beats default; ratio form `0.25` resolves against active model
- [ ] 1.7 Unit test: missing tweaks.cfg falls back to computed default with no error

## 2. PoC tools: read + system-manager_read_subsession

- [ ] 2.1 Add `VARIABLE_SIZE_TOOLS` registry to enablement.json (per `data-schema.json` definition); wire framework to consult it (short_output_tools stays as today)
- [ ] 2.2 Refactor `read` tool to self-bound: estimate natural output size, slice on line boundary if over budget, append `[Truncated]` hint with offset adjustment
- [ ] 2.3 Refactor `system-manager_read_subsession` (or its MCP shim) to self-bound on message boundary; hint uses `msgIdx_from=N` adjustment
- [ ] 2.4 Unit test: `read` natural-fit returns byte-identical to existing behaviour (no hint, no schema change) — preserves codex prefix-cache compatibility
- [ ] 2.5 Unit test: `read` over-budget returns slice ≤ budget tokens, last 1-3 lines contain `[Truncated]` + fraction + offset instruction
- [ ] 2.6 Unit test: `read_subsession` over-budget cuts on message boundary, hint uses `msgIdx_from`
- [ ] 2.7 Integration test: regression on 200K-token transcript that previously caused `Codex WS: Your input exceeds the context window` no longer fails

## 3. Chunked-digest compaction kind

- [ ] 3.1 Create `packages/opencode/src/session/prompt/chunked-digest-framing.md` with standard + stricter framing prompt variants (per DD-7); specify output JSON shape per `data-schema.json#/definitions/Digest`
- [ ] 3.2 Implement round detector in `packages/opencode/src/session/compaction.ts` — find `(user msg, assistant msg with all tool_calls resolved)` pairs; exclude system prompt + trailing unfinished round
- [ ] 3.3 Implement `chunkRoundsByTokenTarget(rounds, target)` greedy splitter; raise `E_DIGEST_TOO_LARGE` if `N > chunked_digest_max_chunks`
- [ ] 3.4 Implement `tryChunkedDigest(sessionID, msgs)` orchestrator: build per-chunk request, call digesting LLM, validate response, merge digest, retry on tool_call up to 2x with stricter framing, abort with `E_DIGEST_TOOL_CALL` after retries
- [ ] 3.5 Implement digest merger: combine `digest_so_far` + `digest_chunk_k` per Digest schema (entities/decisions/file_refs/open_threads — append + dedupe by id)
- [ ] 3.6 Implement final Anchor write: assistant message with `summary === true`, body = JSON.stringify(merged digest), re-attach triggering user request
- [ ] 3.7 Extend `KIND_CHAIN` for every observed value: append `chunked-digest` after `llm-agent` (DD-5)
- [ ] 3.8 Unit test: chunk splitter never cuts inside a round (tool_call/tool_result pair always intact)
- [ ] 3.9 Unit test: chunk splitter excludes system prompt and trailing unfinished round
- [ ] 3.10 Unit test: tool_call response triggers stricter framing on retry; 3rd tool_call raises `E_DIGEST_TOOL_CALL`
- [ ] 3.11 Unit test: digest merger preserves all entries from both inputs without duplication
- [ ] 3.12 Integration test: synthetic 8-round large-output session that overflows even narrative kind succeeds via chunked-digest

## 4. Verify-after-compact

- [ ] 4.1 Implement `verifyAfterCompact(msgs, model)` in `compaction.ts`: call `estimateMsgsTokenCount(msgs)`, compare against per-request budget, return verified/escalation
- [ ] 4.2 Wire into `SessionCompaction.run` between kind-success and run-return: on `still-too-large`, advance kindIndex; on `verified-success`, return success
- [ ] 4.3 Honour `verify_after_compact` tweaks toggle (default true)
- [ ] 4.4 Bound chain length: maximum 5 verify checks per `run` invocation; after chunked-digest if still over budget, raise `E_OVERFLOW_UNRECOVERABLE`
- [ ] 4.5 Unit test: narrative kind succeeds but verify reports too-large → escalates to replay-tail
- [ ] 4.6 Unit test: verify_after_compact=false skips the check (kind reports success directly)
- [ ] 4.7 Unit test: chain exhaustion raises `E_OVERFLOW_UNRECOVERABLE` with `lastTriedKind=chunked-digest`
- [ ] 4.8 Integration test: narrative succeeds + verify succeeds case is unchanged from compaction-redesign baseline (no regression)

## 5. Remaining variable-size tools

Each sub-task: refactor + unit test (over-budget slice + hint fields). Tasks
can ship independently; failure to refactor one tool does not block others.

- [ ] 5.1 `glob` — slice on file-list boundary; hint suggests narrower glob pattern
- [ ] 5.2 `grep` — slice on match boundary; hint suggests narrower pattern or path filter
- [ ] 5.3 `webfetch` — slice on HTML element / paragraph boundary; hint suggests narrower URL or specific anchor
- [ ] 5.4 `bash` — slice on byte boundary preceded by newline scan; hint suggests `| head -N` or `| grep <pattern>` adjustment
- [ ] 5.5 `apply_patch` — atomic; raise structured tool error with suggestion to split commit (no slice)
- [ ] 5.6 `task` (subagent output) — slice on paragraph→sentence→line; hint suggests re-dispatch with narrower scope
- [ ] 5.7 Per-tool integration test: each tool's over-budget regression scenario from production logs reproduces and now bounds correctly

## 6. Runloop surface for terminal error

- [ ] 6.1 In `prompt.ts`, when `SessionCompaction.run` returns `E_OVERFLOW_UNRECOVERABLE`, surface to user-facing path with explanatory message (an individual round exceeds digest per-chunk floor)
- [ ] 6.2 Unit test: terminal error reaches user path verbatim, runloop exits cleanly (no infinite retry)
- [ ] 6.3 Manual smoke: artificial single-round-with-huge-tool-output session reaches the terminal error and surfaces to user (not silent stall)

## 7. Observability + telemetry

- [ ] 7.1 Emit `tool.output_truncated` event on every truncated tool call (fields per observability.md)
- [ ] 7.2 Emit `compaction.kind_attempted` / `compaction.kind_failed` / `compaction.succeeded` / `compaction.unrecoverable` events at each chain boundary
- [ ] 7.3 Add log lines with stable prefixes: `[tool-truncate]`, `[chunked-digest]`, `[verify-after-compact]`
- [ ] 7.4 Verify in production logs (post-merge): truncation events fire on real `read_subsession` overflow scenarios; chunked-digest events fire on synthetic stress test

## 8. Documentation + integration

- [ ] 8.1 Update `specs/architecture.md` Compaction Subsystem section: add chunked-digest kind, verify-after-compact step, KIND_CHAIN ordering update
- [ ] 8.2 Update `specs/architecture.md` Tool Subsystem section (or add one) describing self-bounding contract + truncation hint convention
- [ ] 8.3 Document the 5 tweaks.cfg keys in `templates/etc/opencode/tweaks.cfg.example`
- [ ] 8.4 Write `docs/events/event_<YYYYMMDD>_tool-output-chunking_landing.md` recording merge + verification evidence
- [ ] 8.5 Run `bun run ~/.claude/skills/plan-builder/scripts/plan-sync.ts specs/tool-output-chunking/` to record final sync state

## 9. Validation + promote to verified

- [ ] 9.1 Run full bun test suite for `packages/opencode/src/tool/` and `packages/opencode/src/session/compaction.ts`; all pass
- [ ] 9.2 Live regression: `read_subsession` of 200K-token transcript completes without context-exceeded error
- [ ] 9.3 Live regression: synthetic 8-round large-output session completes via chunked-digest with full telemetry trace
- [ ] 9.4 Codex prefix-cache hit rate at 80–90% utilization band ≤5pp regression vs pre-change baseline (per Acceptance Check)
- [ ] 9.5 Run `plan-promote.ts --to verified` after all evidence captured in handoff.md
