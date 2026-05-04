# Event: Beta Workflow Promotion Closeout Contract

**Date**: 2026-04-02
**Status**: Completed

---

## Requirement

User required beta workflow documentation to enforce a stricter post-merge closeout rule: after the final `test/*` branch merge into main/base branch, completed `/plans/` artifacts must be promoted into related semantic `/specs/` family roots instead of remaining stranded under dated `/plans/` roots.

## Scope

### IN

- Update `beta-workflow` skill contract to make post-merge plan closeout mandatory.
- Update planner lifecycle spec to encode the same rule in requirement/scenario form.
- Update architecture lifecycle wording to align with the new beta finalize closeout contract.
- Add fail-fast rule for unresolved semantic spec-family destination.

### OUT

- Runtime/tooling implementation changes for automatic promotion execution.
- Reorganizing existing `/specs/` family trees.
- Broad rewrite of unrelated planning lifecycle semantics.

## Task Summary

- Added explicit fail-fast rule to beta workflow cleanup + spec closeout stage.
- Added planner-lifecycle scenario for unresolved spec-family destination.
- Synced architecture lifecycle section with fail-fast no-fallback closeout policy.

## Key Decisions

1. Beta finalize completion now includes required post-merge plan closeout into semantic `/specs/` family.
2. Closeout must merge into related existing family when topic already exists.
3. If destination family is ambiguous, workflow must stop for explicit user decision.
4. Silent fallback creation of isolated spec roots is prohibited.

## Validation

- Documentation-only update; no code/runtime behavior changes were applied.
- Updated files:
  - `templates/skills/beta-workflow/SKILL.md`
  - `specs/_archive/agent_framework/slices/builder_framework/sources/planner-lifecycle/spec.md`
  - `specs/architecture.md`
- Architecture Sync: Updated (planner/spec lifecycle contract wording adjusted).
