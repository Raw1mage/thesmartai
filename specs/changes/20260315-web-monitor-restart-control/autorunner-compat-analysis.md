# Autorunner Compatibility Analysis

## Goal

Confirm whether the current architecture is sufficient for autorunner to maintain session task execution according to the emerging `plan/build` contract.

## Findings

### 1. Autorunner already depends on plan-derived mission artifacts

`packages/opencode/src/session/workflow-runner.ts` currently requires:

- root session
- autonomous enabled
- approved mission
- mission source = `openspec_compiled_plan`
- mission contract = `implementation_spec`
- mission executionReady = true

If these are missing, autorunner stops with `mission_not_approved`.

This means autorunner is **already structurally coupled to plan artifacts**, not merely to chat memory.

### 2. Autorunner already depends on todo state as its immediate execution surface

Continuation decisions are made from:

- current todo list
- dependency readiness
- approval / decision / wait gates
- active subtask count
- runtime workflow state

This aligns well with the target model where todo is the runtime projection of specs.

### 3. Autorunner already consumes handoff/mission artifacts for execution context

`packages/opencode/src/session/mission-consumption.ts` proves autorunner can consume:

- `implementation-spec.md`
- `tasks.md`
- `handoff.md`

and derive:

- execution checklist
- required reads
- stop gates
- delegated execution role hints

So the architecture is **partially ready** for plan-driven session maintenance.

### 4. Autorunner now has a first dedicated runner-level prompt asset, but only phase-1 binding

A dedicated runner asset now exists at:

- `packages/opencode/src/session/prompt/runner.txt`

Current orchestration guidance appears to come from:

- hardcoded workflow logic in `workflow-runner.ts`
- runner contract prefixed continuation text via `workflow-runner.ts`
- optional `smart-runner-governor` advisory prompt

This means autorunner currently has:

- strong runtime decision logic
- a first explicit runner-specific identity asset
- but still only a partial runner-specific narration / governance binding

### 5. Autorunner is closer to a workflow controller than a full session governor

Today it can:

- queue/resume autonomous continuation
- stop at approval / decision / wait gates
- synthesize continuation messages
- inspect queue health
- emit workflow health summaries and anomalies

But it is not yet fully defined as:

- long-lived session governor
- explicit owner of plan/build mode transitions
- explicit second conversational AI with well-defined speaking rights

### 6. Smart-runner-governor is adjacent, but not yet the runner contract

`smart-runner-governor.ts` introduces advisory/governor reasoning, but it is:

- dry-run/advisory oriented
- not clearly the same thing as a runner-level system prompt
- not yet the authoritative contract for session-wide orchestration identity

## Compatibility verdict

### Sufficient today for

- plan-derived todo execution
- mission-based continuation
- approval/decision/wait stopping
- queue resume and health inspection

### Insufficient today for

- treating autorunner as the authoritative session governor across all layers
- giving autorunner a distinct stable conversational/operator identity
- making autorunner the explicit owner of `plan/build` mode maintenance

## Recommended next step

Continue deepening the dedicated runner-level contract so it defines and enforces:

- autorunner identity
- authority boundaries
- plan/build maintenance responsibility
- when it may narrate vs when it should stay silent
- how it interacts with planner artifacts, todo, and workflow gates
- whether/how it can speak directly in-session as a second AI

## Bottom line

The current architecture is **good enough to support autorunner following the active plan**, but **not yet complete enough to make autorunner the explicit global session governor** you want.
