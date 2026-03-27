# Implementation Spec

## Goal

- Refactor build-mode so beta-sensitive execution passes a staged beta admission flow: `plan_exit` compiles mission/beta authority and workflow-runner performs the structured quiz evaluation, while redundant hardcoded workflow prompting is reduced and broad hard-guard rule engines are explicitly deferred.

## Scope

### IN

- Introduce a staged builder admission flow that tests whether the LLM can restate the authoritative execution contract before beta-sensitive build work proceeds.
- Use exact or canonicalized answer matching against mission metadata to decide whether build execution is allowed.
- Split responsibilities explicitly: `plan_exit` collects/corrects beta authority and workflow-runner evaluates quiz answers.
- Reduce builder-owned prompt/workflow wording once admission coverage exists.
- Update plan artifacts so implementation can proceed from the mission-setup + continuation-evaluation model.

### OUT

- Building a large rule-based hard-guard framework for many downstream execution scenarios in this slice.
- Replacing the entire autorunner or planner architecture.
- Relying on open-ended natural language self-report without machine-checkable answer validation.
- Inventing fallback mechanisms when the quiz fails or metadata is invalid.

## Assumptions

- Existing `mission.beta` metadata remains the durable source of truth for beta execution context.
- `plan_exit` can safely collect or correct `implementationBranch` before build handoff without pretending that admission is already passed.
- The repo should preserve the current rule that `/plans`, `/specs`, and `docs/events` stay on the authoritative main repo/worktree, but dedicated hard enforcement for every downstream path can be deferred.
- The LLM will reliably answer a bounded admission prompt once mission metadata is in place, and incorrect answers provide high-signal evidence that the session is not calibrated.
- If the staged admission flow resolves the vast majority of observed workflow drift, the system does not need to pay the complexity cost of a large hard-guard matrix immediately.

## Stop Gates

- Stop if existing mission metadata is insufficient to produce deterministic expected answers.
- Stop if `implementationBranch` cannot be collected or corrected before build handoff.
- Stop if the planned quiz format cannot be validated deterministically without heuristic judging.
- Stop if implementation pressure starts pulling this slice back into a broad rule-based hard-guard system.
- Re-enter planning if later evidence shows the staged admission flow is insufficient and a narrower hard-guard subset must be designed.

## Critical Files

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/prompt/runner.txt`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/session/mission-consumption.ts`
- `packages/opencode/src/tool/plan.ts`
- `packages/opencode/src/session/trigger.ts`
- `packages/opencode/test/session/bootstrap-policy.test.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- `packages/opencode/src/tool/plan.test.ts`
- `specs/architecture.md`
- `docs/events/event_20260323_beta_workflow_skill.md`

## Structured Execution Phases

- Phase 1: audit current builder/build-mode authority surfaces and define the mission-setup vs continuation-evaluation split, answer validation contract, bounded retry policy, and rejection/escalation behavior.
- Phase 2: implement `plan_exit` beta authority collection/correction and workflow-runner admission evaluation using mission metadata as the authoritative answer key.
- Phase 3: shrink redundant hardcoded workflow prompting so runtime text becomes minimal state/stop narration rather than pseudo-enforcement.
- Phase 4: validate admission pass/fail behavior, stale branch correction, non-beta compatibility, and documentation alignment.
- Phase 5: document deferred hard-guard candidates only if residual gaps remain after admission validation.

## Validation

- Targeted tests for admission pass on correct mission-aligned answers.
- Targeted tests for rejection/escalation on incorrect main repo / base branch / implementation repo / implementation branch / docs write repo answers after the allowed reflection retry.
- Targeted tests for stale or missing `implementationBranch` correction in `plan_exit`.
- Focused review confirming prompt text is no longer the primary enforcement layer.
- Focused validation confirming beta-sensitive entry remains stable when admission passes.
- Architecture/event documentation updated to reflect the staged admission authority.

## Handoff

- Build agent must read this spec first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md / handoff.md before coding.
- Build agent must materialize runtime todo from tasks.md and preserve planner task naming.
- Build agent must preserve the split between `plan_exit` authority collection and workflow-runner quiz evaluation before deleting or shrinking old prompt wording.
- Build agent must allow reflection-based retry after an incorrect answer; if the model still cannot answer correctly, the flow must stop and ask the user.
- Build agent must keep `implementationBranch` correction as a real mutation path rather than a pseudo-edit quiz.
- Build agent must defer broad hard-guard expansion unless admission validation proves a concrete remaining gap.
