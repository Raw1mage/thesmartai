# Tasks

## 1. Planner package completion

- [x] 1.1 Read the active session discussion and prior `20260315-web-monitor-restart-control` artifacts
- [x] 1.2 Fill `proposal.md`, `spec.md`, `design.md`, `implementation-spec.md`, and `handoff.md` with session-derived content
- [x] 1.3 Replace generic template backlog with the actual remaining execution backlog

## 2. Task / todo lineage hardening

- [x] 2.1 Define the exact mapping from planner tasks to runtime todo state
- [x] 2.2 Decide which planner task statuses are authoritative versus runtime-only
- [x] 2.3 Update handoff/build execution rules so new work cannot start from discussion alone

## 3. Runner phase alignment with planner/runtime

- [x] 3.1 Inspect remaining gaps after first-slice `/plan` + `@planner` convergence
- [x] 3.2 Align deeper planner entry/runtime behavior with canonical `plan_enter` / `plan_exit`
- [x] 3.3 Verify build-mode continues to respect planner ownership boundaries

## 4. Runner phases from `runner-contract.md`

- [x] 4.1 Phase 1 — contract asset (`runner.txt`)
- [x] 4.2 Phase 2 — mode binding (first slice)
- [x] 4.3 Phase 3 — planner boundary hardening (first slice: `spec_dirty` / `replan_required`)
- [x] 4.4 Phase 4 — observability alignment (`[R]` card / narration / workflow vocabulary)

## 5. Operational closure

- [x] 5.1 Verify `/etc/opencode/webctl.sh` is installed on host
- [x] 5.2 Verify `/etc/opencode/opencode.cfg` contains `OPENCODE_WEBCTL_PATH="/etc/opencode/webctl.sh"`
- [ ] 5.3 Verify end-to-end `Restart Web` flow against the host-installed script _(manual operator handling accepted; no further automated test in this session)_

## 6. Validation

- [x] 6.1 Run targeted planner/build/runner regression tests for any new runtime changes
- [x] 6.2 Run `bun run typecheck` in `packages/opencode`
- [x] 6.3 Run `bun --filter @opencode-ai/app typecheck`
- [x] 6.4 Update event / architecture sync records before declaring completion
