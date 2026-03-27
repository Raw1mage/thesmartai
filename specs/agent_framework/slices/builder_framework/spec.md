# Spec

## Purpose

- Define build-mode behavior so beta-sensitive execution first passes a machine-checkable quiz guard, with prompt text serving only as advisory support and broad hard-guard expansion deferred.

## Requirements

### Requirement: Builder must require staged beta admission for beta-sensitive execution

The system SHALL require a staged beta admission flow before beta-sensitive build-mode execution is allowed to proceed.

#### Scenario: plan_exit compiles mission and defers admission evaluation

- **GIVEN** an approved plan that resolves to a beta-enabled mission
- **WHEN** `plan_exit` completes artifact validation and mission compilation
- **THEN** it persists `mission.beta`, initializes `mission.admission.betaQuiz.status = pending`, and enters build mode without synchronously finalizing quiz evaluation

#### Scenario: allow build execution after correct continuation-time calibration

- **GIVEN** an approved mission with `mission.beta` and pending beta admission
- **WHEN** workflow-runner injects the admission prompt and the LLM answers every required field correctly
- **THEN** beta admission succeeds and execution may continue

#### Scenario: retry once after incorrect continuation-time calibration

- **GIVEN** an approved mission with `mission.beta` and pending beta admission
- **WHEN** the LLM answers any required admission field incorrectly on the first workflow-runner evaluation
- **THEN** runtime records explicit mismatch evidence, sets reflection state, and allows one reflection-based retry

#### Scenario: stop and ask the user after repeated incorrect continuation-time calibration

- **GIVEN** an approved mission with `mission.beta`
- **WHEN** the LLM still answers any required admission field incorrectly on the allowed reflection retry
- **THEN** workflow-runner stops build admission with `product_decision_needed` instead of continuing

### Requirement: Quiz answers must be machine-checkable against mission authority

The system SHALL validate quiz answers against authoritative mission/runtime metadata rather than freeform human interpretation.

#### Scenario: compare answer fields to mission metadata

- **GIVEN** a structured quiz response containing main repo, base branch, implementation repo, implementation branch, and docs write repo
- **WHEN** `mission-consumption` resolves the authority and workflow-runner evaluates the response
- **THEN** each field is compared against the canonical expected value from mission metadata or authoritative mainline context

### Requirement: plan_exit must collect or correct stale branch authority before admission

The system SHALL allow `plan_exit` to collect a missing implementation branch or correct a stale slug-derived branch before workflow-runner admission begins.

#### Scenario: implementation branch missing before build handoff

- **GIVEN** `mission.beta.branchName` is missing during `plan_exit`
- **WHEN** build handoff is prepared
- **THEN** `plan_exit` prompts for `implementationBranch`, persists the answer into `mission.beta`, and only then marks beta admission pending

#### Scenario: stale slug-derived branch from an earlier failed admission

- **GIVEN** `mission.beta.branchName` still equals the old suggested default and the previous beta quiz failed on `implementationBranch`
- **WHEN** `plan_exit` runs again
- **THEN** it reopens branch correction before build handoff instead of preserving the stale value blindly

### Requirement: Prompt text must not be the primary enforcement layer

The system SHALL keep any remaining build-mode wording minimal and non-authoritative once quiz guard exists.

#### Scenario: narration remains but authority stays in quiz evaluation

- **GIVEN** a valid continuation path after quiz admission
- **WHEN** build-mode text is generated for the model
- **THEN** the text communicates current state and stop conditions, and admission authority remains handled by quiz validation rather than workflow prose

### Requirement: Broad hard-guard expansion is deferred by default

The system SHALL treat additional rule-based hard guards as deferred follow-up unless quiz validation exposes a concrete remaining failure mode.

#### Scenario: defer rule-engine expansion after successful quiz coverage

- **GIVEN** quiz guard validation shows high-confidence behavior alignment
- **WHEN** no concrete residual failure requires downstream rule-based enforcement
- **THEN** the system does not expand into a broad hard-guard matrix in this slice

## Acceptance Checks

- `plan_exit` persists approved mission metadata and sets beta admission to pending rather than completing synchronous quiz evaluation.
- Correct continuation-time quiz answers admit beta-sensitive build-mode entry.
- First incorrect quiz answers produce field-level mismatch evidence and one reflection-based retry.
- Repeated incorrect quiz answers stop build admission and ask the user.
- Missing or stale implementation branch metadata is corrected before admission begins.
- Remaining build-mode text is advisory/minimal rather than pseudo-enforcement.
- The plan records hard-guard expansion as deferred rather than silently dropped.
