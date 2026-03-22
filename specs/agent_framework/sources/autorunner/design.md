# Design: autorunner

## Context

- The original dated autorunner specs split the work across two concerns: runtime evidence substrate and planner/bootstrap/delegation contract cleanup.
- The later slices also introduced mission-consumption and delegated-execution supporting docs that are still useful and should live beside the canonical root.
- The canonical semantic root should preserve this layered model without keeping dated directories as active authorities.

## Goals / Non-Goals

**Goals:**

- Keep one canonical semantic root for autorunner.
- Preserve the six-file contract plus supporting slices for mission consumption and delegated execution.
- Express autorunner as approved-plan-driven, mission-consuming, delegation-first execution.
- Preserve fail-fast behavior and explicit runtime evidence.

**Non-Goals:**

- Re-implement daemon topology inside this taxonomy cleanup.
- Flatten every historical note into one markdown blob.
- Keep dated roots as parallel active authorities once useful content is incorporated.

## Decisions

1. `specs/autorunner/` is the canonical root.
2. The main six files capture the stable cross-slice contract.
3. `mission-consumption-baseline.*` and `delegated-execution-baseline.*` remain as supporting docs under the same canonical root.
4. Dated predecessor roots are migration sources only after their useful content has been preserved here.
5. Daemon / multi-access runtime remains documented as a future architectural direction, not a completed guarantee of this canonical spec.

## Data / State / Control Flow

- Planner/build approval produces a mission contract and artifact paths.
- Runtime consumes mission artifacts (`implementation-spec.md`, `tasks.md`, `handoff.md`) into compact execution input.
- Workflow continuation derives bounded delegation hints from mission input plus actionable todo evidence.
- Runtime anomaly detection writes explicit evidence when workflow state loses backing process/worker truth.
- Bootstrap/prompt/workflow surfaces describe this flow as delegation-first, gate-driven continuation.

## Risks / Trade-offs

- Over-consolidation could erase slice boundaries -> mitigate by preserving supporting docs rather than flattening them.
- Under-consolidation could leave dated roots as parallel authorities -> mitigate by moving the preserved supporting docs into `specs/autorunner/`.
- Some older handoff wording is archival -> keep historical notes only where they still explain current canonical behavior.

## Canonical Files

- `/home/pkcs12/projects/opencode/specs/autorunner/proposal.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/spec.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/design.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/implementation-spec.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/tasks.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/handoff.md`

## Supporting Docs

- `/home/pkcs12/projects/opencode/specs/autorunner/mission-consumption-baseline.proposal.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/mission-consumption-baseline.spec.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/mission-consumption-baseline.design.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/mission-consumption-baseline.tasks.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/mission-consumption-baseline.handoff.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/delegated-execution-baseline.proposal.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/delegated-execution-baseline.spec.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/delegated-execution-baseline.design.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/delegated-execution-baseline.tasks.md`
- `/home/pkcs12/projects/opencode/specs/autorunner/delegated-execution-baseline.handoff.md`
