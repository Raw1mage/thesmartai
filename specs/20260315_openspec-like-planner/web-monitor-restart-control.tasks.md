# Tasks: Web monitor + controlled restart control

## Execution groups

### Group 1 — sidebar simplification

- [x] Collapse legacy sidebar status fragments into a single work-monitor-centric structure
- [x] Remove Smart Runner history / narration / result / debug / plugins / LSP cards
- [x] Add global persistence for sidebar card order and expand/collapse state

### Group 2 — runner card

- [x] Present Runner as `[R]`
- [x] Keep Runner visible even when idle
- [x] Aggregate current step / tools / delegated subagents / MCP traces into Runner card

### Group 3 — todo UX and integrity

- [x] Hide low-value `implement` label from todo presentation
- [x] Render meaningful todo metadata inline using `·`
- [x] Fix overlapping replan writes so completed/cancelled/in-progress states are preserved

### Group 4 — controlled restart

- [x] Add `Restart Web` button to Web settings
- [x] Add authenticated restart control route
- [x] Add frontend wait-for-health then reload flow
- [x] Add runtime config contract for `OPENCODE_WEBCTL_PATH`

### Group 5 — planner retrofit / follow-up

- [x] Record this work into a planner artifact set under `specs/20260315_openspec-like-planner/`
- [x] Add explicit `plan/build` target model artifact to reconcile legacy mode semantics with the new planner direction
- [x] Update `docs/ARCHITECTURE.md` to reflect controlled restart contract and planner-first lesson
- [ ] Install `/etc/opencode/webctl.sh` on host and ensure `/etc/opencode/opencode.cfg` carries `OPENCODE_WEBCTL_PATH`
- [ ] Verify end-to-end `Restart Web` flow against host-installed runtime script
- [~] Refactor legacy `plan/build` implementation toward the target model
- [x] Confirm current autorunner compatibility against the plan/build contract and record the remaining gap (`runner.txt` / runner-level contract)
- [x] Draft runner-level contract artifact for future `runner.txt` / session governor formalization
- [x] Converge builtin `/plan` and `@planner` onto the same first-slice canonical planner entry path
- [x] Refactor planner package layout from `specs/<slug-like-root>/` to `specs/<date>_<plan-title>/`
- [x] Add planner package root reuse so title churn does not fragment the same workstream
- [x] Hard-code explicit tasks.md -> runtime todo lineage contract and expose `todoMaterializationPolicy`
- [x] Add phase-1 `runner.txt` runtime binding for autonomous build continuation

## Validation

- [x] `bun --filter @opencode-ai/app typecheck`
- [x] `bun test "/home/pkcs12/projects/opencode/packages/app/src/pages/session/helpers.test.ts" "/home/pkcs12/projects/opencode/packages/app/src/pages/session/monitor-helper.test.ts"`
- [x] `bun test "/home/pkcs12/projects/opencode/packages/opencode/src/session/todo.test.ts"`
- [x] `bun run typecheck` (cwd=`packages/opencode`)
