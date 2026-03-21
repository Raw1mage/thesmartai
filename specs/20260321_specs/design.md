# Design: Plans vs Specs Lifecycle Refactor

## Context

- The current planner runtime stores dated plan packages directly under `/specs/`, while `specs/architecture.md` also serves as the long-lived architecture SSOT.
- This overloads `/specs` with both in-progress plans and durable structure knowledge, which makes repository organization and lifecycle meaning ambiguous.
- Runtime code, prompts, templates, skills, and project rules were all written around the assumption that active planner artifacts live under dated roots in `/specs/`.

## Goals / Non-Goals

**Goals:**

- Give active planner/build artifacts a dedicated dated root under `/plans/`.
- Preserve a clear semantic distinction between planning workspaces and formalized specs.
- Keep `specs/architecture.md` as the stable architecture SSOT.
- Ensure plan/build execution continues to use one authoritative artifact root without mid-stream relocation.

**Non-Goals:**

- Bulk-clean all historical legacy plan roots in the same change.
- Introduce automatic promotion or fallback behavior between `/plans` and `/specs`.

## Decisions

- Active planner artifacts will live under dated roots in `/plans/` inside git repos.
- `plan_exit` will not move artifacts; build mode continues using the same `/plans` root to avoid dual-authority drift.
- Promotion from `/plans` to `/specs` is manual, post-implementation, post-commit, post-merge, and only occurs after explicit user instruction.
- `specs/architecture.md` remains in place and continues to represent long-lived architecture truth rather than active feature-plan storage.
- Legacy dated packages under `/specs/` will be triaged by implementation evidence: implemented ones move to formalized per-feature specs, non-implemented ones move to `/plans`.
- Formalized spec destinations use semantic feature roots such as `specs/plans-specs-lifecycle` instead of dated planner-root naming.
- Compatibility, if needed, will be handled explicitly and fail-fast rather than by silent bidirectional fallback.

## Data / State / Control Flow

- Planning flow: user request → `plan_enter` → create a dated artifact package under `/plans/` → planner refines artifacts in place.
- Build handoff flow: `plan_exit` validates the same package → materializes runtime todos from that `/plans/` package's `tasks.md` → mission stores `/plans` artifact paths.
- Post-merge archival/spec flow: artifacts stay under `/plans` until the user explicitly requests formalization into `/specs`.
- Promotion flow: on explicit user request after execution/commit/merge, move artifacts from a dated `/plans/` root into a semantic per-feature root such as `specs/plans-specs-lifecycle`.
- Legacy migration flow: inspect each existing dated package under `/specs/` for implementation evidence → route implemented packages to semantic per-feature spec roots, route non-implemented packages to `/plans`.
- Architecture documentation flow remains separate: `specs/architecture.md` is read before planning/build and updated when long-lived structure changes.

## Risks / Trade-offs

- Legacy dated plan packages currently under `/specs/` may need temporary compatibility handling -> document and gate compatibility explicitly rather than silently reading both roots.
- Implementation-status triage may be imperfect if evidence is ambiguous -> define explicit evidence thresholds and stop for user decision on ambiguous packages.
- Manual promotion adds one more explicit operator step -> this is acceptable because it preserves semantics and avoids hidden lifecycle transitions.
- Prompt/template/docs drift is likely if only runtime code changes -> include prompt, skill, AGENTS, and architecture updates in the same refactor scope.

## Critical Files

- `packages/opencode/src/session/planner-layout.ts`
- `packages/opencode/src/tool/plan.ts`
- `templates/prompts/SYSTEM.md`
- `templates/skills/planner/SKILL.md`
- `templates/skills/agent-workflow/SKILL.md`
- `AGENTS.md`
- `templates/AGENTS.md`
- `specs/architecture.md`

## Supporting Docs (Optional)

- `docs/events/event_20260322_plans_specs_lifecycle.md`
