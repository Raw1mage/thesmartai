# Tasks

## 1. Canonical planner package

- [x] 1.1 Re-converge fragmented planner roots into one canonical plan package
- [x] 1.2 Keep `proposal/spec/design/implementation-spec/tasks/handoff` as the primary contract
- [x] 1.3 Preserve deeper analyses as supporting docs inside the same root

## 2. Planner-first execution lineage

- [x] 2.1 Define the exact mapping from planner tasks to runtime todo state
- [x] 2.2 Decide which planner task statuses are authoritative versus runtime-only
- [x] 2.3 Update handoff/build execution rules so new work cannot start from discussion alone

## 3. Plan/build semantics

- [x] 3.1 Converge first-slice `/plan` + `@planner` entry behavior
- [x] 3.2 Define `plan/build` target semantics as discussion-first vs execution-first
- [x] 3.3 Land the intended runtime/model alignment for this workstream and preserve further changes as future re-activation material

## 4. Runner execution contract

- [x] 4.1 Add Phase 1 — contract asset (`runner.txt`)
- [x] 4.2 Add Phase 2 — mode binding (first slice)
- [x] 4.3 Add Phase 3 — planner boundary hardening (`spec_dirty` / `replan_required`)
- [x] 4.4 Add Phase 4 — observability alignment (`[R]` card / narration / workflow vocabulary)

## 5. Controlled restart and operational closure

- [x] 5.1 Add controlled `Restart Web` flow and runtime config contract
- [x] 5.2 Verify `/etc/opencode/webctl.sh` is installed on host
- [x] 5.3 Verify `/etc/opencode/opencode.cfg` contains `OPENCODE_WEBCTL_PATH="/etc/opencode/webctl.sh"`
- [x] 5.4 Record end-to-end `Restart Web` closure status for this session _(manual operator handling accepted; no further automated test in this session)_

## 6. Historical value / future reuse

- [x] 6.1 Preserve this plan as historical documentation for planner-first / runner / restart architecture decisions
- [x] 6.2 Use this plan as source material for `docs/ARCHITECTURE.md` sync
- [x] 6.3 Keep this plan available for future architecture refactors or plan re-activation when needed

## 7. Validation and documentation

- [x] 7.1 Run targeted planner/build/runner regression tests for runtime/path changes
- [x] 7.2 Run `bun run typecheck` in `packages/opencode`
- [x] 7.3 Run `bun --filter @opencode-ai/app typecheck` for affected app slices
- [x] 7.4 Update event / architecture sync records before declaring completion
