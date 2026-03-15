# Planner Hardening Roadmap (runtime-enforced, not prompt-dependent)

## Premise

The planner cannot be considered hardened if successful behavior still depends primarily on the LLM remembering to follow prompt instructions.

Therefore this roadmap explicitly excludes “write a better planner prompt” as the main strategy.

The goal is to move planner correctness from **LLM self-discipline** into **runtime-enforced contracts**.

---

## 1. What is soft today

These behaviors still depend too much on the model doing the right thing:

- creating/updating plan artifacts before implementation
- keeping spec/design/tasks in sync with user idea changes
- avoiding direct implementation when planning artifacts are missing
- not overwriting old todo truth with a fresh plan skeleton
- preserving branch history / superseded ideas / adopted decisions

This means the planner is still partly a prompt-shaped behavior rather than a hard system.

---

## 2. Hardening principle

Do not ask the model to be smarter.

Instead:

1. restrict allowed actions by phase
2. reject invalid transitions
3. require durable artifacts before execution
4. bind todo state to artifact lineage
5. make replans explicit state mutations, not full-list replacement

---

## 3. Hardening layers

### Layer A — Artifact completeness gate

#### Problem

Execution can begin even when planning artifacts are missing or incomplete.

#### Hardening

Before execution-capable tools are allowed, runtime checks must verify that the active change unit contains:

- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`
- `handoff.md`

And each file must satisfy minimal section rules.

#### Enforcement effect

- If incomplete → remain in planning state
- If complete → allow execution transition

This removes the possibility of “just start coding and backfill planning later”.

---

### Layer B — Planner/execution state machine

#### Problem

Today the system has planning hints, but no hard phase machine that controls what can happen next.

#### Hardening

Introduce explicit runtime states such as:

- `analysis`
- `artifact_build`
- `artifact_incomplete`
- `awaiting_decision`
- `execution_ready`
- `executing`
- `replanning`
- `blocked`
- `completed`

Each state has an allowlist/denylist for tools and transitions.

#### Enforcement effect

Examples:

- In `artifact_incomplete`, coding/build/edit execution tools are denied.
- In `awaiting_decision`, execution is denied until user decision is recorded.
- In `executing`, new scope changes force transition to `replanning`.

---

### Layer C — Tool gating by phase

#### Problem

Even if plan mode exists, nothing fully prevents direct implementation behaviors from bypassing it.

#### Hardening

Execution-capable tools (coding/edit/build/commit-like continuation) must require `execution_ready`.

Planning-capable tools remain available during planning states:

- `question`
- planner artifact writers
- todo graph materialization
- plan review / handoff tools

#### Enforcement effect

The agent cannot “choose to skip planning” because the system does not expose execution actions until planning passes gate checks.

---

### Layer D — Todo lineage model

#### Problem

Todo currently behaves too much like a freeform array.

#### Hardening

Todo items must gain durable linkage fields such as:

- `sourceArtifact` (e.g. tasks section identity)
- `branchId`
- `supersedes`
- `supersededBy`
- `decisionGate`
- `approvalGate`
- `changeSlug`

#### Enforcement effect

Todo is no longer a loose note list. It becomes runtime materialization of planner tasks.

Replanning becomes mutation of a graph, not wholesale overwrite.

---

### Layer E — Replan mutation semantics

#### Problem

Replanning currently tends to appear as “write a new todo list”.

#### Hardening

Add explicit operations such as:

- `plan.branch`
- `plan.adopt`
- `plan.supersede`
- `plan.cancel`
- `plan.complete`
- `plan.materialize_tasks`

Even if legacy `todowrite` remains, the underlying persistence should route through these semantics.

#### Enforcement effect

- completed work cannot silently disappear
- replaced work is marked superseded/cancelled, not lost
- branch history remains visible

---

### Layer F — Spec-first change detection

#### Problem

When user intent changes mid-session, the model can jump directly into code edits.

#### Hardening

On recognized scope/decision changes, runtime sets a “spec dirty” flag.

While `spec dirty = true`:

- execution tools are denied
- planner must update artifacts first
- only after artifact sync does execution resume

#### Enforcement effect

The user’s new idea cannot remain only in chat memory.

---

### Layer G — Handoff as hard contract

#### Problem

Execution handoff still risks being conversational rather than durable.

#### Hardening

`handoff.md` becomes the only execution-ready transition surface.

Runtime must verify:

- active change slug exists
- tasks materialization succeeded
- stop gates are explicit
- unresolved blockers are encoded

#### Enforcement effect

Executor agents do not need to reconstruct intent from chat logs.

---

## 4. What this does NOT attempt to harden

These remain LLM-dependent and should be treated accordingly:

- idea generation quality
- trade-off creativity
- writing quality of artifacts
- semantic judgment of ambiguous user intent

Hardening cannot make the model smarter. It can only reduce the damage when the model behaves loosely.

---

## 5. Incremental implementation order

### Phase 1 — Minimal execution gate

- add active change slug selection
- add artifact completeness validator
- deny execution if required artifacts missing

### Phase 2 — Todo lineage + safe replans

- attach todo items to change slug / source artifact
- replace raw overwrite semantics with replan-aware mutations
- preserve completed/superseded/cancelled visibility

### Phase 3 — Phase machine

- introduce planner/execution runtime states
- gate tools by phase
- force re-entry into replanning when scope changes

### Phase 4 — Handoff hardening

- require `handoff.md` for execution-ready transition
- require tasks materialization success
- make executor/autorunner consume artifact state, not chat memory

---

## 6. Success criteria

Planner hardening is successful when:

1. the agent cannot begin execution without valid artifacts
2. user idea changes force artifact updates before more implementation
3. todo progress survives replans without silent loss
4. executor continuation depends on artifact/handoff state, not informal chat continuity
5. planner correctness improves even if the model is only moderately compliant
