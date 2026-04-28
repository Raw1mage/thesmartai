# Gaps — tool-output-chunking (context-management)

Identified during design-phase discussion 2026-04-29 (post-refactor). Every
item here must be either resolved in `design.md` Decisions or deferred to a
post-merge telemetry check with explicit acceptance criteria. Design phase
shall not promote `proposed → designed` until each Critical and Important
item is addressed.

Status legend: `OPEN` = not yet addressed; `RESOLVED` = closed in design.md
with reference; `DEFERRED` = explicitly deferred with telemetry plan; `WONTFIX`
= determined not relevant after analysis.

---

## Critical (must resolve in design.md)

### G-1 Pinned_zone violates tool_call/tool_result pairing rule
**Status**: OPEN

All major LLM providers (OpenAI, Anthropic, Codex, Google) require
`tool_call` and its corresponding `tool_result` to be adjacent in the message
sequence. If `pinned_zone` extracts a tool_result and places it after the
new anchor (away from its original tool_call), the provider will reject the
prompt as malformed.

**Direction to design**:
- pinned_zone may not store bare tool_result messages
- Instead, wrap pinned content in a synthesised user/assistant pair that
  carries the verbatim content as text (e.g. `"[Pinned earlier output]
  Tool 'read' on src/foo.ts (round 3) returned: <verbatim content>"`)
- Validate per-provider tolerance: codex / openai / anthropic / google
- Acceptance: design.md DD-X locks the pinned-content message shape and
  links a per-provider compatibility test vector

### G-2 AI does not auto-learn pin / drop / summarize protocol
**Status**: OPEN

Assumption "AI sees system prompt teaching → AI uses Layer 4-5 primitives"
will not hold without explicit prompt engineering. Default LLM behaviour:
ignore unfamiliar protocols.

**Direction to design**:
- Layer 1 + Layer 2 must be **fully self-sufficient** when AI never invokes
  Layer 4-5. System remains correct (just less optimal).
- design.md must include a fall-through invariant statement
- Layer 4-5 enabled gradually post-Layer-1+2-merge; not a launch-blocker
- Design phase must produce framing prompt + test vectors validating that
  AI honours pin/drop instructions when given as input to LLM_compact (a
  weaker requirement than "AI emits pin/drop on its own")
- Acceptance: invariant.md states "no Layer 4-5 dependency for correctness"

### G-3 LLM_compact failure / timeout / malformed output
**Status**: OPEN

Network drops, provider rate limits, OAuth expiry, malformed JSON responses
are common occurrences, not corner cases.

**Direction to design**:
- Retry policy: 1 retry, then fall back to alternate provider/model if
  available
- Timeout: hard ceiling (e.g. 30s); exceed = treat as failure
- Sanity check: new anchor size must be `<` (prior_anchor + journal) — if
  not, reject as LLM failure and retry
- Final-fallback after retries exhausted: keep prior anchor, truncate
  journal at oldest-round boundary until input fits per-request budget
  (graceful degradation: lose some recent journal, but session continues)
- errors.md must enumerate `E_HYBRID_LLM_FAILED`, `E_HYBRID_LLM_TIMEOUT`,
  `E_HYBRID_LLM_MALFORMED`, with recovery strategies
- Acceptance: errors.md + a failure-mode test in test-vectors.json

### G-4 AI defensive over-pinning blows pinned_zone budget
**Status**: OPEN

Natural LLM reaction to "pin protects from compaction": pin everything as
defence. Pinned_zone becomes second unbounded growth.

**Direction to design**:
- Hard cap on pinned_zone size (e.g. 30% of model context); exceed →
  auto-trigger Phase 2 absorbing pinned into anchor
- System prompt must teach "pin is scarce; only for items you will
  re-reference; prefer recall over over-pinning"
- Telemetry: track pin density per session; alert on outliers
- Acceptance: data-schema.json defines `pinned_zone_max_tokens` knob;
  invariants.md states the cap; observability.md tracks pin density

### G-5 Recall semantics underspecified
**Status**: OPEN

Three sub-questions:
1. Does `recall(msg_id)` retrieve the Layer 2-truncated version (already in
   the stream) or the original disk content (full, possibly oversized)?
2. Where does recalled content insert in the live message stream?
3. What if the same msg_id is recalled twice?

**Direction to design**:
- Recall returns **original disk content** (full, untruncated)
- Insertion point: appended to journal tail, framed as user/assistant pair
  ("[Recalled from earlier] tool X output: <verbatim>") to preserve
  pairing rules from G-1
- Idempotent: second recall of same msg_id is a no-op
- Recall result still subject to Layer 2 self-bounding — if disk content
  exceeds budget, Layer 2 truncates with hint pointing to disk source
- Acceptance: design.md DD-X documents recall semantics; sequence.json
  has recall flow; test-vectors.json covers three sub-questions

### G-6 Anchor must be provider-agnostic for switch resilience
**Status**: OPEN

Session may switch provider mid-life (gpt-5.4 → gpt-5.5; codex →
anthropic). The anchor was written by the previous provider. New provider
must understand it and produce next-generation anchor of compatible
quality.

**Direction to design**:
- LLM_compact framing prompt must specify "output is plain
  Markdown/JSON; no provider-specific tokens, no tool-call shapes, no
  `<thinking>` tags"
- Anchor schema versioned (`anchor.version: 1`) for forward compatibility
- Cross-provider regression test: same input + different provider → both
  produce structurally similar anchors
- Acceptance: framing prompt source file + cross-provider test vector

---

## Important (design must lock; misjudgement = bad implementation)

### G-7 Subagent context management ownership
**Status**: OPEN

TaskTool subagents have their own session and their own context window.
Open questions:
1. Does subagent use the same hybrid-llm mechanism for its own overflow?
2. Which account/model pays for subagent's compaction calls?
3. After subagent finishes, what happens to its anchor / pinned_zone /
   journal? Are they retrievable by parent via recall?

**Direction to design**:
- Subagent uses identical hybrid-llm machinery (one mechanism, no fork)
- Billing: subagent's compaction billed to subagent's account (matches its
  primary work)
- Subagent's stream persists on disk; parent can recall messages from it
  via cross-session recall (`recall(sessionID, msg_id)`)
- Acceptance: design.md DD-X sets ownership; sequence.json has
  subagent-overflow flow

### G-8 Phase 2 starvation (Phase 2 itself fails to fit)
**Status**: OPEN

Extreme rare case: Phase 1 over budget → Phase 2 absorbs pinned + journal
→ result still over budget (because prior_anchor is itself overweight and
LLM cannot compress further).

**Direction to design**:
- Phase 2 LLM_compact uses stricter framing ("summary must be ≤ 5000
  tokens; ruthlessly drop detail")
- If still fails after Phase 2: raise `E_OVERFLOW_UNRECOVERABLE` with hint
  "session has structural bloat; consider starting a new session"
- No Phase 3 — bounded chain length, no infinite escalation
- Acceptance: errors.md catalogues E_OVERFLOW_UNRECOVERABLE; user-facing
  message guides remediation

### G-9 Migration matrix for in-flight live sessions
**Status**: OPEN

At deployment, live sessions exist with various pre-existing states:
SharedContext relics, narrative anchors from compaction-redesign, no
anchor at all, partial rebind-checkpoints (already retired by Phase 13.2-B
but cached state may linger).

**Direction to design**:
- Backward-compat: old narrative anchors readable as anchor (schema is
  `assistant + summary === true`, unchanged)
- SharedContext / rebind-checkpoint relics: ignored (already retired)
- No-anchor session: hybrid-llm cold-start path (chunk-and-merge mode)
- New tweaks.cfg keys: optional with defaults — old config still works
- Acceptance: design.md migration section enumerates each pre-existing
  state and its handling; test fixture covers each

---

## Implementation Detail (decide during build)

### G-10 Cold-start UX: 1000-round legacy session opening latency
**Status**: OPEN

chunk-and-merge mode on a 1000-round session can take 30-60 seconds. User
opens old session, sends a message, waits a long time before any response.

**Direction**:
- TUI / admin shows "initialising session memory…" progress indicator
- Cold-start result cached as new anchor on disk; subsequent opens skip
- Optional: background prefetch when admin lists old sessions
- Acceptance: UX flow tested with a 1000-round fixture; user-facing
  feedback present

### G-11 Admin / TUI surface for pin / drop / recall
**Status**: OPEN

Layer 5 human override needs a UI: see what's currently in pinned_zone, see
recent drops, see recall candidates.

**Direction**:
- Phase 1 minimum: list view + click-to-pin / click-to-drop / search-and-recall
- Iterate based on actual usage
- Acceptance: minimum admin UI delivered; usage telemetry instrumented

---

## Watch (post-merge telemetry decides)

### G-12 AI never invokes voluntary `summarize`
**Status**: DEFERRED

Layer 4's voluntary-summarize primitive may never be used by AI in
practice. If post-merge usage rate stays < 5% over 90 days, retire the
primitive.

**Acceptance criterion for retirement**: telemetry shows
`voluntary_summarize_invocation_count / total_compaction_count < 0.05`
across 100+ sessions over 90 days post-merge.

### G-13 Compaction cost runaway
**Status**: DEFERRED

Each hybrid-llm = 1 LLM call. If a session triggers 20+ compactions per
hour, cost balloons.

**Mitigation already in place**: compaction-redesign 30s cooldown window.
**Telemetry**: per-session avg compactions/hour; alert above threshold.
**Acceptance**: alerting configured; no design action required unless data
shows runaway.

### G-14 Multi-modal content (images, files, attachments)
**Status**: DEFERRED

journal / pinned_zone / anchor handling of non-text content needs design.

**Direction (sketch)**:
- LLM_compact converts images to text descriptions in anchor
- Pinned images survive Phase 1 verbatim (token-expensive)
- Phase 2 absorbs pinned images into anchor's text descriptions
- design.md lists this as a phase-2 work item; phase 1 may strip
  multi-modal content with a clear notice

**Acceptance**: deferred until first multi-modal use case requires
behaviour beyond text strip.

---

## Tracking

Update this file as items move from OPEN to RESOLVED/DEFERRED/WONTFIX. Each
RESOLVED entry must link to the `design.md` Decision (DD-N) that closes it.
Each DEFERRED entry must have a telemetry-driven acceptance criterion
written here.
