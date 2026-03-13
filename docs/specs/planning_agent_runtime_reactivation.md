# Planning Agent Runtime Reactivation

Date: 2026-03-13
Status: Draft
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 1. Objective

Reactivate the existing plan-mode / planning-agent runtime path so that non-trivial development and autonomous requests reliably enter a planning-first workflow before execution.

This is not a greenfield planning design.
This is a reactivation plan for capabilities that already exist in the codebase but are not consistently surfacing in normal session behavior.

---

## 2. Confirmed Existing Foundations

The current repo already contains concrete planning runtime pieces.

## 2.1 Plan mode entry/exit tools exist

### `packages/opencode/src/tool/plan-enter.txt`
Confirms:

- there is a dedicated tool to suggest switching to plan agent
- it should be called for complex tasks that benefit from planning first
- it explicitly targets multi-file / architectural work

### `packages/opencode/src/tool/plan-exit.txt`
Confirms:

- there is a dedicated tool to exit planning mode
- it expects the plan to be complete before implementation begins
- it assumes a plan file and clarified questions already exist

### `packages/opencode/src/tool/plan.ts`
Confirms:

- `plan_enter` creates a synthetic user message with `agent: "plan"`
- `plan_exit` creates a synthetic user message with `agent: "build"`
- planning mode and build mode are already represented as agent-switching runtime behavior

This is strong evidence that planning mode is not hypothetical; it already exists as runtime infrastructure.

## 2.2 Plan-mode reminder exists

### `packages/opencode/src/session/reminders.ts`
Confirms:

- planning mode has a documented multi-phase workflow
- the plan file is intended as the core planning artifact
- the planner is expected to ask user questions and then call `plan_exit`

### `packages/opencode/src/session/prompt/plan-reminder-anthropic.txt`
Confirms:

- plan mode is a special execution context
- read-only exploration is enforced except for the plan file
- planning workflow is explicitly staged:
  - understanding
  - ask user questions
  - planning
  - synthesis
  - final plan
  - exit plan mode

This is a near-complete planning interaction contract already present in runtime prompts.

## 2.3 Planning foundations also exist outside plan mode

- `agent-workflow` skill defines autonomous-ready planning contract
- `todowrite` supports structured action metadata
- `question` tool already exists as human-in-the-loop primitive
- multiple skills already use question-driven planning patterns (`refactor-wizard`, `miatdiagram`, etc.)

---

## 3. Current Problem

Despite these foundations, users do not reliably experience planning mode as a standard front door for non-trivial work.

### Current user perception

- the system often behaves like direct execution is the default
- planning may happen informally, but not as an explicit mode switch
- "自動代理" still feels passive because execution begins from weakly structured intent

### Core diagnosis

The planning runtime exists, but it is not strongly connected to request routing and product behavior.

---

## 4. Likely Reasons Planning Mode Is Not Waking Up

## 4.1 Trigger weakness

`plan_enter` exists, but may not be strongly preferred in real request routing.

If the default assistant path can continue directly with execution, plan mode becomes optional rather than primary for non-trivial work.

## 4.2 Competing prompt incentives

Some driver prompts and coding paths emphasize:

- ask less
- do work first
- only ask one question if necessary

That is useful for small tasks, but it suppresses planning mode for complex ones.

## 4.3 Planning is not treated as product-visible stage

The runtime has a plan mode, but the user-facing workflow may not clearly communicate:

- you are now in planning mode
- planning is required before autonomous work
- the system is building a plan file and will switch to build mode after approval

Without this, the feature feels dormant even when pieces exist.

## 4.4 Planning output is not chained directly into continuous work

Even when planning happens, the result may not cleanly hand off into:

- structured todos
- stop gates
- execution-ready autonomy policy

That weakens the value of planning and makes it feel disconnected from runtime execution.

---

## 5. Desired Runtime Behavior

For non-trivial autonomous/dev work, the default product flow should become:

1. detect request as planning-worthy
2. suggest or automatically enter planning mode
3. use question-driven clarification
4. produce a concrete plan file + structured plan state
5. exit planning mode with explicit approval/handoff
6. enter build/continuous execution mode with that plan as substrate

This makes planning mode a first-class front-end to autorunner.

---

## 6. Reactivation Strategy

## Phase A — Make planning trigger first-class

### Goal
Turn plan mode from optional tool path into a default route for non-trivial work.

### Changes

- explicitly classify request types that should prefer `plan_enter`
- make autonomous/dev/architecture-sensitive requests prefer planning first
- preserve direct execution for trivial work only

### Product effect

Users should feel that the system naturally says:

- this needs planning first
- let’s shape the plan before implementation

## Phase B — Align plan mode with current planning contracts

### Goal
Unify old plan-mode behavior with current repo planning doctrine.

### Changes

- align plan-mode reminder with `agent-workflow`
- align plan output with `todowrite`/action metadata
- align question usage with `planning_agent_question_contract.md`

### Product effect

Planning mode becomes compatible with current autonomous execution needs rather than remaining an older isolated flow.

## Phase C — Make plan output runtime-consumable

### Goal
Ensure planning is not just document writing.

### Changes

- plan file remains human-readable artifact
- also materialize structured plan state usable by autorunner
- include goal / todos / validation / stop gates / autonomy policy

### Product effect

Planning becomes the substrate for continuous work mode.

## Phase D — Tie `plan_exit` into continuous work handoff

### Goal
After planning is approved, the system should move naturally into execution.

### Changes

- on `plan_exit`, transition into build/continuous work with plan context
- avoid making the user restate the plan in a new prompt

### Product effect

This is where the user starts feeling “I planned once, and now the AI keeps going.”

---

## 7. Required Runtime Contracts

## 7.1 Planning trigger contract

There must be explicit rules for when planning mode is preferred.

Suggested triggers:

- non-trivial multi-file dev work
- architecture-sensitive tasks
- autonomous/continuous execution requests
- tasks with likely approval/decision gates
- tasks with unclear scope or subagent decomposition

## 7.2 Planning question contract

Planning mode must use the already-defined question contract:

- ask only execution-relevant questions
- prefer MCP `question` for structured decisions
- default to 1–3 questions per round
- stop when planning-complete threshold is met

## 7.3 Planning output contract

Planning mode should produce:

- plan file
- structured draft plan
- todo/action metadata candidates
- stop gates
- validation target

## 7.4 Exit handoff contract

`plan_exit` should not be treated as a UI nicety.
It should act as the bridge from:

- planning context
- to execution context

---

## 8. Product-Visible Improvements After Reactivation

If reactivated correctly, users should notice:

1. fewer vague implementation starts
2. fewer repeated “go on” nudges
3. more structured clarification before work begins
4. more confidence that autonomous mode knows what it is doing
5. smoother transition from planning to execution

---

## 9. Risks

## 9.1 Over-triggering plan mode

If planning mode activates too often, it becomes friction.

Mitigation:
- keep trivial tasks on direct execution path
- use explicit trigger thresholds

## 9.2 Old plan-mode contract drifts from current repo planning doctrine

The existing plan-mode reminders may reflect an older mental model.

Mitigation:
- update plan-mode prompts to align with `agent-workflow`, `planning_agent_revival`, and `planning_agent_question_contract`

## 9.3 Planning still does not affect runtime execution

If plan mode writes a plan file but does not feed autorunner, users will still feel a disconnect.

Mitigation:
- require structured handoff package in addition to the plan file

---

## 10. Success Criteria

Reactivation is successful when:

1. the system reliably enters planning mode for non-trivial autonomous/dev requests
2. plan mode clearly uses question-driven clarification
3. plan mode produces a plan that is visibly execution-ready
4. `plan_exit` naturally transitions into build/continuous execution
5. users feel that planning is now an active part of the product, not a dormant feature

---

## 11. Recommended Immediate Next Slice

The smallest practical reactivation slice is:

1. update plan-mode prompt/reminder to current planning contract
2. define trigger rules that prefer `plan_enter` for non-trivial autonomous/dev tasks
3. make plan output include structured handoff fields
4. keep current execution model otherwise unchanged

This would revive planning mode without requiring immediate daemon-substrate changes.
