# Design: Planner Lifecycle

## Context

- The current planner runtime previously stored dated plan packages directly under `/specs/`, while `specs/architecture.md` also served as the long-lived architecture SSOT.
- Planner behavior also drifted into creating fragmented sibling plan roots for the same workstream.
- Todo authority was too monolithic: build-mode strictness made sense, but plan-mode exploratory work also needs a supported working-ledger model.

## Goals / Non-Goals

**Goals:**

- Give active planner/build artifacts a dedicated dated root under `/plans/`.
- Preserve a clear semantic distinction between planning workspaces and formalized specs.
- Keep `specs/architecture.md` as the stable architecture SSOT.
- Ensure same-workstream follow-up extends the same plan root by default.
- Make todo authority mode-aware: relaxed in plan mode, strict in build mode.

**Non-Goals:**

- Bulk-clean all historical legacy plan roots in the same change.
- Introduce automatic promotion or fallback behavior between `/plans` and `/specs`.

## Decisions

- Active planner artifacts live under dated roots in `/plans/` inside git repos.
- `plan_exit` will not move artifacts; build mode continues using the same `/plans` root to avoid dual-authority drift.
- The same workstream extends the same plan root by default; opening a new sibling root requires explicit user approval.
- Todo authority is mode-aware: plan mode is a relaxed working ledger, build mode is a strict execution ledger.
- Promotion from `/plans` to `/specs` is manual, post-implementation, post-commit, post-merge, and only occurs after explicit user instruction.
- `specs/architecture.md` remains in place and continues to represent long-lived architecture truth rather than active feature-plan storage.
- Legacy dated packages under `/specs/` are triaged by implementation evidence: implemented ones move to formalized per-feature specs, non-implemented ones move to `/plans`.

## Data / State / Control Flow

- Planning flow: user request → `plan_enter` → create a dated artifact package under `/plans/` → planner refines artifacts in place.
- Plan-mode todo flow: exploratory breakdowns and debug checkpoints may be tracked as a working ledger.
- Build handoff flow: `plan_exit` validates the same package → switches todo authority from relaxed working ledger to strict execution ledger → materializes runtime todos from that `/plans/` package's `tasks.md` → mission stores `/plans` artifact paths.
- Post-merge archival/spec flow: artifacts stay under `/plans` until the user explicitly requests formalization into `/specs`.
- Promotion flow: on explicit user request after execution/commit/merge, move artifacts from a dated `/plans/` root into a semantic per-feature root.
- Legacy migration flow: inspect each existing dated package under `/specs/` for implementation evidence → route implemented packages to semantic per-feature spec roots, route non-implemented packages to `/plans`.

## Risks / Trade-offs

- Legacy dated plan packages currently under `/specs/` may need temporary compatibility handling -> document and gate compatibility explicitly rather than silently reading both roots.
- Implementation-status triage may be imperfect if evidence is ambiguous -> define explicit evidence thresholds and stop for user decision on ambiguous packages.
- Relaxed todo use in plan mode could leak into build semantics -> enforce the switch at `plan_exit` and document mode-aware authority clearly.
- Manual promotion adds one more explicit operator step -> this is acceptable because it preserves semantics and avoids hidden lifecycle transitions.

## Critical Files

- `packages/opencode/src/session/planner-layout.ts`
- `packages/opencode/src/tool/plan.ts`
- `templates/prompts/SYSTEM.md`
- `templates/skills/planner/SKILL.md`
- `templates/skills/agent-workflow/SKILL.md`
- `AGENTS.md`
- `templates/AGENTS.md`
- `specs/architecture.md`
