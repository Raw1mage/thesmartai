# Handoff — compaction-redesign

## Execution Contract

The build agent picking up this plan **shall**:

1. Read `proposal.md`, `spec.md`, `design.md`, `data-schema.json`, `c4.json`,
   `sequence.json` before touching any code. These artifacts are the
   authoritative source; do not infer behaviour from existing code.
2. Execute phases in `tasks.md` in numeric order. Each phase is gated by its
   own validation (unit tests, manual smoke). Do not start phase N+1 with
   any phase N task in `[!]` blocked or `[?]` undecided state.
3. Use `bun run ~/projects/skills/plan-builder/scripts/plan-sync.ts
   specs/compaction-redesign/` after every task checkbox toggle.
4. Run the full opencode test suite (`bun test packages/opencode`) after
   phases 4, 7, and 11. Test failures block phase advancement.
5. Stay within `Memory`/`Anchor`/`Cooldown` as the only public concepts.
   Adding a fourth concept during build = stop and revise the plan.
6. Honour AGENTS.md rule 1: every kind-chain transition in `run()` emits a
   `log.info` line. No silent fallback between kinds.

## Required Reads

- `specs/compaction-redesign/proposal.md` — Why / Scope / Design Decisions DD-1..DD-10
- `specs/compaction-redesign/spec.md` — R-1..R-9 with GIVEN/WHEN/THEN scenarios
- `specs/compaction-redesign/design.md` — state-driven algorithm, KIND_CHAIN + INJECT_CONTINUE tables, critical files, risks
- `specs/compaction-redesign/data-schema.json` — type contracts (SessionMemory, TurnSummary, Anchor, RunInput)
- `specs/compaction-redesign/c4.json` — component map; especially the `removed` array for deleted concepts
- `specs/compaction-redesign/sequence.json` — 7 runtime scenarios that the build must reproduce in tests
- `specs/compaction-redesign/test-vectors.json` — concrete input/expected pairs per requirement
- `docs/events/event_20260427_runloop_rebind_loop.md` — the bug class structurally eliminated by R-6
- `docs/events/event_20260427_compaction_priority_and_cooldown_gap.md` — the bug class structurally eliminated by DD-7
- `packages/opencode/src/session/compaction.ts` (current) — what's being replaced
- `packages/opencode/src/session/shared-context.ts` (current) — what's being slimmed
- `packages/opencode/src/session/prompt.ts` lines 1133-1643 (current runloop body) — three call sites being collapsed
- `packages/opencode/src/session/processor.ts` lines 700-740 (current mid-stream account-switch detection) — `markRebindCompaction` call being removed

## Stop Gates In Force

The build agent **shall halt and request user decision** when any of the
following triggers fire:

| # | Trigger | What to do |
|---|---|---|
| SG-1 | KIND_CHAIN table needs a 6th kind (new compaction strategy beyond the five enumerated) | Revise plan via `plan-promote --mode revise`; do not add ad hoc |
| SG-2 | Discovered caller of removed API (`markRebindCompaction`, `pendingRebindCompaction`, etc.) outside in-repo code | Stop; surface in handoff log; user decides whether to extend deprecation window |
| SG-3 | Existing test in `compaction.test.ts` cannot be made to pass without breaking R-1..R-9 | Stop; revise spec or implementation; do not weaken acceptance |
| SG-4 | Manual `/compact` smoke shows non-zero codex API calls when `Memory.turnSummaries` is non-empty and within budget | R-2 acceptance violated; stop and debug before continuing |
| SG-5 | Memory render output for an LLM-call exceeds active model context | Stop; reconsider 30% budget constant; do not silently truncate |
| SG-6 | Daemon restart smoke test loses session continuity | Stop; rebind-recovery path is broken; root-cause before continuing |
| SG-7 | XDG backup not made before phase 1 starts | Stop; create backup per project AGENTS.md before any code edit |
| SG-8 | Subagent dispatch needed (e.g. concurrent file edits across many components) | Surface for user approval; do not self-dispatch from inside this plan |

## Execution-Ready Checklist

Before starting phase 1:

- [ ] `bun run ~/projects/skills/plan-builder/scripts/plan-state.ts specs/compaction-redesign/` returns `state: planned`
- [ ] `bun run ~/projects/skills/plan-builder/scripts/plan-validate.ts specs/compaction-redesign/` returns PASS for all required artifacts
- [ ] XDG whitelist backed up to `~/.config/opencode.bak-<YYYYMMDD-HHMM>-compaction-redesign/` per project AGENTS.md
- [ ] Daemon restart capability available (system-manager:restart_self MCP tool reachable)
- [ ] Current branch is up-to-date with `main`; no uncommitted changes in scope files
- [ ] Existing `compaction.test.ts` passes locally (`bun test packages/opencode/src/session/compaction.test.ts`)
- [ ] Aware that build mode arming (per plan-builder §16.5b) will fire on first code-edit attempt to this spec
