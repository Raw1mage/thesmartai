# Planning Agent Revival

Date: 2026-03-13
Status: Draft
Branch: autorunner
Workspace: /home/pkcs12/projects/opencode-runner

## 1. Objective

Revive and formalize a planning-first agent/workflow that helps the user turn vague implementation intent into a structured, autonomous-ready execution plan before autorunner begins continuous work.

The key idea is:

- humans should spend more effort clarifying the plan
- the system should make that clarification easier, faster, and more structured
- autorunner should consume a high-quality plan instead of improvising from an underspecified request

This spec defines a planning layer that uses question-driven clarification, structured plan output, and existing CMS/OpenCode workflow assets.

---

## 2. Problem Statement

OpenCode already contains many relevant foundations:

- `agent-workflow` as the baseline planning contract
- `todowrite` with action metadata
- Smart Runner / autonomous workflow / stop gates
- multiple subagent types and workflow patterns
- question-based user interaction primitives

But in practice, these planning capabilities are not consistently being activated before execution.

### User-visible symptom

Even with "自動代理" enabled, the system still feels passive:

- do one step
- stop
- wait for another push

Part of that is an execution-model problem.

But part of it is a planning-quality problem:

- goals are underspecified
- step boundaries are unclear
- stop gates are not explicit enough
- approval/decision boundaries are not formalized early
- subagent / workflow selection is left too implicit

This causes the runner to behave conservatively, or to oscillate between action and hesitation.

### Core diagnosis

The planning substrate exists, but its activation path is weak.

The system currently lacks a reliably triggered, user-guided planning mode that:

1. asks the right blocking questions early
2. produces structured execution contracts
3. hands the result to autorunner in a form it can continuously execute

---

## 3. Product Goal

The first user-facing objective is not “better architecture wording.”
It is this experience:

> I give the AI a plan or a vague goal, and it helps me sharpen the plan until it becomes safe and actionable. Then the AI can continue working with much less need for repeated chat turns.

That means planning agent revival is the front door to continuous work mode.

---

## 4. Role of the Planning Agent

The planning agent is not a generic brainstorming bot.
It is a **plan-construction agent**.

Its job is to transform user intent into a runtime-ready plan.

### It must produce:

- clear goal
- IN / OUT scope
- assumptions
- validation targets
- stop gates
- structured todos
- action metadata
- subagent/workflow suggestions
- operator review points

### It must not stop at:

- vague prose summaries
- generic suggestions without structure
- freeform discussion that never becomes execution-ready

---

## 5. Why Question-Driven Planning Matters

The repo already has an important clue:

- autonomous success requires more planning, not less
- question/approval/decision gates already exist
- structured todos/action metadata already exist

Therefore the planning agent should explicitly use **MCP `question`** as a first-class planning primitive.

### The planning loop should be:

1. infer missing execution-critical information
2. ask structured blocking questions
3. absorb user answers
4. refine plan structure
5. repeat until plan is execution-ready

This makes planning a guided narrowing process, not an unstructured chat.

---

## 6. When Planning Mode Must Trigger

Planning mode should become the default front-end for non-trivial autonomous work.

## 6.1 Mandatory trigger cases

Planning agent should activate when the user asks for:

- implementation of a non-trivial feature
- refactor / architecture-sensitive change
- multi-step debugging
- autonomous / continuous execution
- long-running task bundles
- tasks involving multiple subagents or validation stages

## 6.2 Optional trigger cases

Planning agent may also activate for:

- ambiguous enhancement requests
- broad “investigate and fix” tasks
- tasks likely to require approval or product decision branches

## 6.3 Skip cases

Planning mode can be skipped for:

- trivial one-file edits
- purely informational questions
- simple command execution
- already-structured follow-up slices inside an active plan

---

## 7. Planning Agent Interaction Model

## 7.1 Conversation goal

The planning agent should help the user think through implementation details without requiring the user to manually remember every planning axis.

The user should feel:

- guided
- not interrogated randomly
- progressively clearer
- increasingly confident that the plan is executable

## 7.2 Question style

Questions should be:

- blocking only when necessary
- concise
- grouped by decision axis
- ideally choice-based when possible

Examples of planning axes:

- scope boundary
- implementation priority
- acceptable automation level
- approval requirements
- validation expectations
- rollback / risk posture
- subagent decomposition

## 7.3 Question tool usage

Use MCP `question` for:

- decision forks
- priority selection
- explicit approval boundaries
- scope narrowing
- validation preference selection

Avoid overusing freeform questioning when a structured choice would accelerate planning.

---

## 8. Planning Output Contract

The planning agent should produce output that autorunner can consume with minimal reinterpretation.

## 8.1 Required output sections

### Goal
A one-sentence execution objective.

### Scope
- IN
- OUT

### Assumptions
Explicit assumptions that affect execution.

### Stop gates
When autorunner must pause.

### Validation plan
How success will be checked.

### Structured todos
Each todo should include or enable:

- content
- priority
- dependencies
- action kind
- risk
- needsApproval
- canDelegate
- waitingOn

### Subagent/workflow plan
For each major slice:

- whether main agent should do it
- whether it should delegate
- which subagent type fits best
- what validation is expected after delegation

## 8.2 Preferred machine-adjacent format

This does not have to be raw JSON for the user, but the final representation should be structurally mappable to:

- `todowrite`
- workflow policy
- approval gates
- validation tasks
- later daemon execution contracts

---

## 9. Existing CMS/OpenCode Foundations to Reuse

Planning revival should not be built from scratch.

## 9.1 Reuse candidates

### `agent-workflow`
Already defines:

- planning before execution
- goal / todos / stop gates / validation structure
- autonomous-ready plan skeleton

### `todowrite` + action metadata
Already provides:

- structured todo substrate
- implementation/delegate/wait/approval/decision semantics

### Smart Runner governance
Already provides:

- bounded advice
- replan / ask-user / approval / risk-pause concepts

### question / approval paths
Already provide:

- human-in-the-loop interaction primitives
- explicit wait states

### existing subagent taxonomy
Already provides:

- coding
- testing
- docs
- explore
- review

These are exactly the kinds of roles a planning agent should choose between.

---

## 10. Likely Reason the Planning Layer “Stopped Waking Up”

This is a planning hypothesis, not a final RCA.

### 10.1 Trigger drift

Planning behavior may exist in rules/docs/skills, but not be strongly invoked by the runtime path handling real user requests.

### 10.2 Execution eagerness overrides planning

The system may be jumping into execution too early, especially when the user asks for implementation directly.

### 10.3 Planning output is not being treated as first-class runtime substrate

If planning output is seen as “nice notes” rather than execution input, the system will not invest enough in producing it.

### 10.4 Question flow is underused

The system may be using chat clarification informally instead of structured question-driven narrowing.

### 10.5 Continuous mode and planning mode are not explicitly chained

If the system does not say:

- first build plan
- then hand plan to autorunner

then execution remains improvisational.

---

## 11. Planning-to-Execution Hand-off Model

This is the crucial bridge.

## 11.1 Planning phase output

Planning phase should conclude with:

- finalized structured todo graph
- explicit stop/approval/decision gates
- validation plan
- selected autonomy mode

## 11.2 Handoff to continuous work mode

Autorunner should receive a plan object equivalent to:

```json
{
  "goal": "...",
  "todos": [],
  "validation": [],
  "stopGates": [],
  "autonomyPolicy": {
    "enabled": true,
    "requireApprovalFor": ["push", "destructive", "architecture_change"]
  }
}
```

The key is that autorunner should not need to rediscover these boundaries from vague natural language.

## 11.3 Continuous work begins after planning confidence threshold

A plan is execution-ready when:

- no unresolved blocking question remains
- next actionable todo exists
- stop gates are explicit
- validation target exists
- approval-sensitive actions are marked

Until then, the planning agent keeps asking questions.

---

## 12. UX Contract

## 12.1 User experience goal

The user should feel that planning mode is helping them think, not slowing them down.

## 12.2 Minimal visible experience

1. user asks for substantial work
2. system enters planning mode
3. system asks a few high-value structured questions
4. system shows draft plan
5. user confirms/adjusts
6. autorunner starts continuous work from that plan

## 12.3 Failure mode to avoid

Do not make planning mode feel like bureaucratic friction.

Bad outcome:
- too many low-value questions
- questions that do not change execution
- planning output that still cannot drive work

---

## 13. Planning Agent Capability Model

## 13.1 Inputs

- user request
- current repo architecture docs
- related event history
- known workflow/subagent taxonomy
- policy constraints

## 13.2 Core functions

- ambiguity detection
- scope extraction
- stop-gate extraction
- dependency shaping
- subagent selection
- validation shaping
- question generation
- plan completion assessment

## 13.3 Outputs

- structured plan
- structured todos
- questions asked + answers resolved
- handoff package to autorunner

---

## 14. Suggested Runtime Integration

## Phase 1 — Planning prompt/spec revival

- restore planning agent as a first-class workflow
- explicitly instruct it to use `question`
- require execution-ready output structure

## Phase 2 — Trigger restoration

- make planning mode default for non-trivial autonomous/dev requests
- ensure execution path cannot silently skip planning when plan quality is insufficient

## Phase 3 — Handoff contract

- convert planning result directly into runtime todo/action metadata
- pass into continuous work mode without manual retranslation

## Phase 4 — Planning quality feedback loop

- observe which plans still cause passive step-by-step behavior
- improve question templates and plan-shaping heuristics

---

## 15. Success Criteria

Planning revival is successful when:

1. the system reliably enters planning mode before non-trivial autonomous work
2. the user is guided by structured questions instead of unstructured ambiguity
3. the final plan is rich enough that autorunner can continue for multiple steps without repeated user nudging
4. approval/decision/blocker pauses become intentional and legible
5. “自動代理” starts to feel materially more autonomous because it begins from a better plan substrate

---

## 16. Recommended Immediate Next Slice

Start with a concrete implementation/behavior spec for the planning interaction itself.

Recommended next file:

- `docs/specs/planning_agent_question_contract.md`

That spec should define:

1. what kinds of questions are allowed
2. when to use MCP `question`
3. how many questions to ask per round
4. what counts as planning-complete
5. how planning output maps to `todowrite` and autorunner handoff
