# Plan / Build Target Model

## 1. Why this document exists

Legacy `plan` / `build` exists today, but its semantics are still biased toward:

- `plan` = read-only planner sandbox
- `build` = writable default agent

That is no longer the desired model.

The desired model is:

- `plan` / `build` remain as the familiar top-level modes
- but they represent **discussion / execution emphasis**, not a naive read-only vs read-write split

---

## 2. Target semantics

### 2.1 Plan mode

Plan mode is a **planner-first discussion mode**.

Its primary purpose is to:

- build or update specs
- clarify user intent
- capture decisions / constraints / trade-offs
- mutate the active plan
- generate or update todos as a derived execution list

Plan mode does **not** mean “absolutely no system changes ever”.

It may still allow:

- small validation reads/checks
- narrow evidence-gathering steps
- tightly bounded low-risk edits when necessary for planning evidence

But its default responsibility is **spec construction and refinement**.

### 2.2 Build mode

Build mode is an **execution-first workflow mode**.

Its primary purpose is to:

- execute the plan-derived todo list
- coordinate coding / review / testing / docs subagents
- validate progress and update runtime state
- keep sidebar/work monitor aligned with actual execution

Build mode does **not** mean “planning is forbidden”.

It may still:

- revise plan details
- mark specs dirty
- return to planning emphasis when scope changes

But its default responsibility is **plan execution**.

---

## 3. Agent / mode relationship

### 3.1 Planner is an agent

`plan` is a real agent.

Responsibilities:

- classify discussion intent
- extract conclusions from user discussion
- update active spec artifacts
- materialize / revise todo state from specs
- decide whether execution is ready

### 3.2 Build is not a single agent

`build` is best treated as a **mode**, not a singular personality.

Within build mode, work is performed by a workflow of agents such as:

- coding
- review
- testing
- docs
- explore

Therefore:

- `plan` = planning agent
- `build` = execution mode with multiple worker agents

---

## 4. Specs / Todo / Sidebar relationship

### 4.1 Specs are the source of truth

The active plan lives under `specs/<plan-root>/`.

Artifacts:

- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`
- `handoff.md`

### 4.2 Todo is derived, not primary

Todo should be treated as a **runtime projection of specs**, especially `tasks.md` and handoff state.

That means:

- `todowrite` should not be the primary authoring surface for real feature work
- coding/build agents should consume the plan-derived todo list
- sidebar should reflect execution status of the derived todo graph

### 4.3 Sidebar is the observability surface

Sidebar/work monitor is not the planning source of truth.

Its job is to visualize:

- current runner state
- active todo progress
- active tools/subagents/MCP traces
- blocked/waiting/executing states

---

## 5. Scope rule for when planner is required

The system should distinguish between:

### Requires planner/spec updates

Any change involving **functional logic / CRUD behavior / behavior contract**:

- new features
- behavior changes
- API/data-flow/state changes
- bug fixes that alter system logic
- CRUD logic changes

These should be recorded in planner/spec artifacts before or during execution.

### May bypass planner for immediate handling

Small non-functional changes may be handled directly:

- typo fixes
- isolated copy changes
- tiny style/layout adjustments
- obvious one-line repair with no behavior impact

This rule may initially live in visible prompt/policy, but should later evolve into stronger runtime gating heuristics.

---

## 6. Legacy-to-target mapping

| Legacy concept | Current behavior                     | Target behavior                          |
| -------------- | ------------------------------------ | ---------------------------------------- |
| `plan` agent   | read-only planner                    | planner-first discussion agent           |
| `build` agent  | default writable main agent          | execution-first workflow mode            |
| `/plan`        | switch to planner                    | keep as primary plan-mode entry          |
| `@planner`     | parallel planner-ish routing surface | converge with `/plan` semantics          |
| `executor`     | handoff/documentation term           | equivalent to build-mode execution layer |
| plan prompt    | read-only reminder                   | planning emphasis reminder only          |
| todo list      | freeform runtime task list           | plan-derived execution list              |

---

## 7. Migration direction

### Step 1 — semantic cleanup

- keep `plan` / `build` names
- redefine their meaning in docs/runtime comments/tests
- remove old assumption that `plan == no edits ever`

### Step 2 — control surface convergence

- align `/plan` and `@planner`
- treat them as the same planning control surface

#### Step 2A — first implementation slice (completed)

- add builtin `/plan` command as the canonical planner entry path
- normalize `@planner` to canonical agent name `plan`
- make planner mentions avoid planner-ish subtask routing and instead request the canonical `plan_enter` path
- keep `plan_exit` / mission / runner handoff semantics unchanged in this slice

### Step 3 — todo derivation hardening

- make todo clearly derived from active spec artifacts
- ensure build agents execute against todo graph, not chat memory

### Step 4 — build workflow alignment

- align `agent-workflow` with build-mode realities and autorunner continuation
- ensure coding/review/testing/docs agents all consume the same task contract

### Step 5 — autorunner integration

- ensure autorunner can maintain plan/build state across the whole session
- ensure autorunner uses the active plan as the durable execution substrate

---

## 8. Success criteria

This target model is successful when:

1. users can continue saying “enter plan mode” / “back to build mode” without new vocabulary
2. `plan` no longer means simplistic read-only lockdown
3. `build` clearly means execution workflow mode rather than one agent persona
4. todos visibly come from specs and drive execution
5. sidebar reflects plan-derived execution truth
6. autorunner can maintain the entire session against this plan/build contract
