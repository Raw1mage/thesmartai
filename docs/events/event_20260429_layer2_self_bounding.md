# Phase 1 Landed — Layer 2 Tool Self-Bounding

**Spec**: `specs/tool-output-chunking/` (context-management subsystem)
**Phase**: 1 of 5
**Branch**: `beta/phase-1-context-management`
**Tip**: `9dd9d922b`

## What

Every variable-size tool now caps its own output to a per-invocation token budget before returning, so a single tool result cannot dominate the AI's context window. This is the lowest-risk slice of the 5-layer context-management spec; the other 4 layers (hybrid-llm compaction, context visibility, voluntary `compact_now`, pin/drop/recall override) ship in subsequent phases.

## Surface

- **Plugin contract**: `packages/plugin/src/tool.ts` adds `outputBudget?: number` to `ToolContext` (optional, back-compat).
- **Internal context**: `packages/opencode/src/tool/tool.ts` mirrors the field on `Tool.Context`.
- **Helper**: `packages/opencode/src/tool/budget.ts` exposes `ToolBudget.resolve(ctx, toolId)` returning a guaranteed `{tokens, source}` pair plus `computeForModel` and `estimateTokens` (deterministic `ceil(len/4)`).
- **Knobs**: `packages/opencode/src/config/tweaks.ts` adds 5 keys with sync accessor; `templates/system/tweaks.cfg` documents them.
  - `tool_output_budget_absolute_cap` = 50000
  - `tool_output_budget_context_ratio` = 0.30
  - `tool_output_budget_minimum_floor` = 8000
  - `tool_output_budget_task_override` = 60000
  - `tool_output_budget_bash_override` = 40000
- **Bounded tools** (each does post-hoc token check; INV-8 byte-identity for natural-fit cases):
  - `read.ts` — slice content[] in 15% steps, hint with `offset=N`
  - `glob.ts` — slice files[] in 15% steps, hint suggests narrower path/pattern
  - `grep.ts` — token check alongside existing 2000-char redirect-to-file threshold; hint cites reason
  - `bash.ts` — token check alongside existing 30000-char threshold (2000 for search); hint suggests `> /tmp/out.log` + sliced read
  - `webfetch.ts` — head-slice post-conversion (markdown/text/html); hint suggests `Range` header
  - `apply_patch.ts` — bound the assembled summary + LSP errors block
  - `task.ts` — bound `<child_session_output>` block via `taskOverride`; hint references `system-manager_read_subsession msgIdx_from`
  - `mcp/system-manager/src/index.ts read_subsession` — inline budget logic (cross-package can't import opencode); reduces page size when assembled JSON exceeds 50K-token cap
- **Tests**: 87 pass / 0 fail across `read / grep / bash / webfetch / tweaks`. Pre-existing 1 fail each in `apply_patch` ("requires patchText") and `task` ("active_child_dispatch_blocked") — both reproduce on main without Phase 1 changes.

## Why

`compaction-redesign` (merged 2026-04-28, `living`) gives one 90% overflow gate driven by a state-machine evaluator. Production observation surfaced that the gate is structurally insufficient for **type-2 overflow** — a single tool result exceeding the entire context budget. Compaction reduces *history*; the bottleneck here is the *fresh result about to be appended*. Examples observed: `system-manager_read_subsession` returning 170K tokens, `read` of minified bundles, `grep` over a monorepo, `bash` with unbounded stdout, subagent (`task`) outputs that themselves saturated their parent context. Layer 2 is the physical safety net for this failure mode and is independent of all other layers.

## Why this scope (and not a per-tool refactor)

Each bounded tool got the smallest possible insertion: a post-hoc token check that activates only when natural output exceeds budget. INV-8 (byte-identical for natural-fit) is the first invariant in `invariants.md`; codex prefix-cache TTL relies on byte-identical leading bytes round-to-round, so even invisible whitespace changes would break the cache. The shrink-loop pattern (15% steps until fit) avoids per-tool slice-policy decisions and gives every tool the same shape of behaviour.

## What's not done in Phase 1

- `ctx.outputBudget` is not yet **populated by the runtime** with a model-aware value. `ToolBudget.resolve` falls back to `tweaks.toolOutputBudgetSync().absoluteCap` until the runtime side is wired (later phase). This means today the budget is a flat 50K (or 60K for task / 40K for bash) rather than `min(model.contextWindow * 0.30, absoluteCap)`. Tools written against `ToolBudget.resolve` pick up the model-aware budget transparently when wired.
- The pre-existing `Truncate.output` post-hoc layer in `tool/tool.ts:76` (line/byte-based: 2000 lines, 256KB) **stays as the universal safety net**. Layer 2 is the model-aware overlay; the existing layer is still the first gate for most tools in practice.
- Layers 1 (hybrid-llm), 3 (visibility), 4 (compact_now), 5 (pin/drop/recall) all in `specs/tool-output-chunking/` Phases 2-5.

## Loop incident worth recording

Phase 1 was driven part-way through a self-paced ScheduleWakeup loop (1.5 → 1.6 → 1.7 → 1.8). The loop made marginal sense for these tasks because each per-tool bound is tiny and could be batched in one turn. The loop also held me in mechanical mode — when the user pointed out that `@AGENTS.md` was leaking opencode-runtime rules into Claude Code's own constraint set, I had to be told to step back and look at `handoff.md`'s Stop Gates 5 and 6 (XDG backup / Daemon spawn), which are the same misuse pattern. After 1.8 the loop was halted at user request and 1.9–1.16 were completed in a single normal turn. Future Phase 1-shaped work should batch by default, not loop.

## Commits (beta branch)

```
9dd9d922b fix(tool): Phase 1.14 — preserve grep/bash redirect-hint prefix
684fe7f0f feat(tool): Phase 1.12 — system-manager read_subsession Layer 2 bound
49023fb4b feat(tool): Phase 1.11 — task.ts childOutput Layer 2 bound
18bc65f5b feat(tool): Phase 1.10 — apply_patch.ts token-aware Layer 2 bound
a3c3ee79d feat(tool): Phase 1.9 — webfetch.ts token-aware Layer 2 bound
2b8263789 feat(tool): Phase 1.8 — bash.ts token-aware Layer 2 bound
daac3f1d3 feat(tool): Phase 1.7 — grep.ts token-aware Layer 2 bound
15e3d3f95 feat(tool): Phase 1.6 — glob.ts token-aware Layer 2 bound
2d779d053 feat(tool): Phase 1.5 — read.ts token-aware Layer 2 bound
bff787e06 chore(claude): remove @AGENTS.md import from CLAUDE.md  (parallel)
90628b286 feat(tool): Phase 1 foundation — ctx.outputBudget + ToolBudget helper + tweaks knobs
```

## Next

Phase 2 — Layer 1 hybrid-llm + retire kind chain. Highest-risk slice; closes G-1, G-3, G-4, G-6, G-8, G-9. Needs the framing prompt (`specs/tool-output-chunking/hybrid-llm-framing.md`) moved to runtime path and a careful rewrite of `compaction.ts` and `memory.ts`. See `specs/tool-output-chunking/tasks.md ## 2. Phase 2`.
