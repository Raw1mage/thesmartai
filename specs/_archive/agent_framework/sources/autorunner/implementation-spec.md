# Implementation Spec

## Goal

- 建立 `specs/autorunner/` 作為 autorunner 的 canonical semantic root，整合 approved-plan authority、mission consumption、delegated execution baseline、runtime anomaly evidence 與 delegation-first bootstrap contract。

## Scope

### IN

- canonical six-file autorunner contract
- preservation of useful mission-consumption and delegated-execution supporting docs
- clear replacement of dated predecessor roots as active authorities

### OUT

- new runtime implementation work
- daemon / reducer / worker-supervisor expansion
- cms synchronization work

## Assumptions

- `specs/20260315_autorunner/` is the later primary six-file authority for bootstrap/planner/prompt contract.
- `specs/20260313_autorunner-spec-execution-runner/` contributes the earlier runtime evidence baseline plus the mission/delegation supporting slices.
- Once these materials exist under `specs/autorunner/`, the dated autorunner roots are redundant.

## Stop Gates

- Stop if canonicalization would require inventing new behavioral requirements not present in the merged sources.
- Stop if any unique supporting doc cannot be clearly placed under `specs/autorunner/` without loss.
- Do not silently weaken fail-fast / no-fallback language while consolidating.

## Structured Execution Phases

- Phase 1 — create canonical root and six-file contract.
- Phase 2 — preserve useful supporting mission/delegation slices under the canonical root.
- Phase 3 — verify the canonical root supersedes the dated autorunner roots.

## Validation

- Verify `specs/autorunner/` exists and contains the six canonical files.
- Verify the mission-consumption and delegated-execution supporting docs exist under the canonical root.
- Verify the dated autorunner roots are removable without losing unique content.

## Handoff

- Readers should start at `specs/autorunner/`.
- Supporting mission/delegation docs remain referenceable from the same root.
- Dated predecessor roots are no longer the canonical starting point once consolidation completes.
