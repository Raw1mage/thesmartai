# Tasks

## 1. Trigger Model

- [ ] 1.1 Define `RunTrigger` types and map current mission continuation into the new trigger taxonomy
- [ ] 1.2 Identify where trigger resolution should live relative to planner authority and workflow-runner entrypoints

## 2. Lane-Aware Queue

- [ ] 2.1 Define `RunLane` semantics for per-session serialization and global concurrency limits
- [ ] 2.2 Design how the current pending continuation queue should generalize into a generic run queue

## 3. Workflow Runner Refactor Plan

- [ ] 3.1 Refactor `workflow-runner` responsibilities into planner authority, trigger resolution, queue scheduling, and run execution boundaries
- [ ] 3.2 Preserve approval / decision / blocker / wait-subagent gates in the new orchestration model

## 4. Validation And Docs

- [ ] 4.1 Define unit / integration / regression validation for trigger + queue substrate changes
- [ ] 4.2 Sync event and identify required `docs/ARCHITECTURE.md` updates before build mode
