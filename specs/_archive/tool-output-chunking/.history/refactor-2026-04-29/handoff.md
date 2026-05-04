# Handoff — tool-output-chunking

## Execution Contract

The build agent picking up this plan **shall**:

1. Read `proposal.md`, `spec.md`, `design.md`, `data-schema.json`, `c4.json`,
   `sequence.json`, and `errors.md` before touching any code. These
   artifacts are the authoritative source; do not infer behaviour from
   existing code.
2. Execute phases in `tasks.md` in numeric order, with one exception:
   phases 5.1–5.7 (remaining variable-size tools) may proceed in parallel
   once phase 4 (verify-after-compact) has passed its tests, since each
   tool is independently shippable.
3. Use `bun run ~/.claude/skills/plan-builder/scripts/plan-sync.ts
   specs/tool-output-chunking/` after every task checkbox toggle.
4. Run the full opencode test suite (`bun test packages/opencode`) after
   phases 2, 3, 4, and 6. Test failures block phase advancement.
5. Treat DD-1 (no cursor protocol, no wrapper struct) as a hard
   architectural constraint — the moment a wrapper field, hasMore flag, or
   cursor token is added to the tool result schema, **stop and revise the
   plan**, do not silently rebuild the rejected protocol.
6. Honour AGENTS.md rule 1: every kind-chain transition + every truncation
   event emits a structured log line. No silent fallback between kinds, no
   silent truncation.
7. Preserve byte-identical pass-through behaviour when output fits within
   `ctx.outputBudget` — codex prefix cache integrity depends on it.

## Required Reads

- `specs/tool-output-chunking/proposal.md` — Why / Scope / Constraints / revision history (cursor pivot)
- `specs/tool-output-chunking/spec.md` — R-1..R-7 with GIVEN/WHEN/THEN scenarios + Acceptance Checks
- `specs/tool-output-chunking/design.md` — DD-1..DD-11, Risks/Trade-offs, critical files
- `specs/tool-output-chunking/data-schema.json` — TruncationHint conventions, tweaks.cfg keys, ChunkedDigestRequest, Digest JSON shape, telemetry events
- `specs/tool-output-chunking/c4.json` — 9 components (C1..C9) and the existing components they extend
- `specs/tool-output-chunking/sequence.json` — 5 runtime scenarios that build tests must reproduce
- `specs/tool-output-chunking/test-vectors.json` — concrete input/expected pairs per requirement
- `specs/tool-output-chunking/errors.md` — error catalogue (E_OVERFLOW_UNRECOVERABLE / E_DIGEST_TOOL_CALL / E_DIGEST_TOO_LARGE)
- `specs/tool-output-chunking/observability.md` — events, log prefixes, alert thresholds
- `specs/compaction-redesign/spec.md` — sibling living spec; chunked-digest plugs into the same KIND_CHAIN; verify-after-compact extends `SessionCompaction.run`
- `docs/events/event_20260428_compaction_phase13_single_source.md` — Phase 13 context (single 90% gate; this plan extends it)
- `packages/opencode/src/tool/index.ts` (current) — tool framework dispatch path
- `packages/opencode/src/tool/{read,glob,grep,bash,webfetch,apply_patch,task}.ts` (current) — tools to refactor
- `packages/opencode/src/session/compaction.ts` (current) — `SessionCompaction.run` to extend
- `packages/opencode/src/util/token-estimate.ts` (current) — reused unchanged
- `packages/opencode/src/config/tweaks.ts` (current) — extend with 5 new keys

## Stop Gates In Force

The build agent **shall halt and request user decision** when any of the
following triggers fire:

| # | Trigger | What to do |
|---|---|---|
| SG-1 | Need to add a wrapper field to ToolResult (cursor / hasMore / block index) | DD-1 violation; stop, revise the plan, do not add — even temporarily |
| SG-2 | A variable-size tool's natural slicing strategy is wrong (e.g. JSON file cut mid-object produces unparseable garbage) | Document the failure mode in `errors.md`; either change the tool's slicing semantics or add it to a new `unsliceable_tools` list with tool-specific error |
| SG-3 | Codex prefix-cache hit rate regresses >5pp at 80–90% utilization band | Stop; root-cause; the byte-identical pass-through invariant is broken somewhere |
| SG-4 | Chunked-digest framing prompt cannot produce stable JSON across model versions despite stricter retry | Stop; either revise the framing prompt source or escalate Digest schema (open thread for spec extension) |
| SG-5 | Verify-after-compact infinite-loop suspected (chain length somehow exceeded) | Stop; the chain-length bound is part of DD-9; broken bound = data corruption risk |
| SG-6 | A tool's existing parameters cannot express the arg adjustment in the truncation hint (e.g. tool has no offset-equivalent) | Stop; either extend the tool's API to accept the needed parameter or remove the tool from the variable-size set with explicit reasoning |
| SG-7 | Production observation that AI repeatedly fails to interpret the truncation hint (re-call with same args, ignoring instruction) | Stop; iterate hint format with test vectors; do not paper over with retry logic |
| SG-8 | `plan-sync.ts` reports drift that classifies as `extend` or `refactor` mode | Stop; do not silently absorb scope creep; promote via the appropriate mode |

## Execution-Ready Checklist

Before starting phase 1:

- [ ] All Required Reads above completed
- [ ] Local clone of opencode repo on a branch derived from `main` post-749e7c548 (compaction-redesign Phase 13.1+ landed)
- [ ] `bun test packages/opencode/src/tool/` baseline run captured (for regression comparison)
- [ ] `bun test packages/opencode/src/session/compaction.test.ts` baseline run captured
- [ ] Production codex prefix-cache hit-rate baseline captured at 80–90% utilization band (for SG-3 comparison)
- [ ] beta-workflow admission gate passed (this work touches main product → beta worktree required)

## Validation Evidence (filled during execution)

To be appended as phases complete. Each entry: phase number, evidence type
(unit / integration / live regression), pass/fail, link to test file or log.

| Phase | Evidence | Pass/Fail | Reference |
|---|---|---|---|
| _(filled during build)_ | | | |

## Beta-Workflow Coordination

This plan touches the main opencode product. beta-workflow handles:

- `implementationBranch` derived from main repo's `main`
- `implementationWorktree` at `~/projects/opencode-beta`
- Build / test / smoke cycle on beta worktree
- Fetch-back to main repo `main` after phases pass and user approves merge

plan-builder and beta-workflow operate in parallel. Per memory
`feedback_beta_workflow_terminology`: use plain language ("main repo", "beta
worktree") in user-facing communication; never expose `mainWorktree`
schema field name.
