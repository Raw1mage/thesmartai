# Tasks

## 1. Policy Definition

- [x] 1.1 Define plan mode as both planner-first mode and casual/debug mode
- [x] 1.2 Define build mode as strict planner-derived execution mode

## 2. Runtime Todo Authority

- [x] 2.1 Define `todowrite` as mode-aware between plan mode and build mode
- [x] 2.2 Define expected sync behavior for runtime todo at plan/build boundaries

## 3. Transition Contract

- [x] 3.1 Define how `plan_enter` enables relaxed todo usage
- [x] 3.2 Define how `plan_exit` switches todo authority to execution ledger semantics

## 4. Surface Audit

- [x] 4.1 Identify system/prompt/skill/docs text that over-constrains todo usage in plan mode
- [x] 4.2 Identify tests that must preserve strict build-mode todo alignment

## 5. Validation Plan

- [x] 5.1 Define validation for relaxed plan-mode todo behavior
- [x] 5.2 Define validation for strict build-mode planner sync behavior
