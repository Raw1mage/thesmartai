# Runner Contract Draft

## Purpose

Define the missing runner-level contract that sits between:

- planner artifacts (`specs/<plan-root>/...`)
- deterministic workflow control (`workflow-runner.ts`)
- optional advisory reasoning (`smart-runner-governor.ts`)
- transcript-visible runner narration (`[AI]` layer)

This document is the design draft for the future `runner.txt` / runner-runtime contract.

---

## 1. Problem statement

Current autorunner is already capable of:

- requiring approved mission artifacts
- consuming `implementation-spec.md` / `tasks.md` / `handoff.md`
- continuing from dependency-ready todo state
- stopping for approval / decision / wait gates
- resuming via continuation queue

But it still lacks a formal runner-level identity and authority contract.

As a result:

- runtime logic is stronger than runner identity
- narration exists, but speaking rights are still implicit
- `plan/build` maintenance ownership is not yet explicitly assigned to runner
- Smart Runner is adjunct/advisory, not the session governor contract itself

---

## 2. Target role

Runner is the **session execution governor** for build-mode continuity.

It is **not**:

- the planner agent
- a freeform co-equal second assistant persona
- the source of truth for product decisions
- the source of truth for feature scope

It **is** responsible for:

- maintaining execution continuity after an approved planner handoff
- enforcing stop gates and fail-fast boundaries
- selecting the next deterministic execution move from mission + todo + workflow state
- making orchestration visible in transcript/sidebar without hijacking the conversation

---

## 3. Authority boundaries

### 3.1 Runner MAY

- continue the current actionable todo
- start the next dependency-ready todo
- resume queued autonomous work
- emit short execution narrations
- stop on approval / decision / blocker / risk gates
- surface that planner re-entry is needed

### 3.2 Runner MUST NOT

- invent scope outside approved mission artifacts
- continue from todos alone when mission contract is absent
- silently bypass approval / decision / waiting gates
- mutate planner truth by transcript reminder alone
- become a general-purpose second assistant that debates product direction with the user

### 3.3 Runner MUST defer to planner when

- scope changes materially
- current spec is incomplete or contradicted
- handoff is stale / dirty / non-consumable
- todo graph no longer reflects approved plan intent
- a real replan is needed rather than a local execution decision

---

## 4. Plan / build ownership split

### Plan side

- `plan` owns spec construction, clarification, decision capture, and execution-readiness
- `plan_exit` is the only formal bridge into runner-governed execution

### Build side

- `build` is an execution workflow mode
- runner is the continuity governor inside build mode
- worker agents (`coding` / `testing` / `review` / `docs` / `explore`) execute the actual work

### Contract rule

Runner owns **continuity**, not **planning truth**.

That means:

- planner decides what work is approved
- runner decides how approved work keeps moving

---

## 5. Required inputs (SSOT)

Runner must derive decisions from the following order of truth:

1. `session.mission`
2. mission artifacts (`implementation-spec.md`, `tasks.md`, `handoff.md`)
3. persisted todo state as runtime projection
4. workflow state / queue state / active subtask state
5. approval/question pending state

Runner must **not** treat chat memory alone as sufficient execution authority.

---

## 6. Runner state responsibilities

Runner owns the following execution-state responsibilities:

- choose `continue_current` vs `start_next_todo` vs `pause/stop`
- preserve single actionable `in_progress` flow
- honor `dependsOn`
- honor `waitingOn`
- detect mission-not-approved / mission-not-consumable conditions
- detect wait-subagent mismatches and other runtime anomalies
- keep queue/resume behavior aligned with workflow health

Runner does **not** own:

- spec authoring
- product decisions
- approval issuance
- arbitrary fallback routing

---

## 7. Speaking rights contract

Runner may speak in-session only in bounded forms.

### 7.1 Allowed runner narration

- `continue`
- `pause`
- `complete`
- bounded governance pause adopted by host

### 7.2 Narration goals

Runner narration exists to make execution state observable:

- what step is continuing
- why execution paused
- when the approved todo set is complete

### 7.3 Narration limits

Runner narration must not:

- replace the main assistant's substantive implementation output
- open long speculative discussions
- ask freeform product questions on its own authority
- create a confusing “two assistants arguing” surface

### 7.4 Escalation rule

If runner needs user input, it should escalate through formal question/approval flow, not by ad hoc conversational drift.

---

## 8. Smart Runner relationship

Smart Runner is an **advisory layer** over runner, not the base contract.

Ordering:

1. deterministic runner guardrails decide the safe baseline
2. Smart Runner may propose bounded assist/suggestions
3. host/runtime may adopt only explicitly allowed suggestion paths

Therefore:

- `workflow-runner.ts` remains the primary execution governor substrate
- `smart-runner-governor.ts` remains optional bounded advisory reasoning
- future `runner.txt` should define the base runner identity, not replace it with Smart Runner prompt logic

---

## 9. Minimal runtime contract for future `runner.txt`

The future runner prompt/contract should explicitly define:

1. identity
   - runner is the build-mode execution governor
2. mission boundary
   - runner only acts under approved mission contract
3. todo boundary
   - todo is derived execution surface, not planning source of truth
4. stop gates
   - approval / decision / blocker / risk / mission invalidity
5. narration policy
   - short, transcript-visible, execution-focused
6. planner handoff rule
   - when to stop and require planner re-entry
7. non-fallback rule
   - fail fast instead of silently rescuing execution through hidden defaults

---

## 10. Suggested implementation phases

### Phase 1 — contract asset

- add `packages/opencode/src/session/prompt/runner.txt`
- keep it focused on authority, narration, and handoff boundaries
- status: implemented
- current binding slice:
  - `workflow-runner.ts` now prepends the base runner contract text to autonomous build-mode continuation instructions
  - deterministic stop gates and Smart Runner adoption logic remain unchanged

### Phase 2 — mode binding

- explicitly bind runner to build-mode runtime behavior
- make build-mode continuation reference runner contract instead of only fixed continuation text
- status: partially implemented in phase-1 form (continuation text now references runner contract asset, but deeper planner-boundary/runtime-ownership wiring is still pending)

### Phase 3 — planner boundary hardening

- define explicit conditions that mark execution as `spec_dirty` / `replan_required`
- stop runner and route back to planner when those conditions occur
- status: implemented (first slice)
- current behavior:
  - `plan_exit` now persists artifact integrity for `implementation-spec.md`, `tasks.md`, and `handoff.md`
  - mission consumption raises `spec_dirty` when approved artifacts drift after approval
  - Smart Runner host-adopted replans now escalate to `replan_required` instead of silently continuing execution

### Phase 4 — observability alignment

- align sidebar `[R]` card, transcript `[AI]` narration, and workflow state names with the same runner contract vocabulary

---

## 11. Acceptance criteria

This runner contract is considered successfully implemented when:

1. runner has an explicit prompt/contract asset
2. build-mode continuity clearly belongs to runner
3. planner/build ownership split is visible in runtime and docs
4. transcript narration is bounded and intentional
5. autorunner no longer feels like round-based “should I continue?” orchestration when no true blocker exists
6. runner stops cleanly for planner re-entry instead of improvising around scope drift
