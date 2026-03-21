# Tasks

## 1. Lifecycle Contract Definition

- [x] 1.1 Finalize `/plans` vs `/specs` lifecycle semantics and stop gates
- [x] 1.2 Confirm the authoritative rule that build execution stays on the same `/plans` root after `plan_exit`
- [x] 1.3 Confirm manual promotion gate: move to `/specs` only after execution, commit, merge, and explicit user instruction
- [x] 1.4 Define legacy dated-package triage by implementation status
- [x] 1.5 Define formalized destination naming as semantic per-feature spec roots

## 2. Runtime Path Refactor

- [x] 2.1 Rewrite planner root/path construction to use dated roots under `/plans/`
- [x] 2.2 Update `plan.ts` template lookup, artifact resolution, mission artifact storage, and handoff wording for `/plans`
- [x] 2.3 Review dependent runtime/test/API surfaces for artifact path assumptions
- [x] 2.4 Implement explicit legacy compatibility or migration behavior without silent fallback

## 3. Prompt / Skill / Contract Rewrite

- [x] 3.1 Rewrite system prompts and constitution wording that assumes dated plan roots under `/specs/` are the active planner root
- [x] 3.2 Rewrite planner / agent-workflow / related skills to align with `/plans` as the active planner root
- [x] 3.3 Rewrite repo/template AGENTS contracts to reflect the new lifecycle and manual promotion rule

## 4. Validation / Documentation Sync

- [x] 4.1 Run targeted validation for runtime path behavior and prompt/template references
- [x] 4.2 Sync `specs/architecture.md` and event docs with the new lifecycle model
- [x] 4.3 Produce a validation checklist covering requirement satisfaction, legacy-triage outcomes, gaps, and evidence
- [x] 4.4 Verify formalized spec naming rules and deferred slugging heuristics
