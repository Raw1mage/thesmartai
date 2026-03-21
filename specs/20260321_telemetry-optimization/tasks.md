# Tasks

## 1. Freeze card layout contract

- [ ] 1.1 Confirm the target three-card grouping for legacy context information (`Summary / Breakdown / Prompt`)
- [ ] 1.2 Re-read the approved implementation spec, scope, and stop gates
- [ ] 1.3 Confirm the ordering persistence boundary for context cards

## 2. Rebuild context sidebar as cards

- [ ] 2.1 Refactor `SessionContextTab` legacy content into `Summary / Breakdown / Prompt` card sections
- [ ] 2.2 Keep telemetry cards visually aligned with the new legacy context cards
- [ ] 2.3 Add draggable ordering for context sidebar cards

## 3. Validate optimized sidebar behavior

- [ ] 3.1 Run targeted context sidebar render/order validation
- [ ] 3.2 Run `bun --filter @opencode-ai/app typecheck`
- [ ] 3.3 Record validation evidence for context card grouping and ordering

## 4. Documentation / retrospective sync

- [ ] 4.1 Update the event log with decisions, checkpoints, and validation
- [ ] 4.2 Sync `specs/architecture.md` or record verified-no-change evidence
- [ ] 4.3 Compare implementation results against the proposal's effective requirement description
- [ ] 4.4 Produce a validation checklist covering requirement satisfaction, gaps, deferred items, and evidence

<!--
Unchecked checklist items are the planner handoff seed for runtime todo materialization.
Checked items may remain for human readability, but they are not used as new todo seeds.
Runtime todo is the visible execution ledger and must not be replaced by a private parallel checklist.
-->
