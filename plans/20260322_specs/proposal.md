# Proposal

## Why

- The repository already adopted a `/plans` vs `/specs` lifecycle split, but legacy dated roots under `/specs` still mix shelved plans with implemented feature specs.
- This creates ambiguity about what is an active plan versus a formalized semantic spec root.
- Migration decisions must be grounded in commit-level evidence rather than stale `tasks.md` checkboxes.

## Original Requirement Wording (Baseline)

- "整理/specs資料夾。把未實作的plan移到/plans。把已實作的plans性質相似的合併成單一spec資料夾。"

## Requirement Revision History

- 2026-03-22: User tightened the evidence rule: use commits as primary proof of implementation status; do not trust `tasks.md` alone.
- 2026-03-22: User chose direct telemetry consolidation into the semantic telemetry root.
- 2026-03-22: User chose conservative semantic spec root names.

## Effective Requirement Description

1. Re-triage legacy dated roots under `/specs` using commit history, event closeout, and code blame.
2. Move commit-unimplemented legacy roots into `/plans`.
3. Merge commit-implemented, semantically related dated roots into conservative semantic `/specs/<feature>/` roots.
4. Record the migration evidence and resulting structure in event and architecture docs.

## Scope

### IN

- Legacy dated roots currently stored under `/specs`.
- Semantic consolidation for implemented legacy roots with clear implementation evidence.
- Documentation sync for the resulting repository structure.

### OUT

- Re-implementing unfinished features.
- Rewriting all historical artifact prose for style consistency.
- Promoting any active `/plans/` package into `/specs` without explicit semantic fit.

## Non-Goals

- Solving every remaining historical root in a single pass if evidence is ambiguous.
- Closing all open follow-up tasks inside old packages.

## Constraints

- No silent fallback classification based on checkbox state alone.
- Preserve provenance where practical when folding dated roots into semantic roots.
- Keep `specs/architecture.md` as the only root-level long-lived architecture SSOT.

## What Changes

- Move clearly unimplemented legacy dated roots from `/specs` to `/plans`.
- Normalize clearly implemented dated roots into semantic spec roots such as `account-management`, `planner-lifecycle`, `beta-tool`, and `telemetry`.
- Update event and architecture documentation to describe the final structure.

## Capabilities

### New Capabilities

- Commit-grounded spec triage: repository organization decisions now follow implementation evidence instead of stale checklist state.

### Modified Capabilities

- Legacy spec storage: dated roots will no longer remain in `/specs` merely because they were historically created there.

## Impact

- Affected paths include `/specs`, `/plans`, `docs/events/`, and possibly `specs/architecture.md`.
- Future users and agents get a clearer distinction between active plans and formalized semantic specs.
