# Invariants — context-management

Cross-cut guarantees the system MUST hold. Each invariant cites the
enforcement point and the test fixture that verifies it.

---

## INV-1 — Cache placement law (5-zone canonical order)

**Statement**: The prompt sent to the LLM is always
`[system, anchor, pinned_zone, journal, current_round]` in that order.
Inter-compaction windows are append-only — no byte in `[system, anchor,
pinned_zone]` mutates between compaction events.

**Enforcement**:
- `packages/opencode/src/session/prompt.ts` — assertion in `buildPrompt()`.
- Inter-round byte-hash check in test fixture.

**Verifies**: spec.md R-4. Closes the prefix-cache regression risk noted
in design.md Risks.

**Why**: Codex prefix cache TTL relies on byte-identical leading bytes
round-to-round. Any in-place mutation breaks the cache and degrades cost
+ latency materially.

---

## INV-2 — Bounded LLM_compact input size

**Statement**: `LLM_compact`'s input size is `O(prior_anchor +
journal_unpinned)` for Phase 1, and `O(prior_anchor + journal_all +
pinned_zone)` for Phase 2. Both are bounded — they are NOT a function of
total session length.

**Enforcement**:
- `packages/opencode/src/session/compaction.ts` — `runHybridLlm` caps
  input by construction (only loads the relevant subset from Memory).
- Cold-start chunk-and-merge mode is the internal escape valve when even
  this bounded input exceeds the LLM's per-request budget.

**Verifies**: spec.md R-2 acceptance #2.

**Why**: This is the formal property that makes the system scalable
across long sessions. Without it, compaction itself becomes the
bottleneck on a 1000-round session.

---

## INV-3 — Layer 1 + Layer 2 self-sufficiency (closes G-2)

**Statement**: The system remains correct (bounded context, no crashes,
journal preserved within budget, compaction triggers and completes, AI
sees its budget as 0/100% if Layer 3 is disabled) when AI never invokes
any Layer 4 (`compact_now` tool) or Layer 5 (`pin / drop / recall`
markers) primitive.

**Enforcement**:
- `test-vectors.json` includes "AI never uses Layer 3-5" fixtures.
- Layers 3 / 4 / 5 are independently mergeable phases; correctness gate
  applies at the end of each phase merge against a Layer-1+2-only baseline.

**Verifies**: spec.md acceptance check; design.md DD-13.

**Why**: AI is forgetful (well-documented); we cannot rely on it
remembering to use new primitives. The system MUST work even if every
AI run ignores Layer 3-5.

---

## INV-4 — Pinned content preserves tool_call/tool_result adjacency
(closes G-1)

**Statement**: For every `tool_call` message in `journal`, its matching
`tool_result` is the immediately-following message. `pinned_zone`
contains only synthesised user-role messages (envelope shape per DD-4),
never bare tool_result messages. The original tool_call/tool_result pair
in `journal` is NOT moved when its content is pinned.

**Enforcement**:
- `packages/opencode/src/session/prompt.ts` — pinned-zone materialisation
  produces only user-role envelopes; never extracts the original pair.
- Provider-payload validation test ensures cross-provider compatibility
  (OpenAI / Anthropic / Codex / Google).

**Verifies**: spec.md R-7 scenario "pin protects content across
compactions".

**Why**: All major providers reject prompts where tool_call and
tool_result are not adjacent. Violating this invariant produces a hard
prompt-validation error from the provider.

---

## INV-5 — Provider-agnostic anchor body (closes G-6)

**Statement**: Anchor `content` is plain Markdown / structured text only.
No `<thinking>` tags, no provider-specific tokens, no embedded
tool_call/tool_result JSON blocks. Begins with the canonical header
`[Context Anchor v1] generated at <ISO-8601> by <provider>:<model>
covering rounds [<earliest>..<latest>]`.

**Enforcement**:
- `hybrid-llm-framing.md` framing prompt enforces shape contract.
- `packages/opencode/src/session/compaction.ts` — output validator
  rejects non-conforming content as malformed (treated as DD-6
  E_HYBRID_LLM_MALFORMED, retried once).
- Cross-provider regression test in `test-vectors.json`.

**Verifies**: spec.md R-11.

**Why**: Sessions can switch provider mid-life (gpt-5.x ↔ anthropic ↔
codex). Anchor portability is required for switch resilience.

---

## INV-6 — Bounded compaction chain length (no Phase 3) (closes G-8)

**Statement**: A single compaction event triggers at most 2 phases
(Phase 1 → Phase 2). If Phase 2 still fails to fit, the runtime raises
`E_OVERFLOW_UNRECOVERABLE` to the runloop with user-facing remediation
guidance. There is NO Phase 3 escalation.

**Enforcement**:
- `packages/opencode/src/session/compaction.ts` — `runHybridLlm`
  control flow is bounded to two phases.
- `errors.md` catalogues E_OVERFLOW_UNRECOVERABLE.

**Verifies**: spec.md R-3.

**Why**: Infinite escalation is a footgun that masks structural bloat
as transient slowdown. A bounded chain forces the failure to surface
and be remediated.

---

## INV-7 — Telemetry emit is synchronous before runloop continues

**Statement**: The CompactionEvent record is appended to the telemetry
stream BEFORE the runloop continues to the next round. Async-fire-and-
forget emit is forbidden.

**Enforcement**:
- `packages/opencode/src/session/compaction.ts` — emit is sync; runloop
  awaits completion.

**Verifies**: spec.md R-13.

**Why**: Post-merge telemetry is the only way to validate the rollout.
Async emit creates ordering races that lose events under crash or
restart, defeating audit.

---

## INV-8 — Layer 2 byte-identity for natural-fit tool outputs

**Statement**: When a tool's natural output fits within
`ctx.outputBudget`, the returned `tool_result` string is byte-identical
to the pre-Layer-2 implementation's output. Bounding code only activates
when natural output exceeds budget.

**Enforcement**:
- Each Layer 2 tool's implementation has an early-return path when natural
  output ≤ budget.
- Test fixture per tool: small input → byte-equal to pre-merge baseline.

**Verifies**: spec.md R-1 scenario "byte-identical to current behaviour
for any read call whose natural output is ≤ outputBudget".

**Why**: Codex prefix cache and conversation reproducibility depend on
deterministic tool output. Even invisible whitespace changes invalidate
cache.

---

## INV-9 — Recall idempotency

**Statement**: A second `recall(msgId)` (or `recall(sessionId, msgId)`)
within the same compaction window is a no-op. The recalled content
appears in journal at most once per window.

**Enforcement**:
- `packages/opencode/src/session/memory.ts` — `recallMessage` checks
  journal for an existing wrapped recall entry with matching `msgId`
  before appending.

**Verifies**: spec.md R-7 scenario "recall is idempotent".

**Why**: Without idempotency, repeated AI mistakes (or admin double-clicks)
inflate journal with duplicate content, defeating the bounded-input
property of INV-2.

---

## INV-10 — Single source of truth: on-disk message stream

**Statement**: Anchor / journal / pinned_zone are all derivable from the
on-disk message stream. Daemon restart does not require migration; the
next prompt-build re-derives all state from the stream.

**Enforcement**:
- `packages/opencode/src/session/memory.ts` — no in-memory-only state;
  every write commits to disk before being treated as persisted.
- Daemon-restart test fixture: kill -9 then restart; verify next round's
  prompt is identical to what would have been built without the restart.

**Verifies**: proposal.md Constraints "Daemon-restart resilience"; carries
forward compaction-redesign Phase 13 single-SSOT principle.

**Why**: Multiple SSOTs cause divergence under crash / restart / edit. The
on-disk stream is the only source the runtime trusts.
