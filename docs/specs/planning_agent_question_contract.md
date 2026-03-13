# Planning Agent Question Contract

Date: 2026-03-13
Status: Draft
Branch: autorunner
Workspace: /home/pkcs12/projects/opencode-runner

## 1. Objective

Define the behavioral contract for how the planning agent should use structured questioning to turn an underspecified user request into an execution-ready plan.

This spec exists to prevent two opposite failures:

1. **under-questioning**
   - execution starts too early from a vague request
2. **over-questioning**
   - planning becomes bureaucratic and slows the user down

The contract should make planning feel guided, efficient, and execution-oriented.

---

## 2. Core Principle

The planning agent should ask the minimum number of questions required to produce a safe, structured, autonomous-ready plan.

Questions are not for curiosity.
Questions are for removing execution ambiguity.

---

## 3. What Counts as a Planning Question

A planning question is any question whose answer materially changes one or more of the following:

- scope
- implementation order
- stop/approval gates
- validation criteria
- delegation strategy
- risk posture
- architecture boundary
- success definition

If the answer would not change execution behavior, the planning agent should not ask it.

---

## 4. Allowed Question Categories

## 4.1 Scope questions

Use when the task boundary is unclear.

Examples:
- which module is in scope?
- should this round include docs/tests/refactor or code only?
- is the goal planning-only or implementation-ready?

## 4.2 Priority questions

Use when there are multiple valid execution orders.

Examples:
- should we optimize for user-visible behavior first or infrastructure first?
- should we stabilize planning mode before daemon substrate work?

## 4.3 Approval-policy questions

Use when automation level or approval boundaries are unclear.

Examples:
- can architecture-sensitive changes proceed autonomously?
- should daemon-related refactors stop for review before code changes?

## 4.4 Validation questions

Use when success criteria are underspecified.

Examples:
- what will count as a successful first milestone?
- should the first phase be judged by UX feel, runtime logs, or test coverage?

## 4.5 Delegation questions

Use when subagent strategy materially affects execution.

Examples:
- should planning and execution be split into separate agents?
- should docs/testing be mandatory in the first slice?

## 4.6 Risk-posture questions

Use when multiple safe strategies exist with different tradeoffs.

Examples:
- prefer rapid prototype or more conservative architecture-first path?
- allow temporary compatibility layer, or require fail-fast only?

---

## 5. Disallowed / Low-Value Questions

The planning agent should avoid questions that are:

- obvious from repo policy/docs
- purely stylistic
- already answered by the user
- too implementation-local for the current planning stage
- not decision-shaping

Examples to avoid:

- asking for preferences already specified in AGENTS/docs
- asking broad “anything else?” repeatedly without narrowing
- asking low-level code questions before scope/goal is stable

---

## 6. When to Use MCP `question`

MCP `question` should be the default tool when:

1. there are 2–5 clear decision options
2. a choice would directly shape the plan
3. explicit user confirmation is useful for later execution gating
4. the answer can be represented as structured planning state

Examples:

- pick first milestone focus
- select approval posture
- choose planning-only vs planning+implementation
- choose whether to optimize for UX feel vs system durability first

---

## 7. When NOT to Use MCP `question`

Use normal conversational clarification instead when:

- the user needs to explain domain context in prose
- the space of answers is too open-ended for fixed options
- the agent is summarizing and validating its current understanding
- the missing detail is best gathered through a short freeform dump first

Pattern:

- first freeform gather if necessary
- then use `question` to close key decision points

---

## 8. Question Budget Per Round

The planning agent must preserve momentum.

## 8.1 Default budget

Per planning round:

- **1 to 3 questions** is the default

## 8.2 Upper bound

- **maximum 5 questions** in one round
- only if all are tightly related and unblock the same planning milestone

## 8.3 Preferred pattern

Best pattern:

1. ask 1–3 high-impact questions
2. incorporate answers
3. show updated plan shape
4. ask next small set only if still needed

This prevents interrogation fatigue.

---

## 9. Question Ordering Strategy

Questions should be ordered by execution impact.

Recommended order:

1. goal / first milestone intent
2. scope boundary
3. approval / risk posture
4. validation target
5. delegation / workflow selection

Do not ask detailed delegation questions before confirming the milestone goal.

---

## 10. Planning Completion Criteria

Planning is complete when all of the following are true:

1. **goal clarity**
   - there is a one-sentence execution goal
2. **scope clarity**
   - IN / OUT is explicit enough to prevent drift
3. **next action exists**
   - there is at least one dependency-ready actionable todo
4. **stop gates exist**
   - approval/decision/blocker conditions are explicit
5. **validation exists**
   - success can be checked
6. **delegation is shaped**
   - major slices know whether they are main-agent or subagent work

If any of these is missing and would materially affect execution, planning is not complete.

---

## 11. Early-Stop Rule

The planning agent should stop asking questions early if:

- the user has already provided enough structure
- remaining unknowns do not affect the next execution slice
- the plan can proceed safely with explicit assumptions

When doing this, it must record assumptions instead of silently ignoring the gaps.

---

## 12. Output After Each Question Round

After each planning round, the agent should reflect the updated state back in compact form.

Minimum expected output:

- current goal
- resolved decisions from this round
- remaining open questions (if any)
- draft next-step plan

This helps the user feel progress rather than interrogation.

---

## 13. Mapping Answers into Structured Plan Fields

Each question answer should update a known planning field.

Examples:

### milestone focus answer
Updates:
- `goal`
- top-priority todo(s)

### approval posture answer
Updates:
- `autonomyPolicy.requireApprovalFor`
- todo `needsApproval`
- stop gates

### validation preference answer
Updates:
- `validation`
- todo sequence

### delegation choice answer
Updates:
- todo `canDelegate`
- subagent/workflow plan

This mapping is required; otherwise the question had no execution value.

---

## 14. Mapping to `todowrite`

The final planning output should be convertible into `todowrite` entries.

Minimum mapping:

- plan step → `todo.content`
- importance → `priority`
- execution class → `action.kind`
- approval requirement → `action.needsApproval`
- delegation suitability → `action.canDelegate`
- current blocker → `action.waitingOn`
- ordering constraints → `action.dependsOn`

The planning agent should think in terms of this output shape from the start.

---

## 15. Mapping to Autorunner Handoff

Planning output should hand off at least:

```json
{
  "goal": "...",
  "todos": [],
  "validation": [],
  "stopGates": [],
  "autonomyPolicy": {
    "enabled": true
  }
}
```

Autorunner should use this as the starting substrate for continuous work mode.

That is what reduces the need for repeated user turns.

---

## 16. UX Rules

### 16.1 Good planning interaction should feel like:

- the system is helping me think clearly
- the questions are relevant
- each answer visibly sharpens the plan
- I can see when planning is almost complete

### 16.2 Bad planning interaction feels like:

- repetitive questioning
- generic PM-style bureaucracy
- no visible plan improvement after answering
- asking things that should already be known from repo policy

---

## 17. Suggested Implementation Sequence

### Phase 1
- update planning prompts/system instructions to explicitly use this contract

### Phase 2
- route non-trivial autonomous/dev requests into planning mode by default

### Phase 3
- ensure planning round outputs are stored as structured plan state

### Phase 4
- feed plan state directly into `todowrite` + autorunner handoff

---

## 18. Success Criteria

This contract is successful when:

1. planning mode asks fewer but more meaningful questions
2. users can feel the plan becoming sharper after each round
3. the final plan consistently contains enough structure for multi-step autonomous execution
4. autorunner feels less passive because it begins from a clarified plan

---

## 19. Recommended Immediate Next Slice

Implement a small planning-mode behavior upgrade around one concrete workflow:

- non-trivial autonomous/dev request
- trigger planning mode
- ask 1–3 MCP `question` prompts
- produce structured draft plan
- confirm planning-complete
- hand off to continuous work mode

This is the smallest product-visible slice of planning revival.
