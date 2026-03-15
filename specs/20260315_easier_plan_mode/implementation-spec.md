# Implementation Spec

## Goal

- 重新定義 plan mode 與 build mode 的 todo policy，並一併修復 `todowrite` 的 mode-aware 與 sync 能力：plan mode 同時作為 planner-first / casual / debug / small-fix mode，可自由更新 todo；build mode 才嚴格將 runtime todo 視為 planned task ledger，與 `tasks.md` / handoff / approved mission 同步。

## Scope

### IN

- plan mode / build mode 語義重定義
- `todowrite` 在 plan mode 的放寬規則
- `todowrite` 的 mode-aware authority 與 sync behavior
- `plan_enter` / `plan_exit` 的 todo authority transition
- prompt / system / docs / skill 中與該 policy 直接衝突的規範
- 對應 validation strategy

### OUT

- 本輪不直接修改 scheduler substrate
- 本輪不直接修改 daemon / heartbeat / cron 設計
- 本輪不新增 fallback mechanism

## Assumptions

- plan mode 允許 casual exploration，不必先有完整 planner artifacts 才能使用 todo。
- build mode 仍維持 planner-derived execution ledger 的嚴格性。
- `plan_exit` 應作為 todo authority 從 casual ledger 切到 execution ledger 的正式切換點。
- `todowrite` 需要知道當前 session 是處於 relaxed planning ledger 還是 strict execution ledger，不能再只靠單一投影規則。

## Stop Gates

- 若新 policy 會削弱 build mode 的 planned-task authority，必須停下重寫 spec。
- 若新 policy 需要讓 runtime 在 build mode 接受 freeform todo 漂移，必須停下並拒絕。
- 若實作需要修改 autonomous continuation 的 mission approval gate，必須先回 planner。
- 若 `todowrite` 的 sync 修正仍無法明確區分 casual ledger 與 execution ledger，必須先補 runtime state model，再進 build。

## Critical Files

- `/home/pkcs12/projects/opencode/packages/opencode/src/session/system.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/todo.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/plan.txt`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/claude.txt`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/anthropic-20250930.txt`
- `/home/pkcs12/projects/opencode/packages/opencode/src/tool/plan.ts`
- `/home/pkcs12/projects/opencode/templates/skills/agent-workflow/SKILL.md`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_easier_plan_mode.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260315_easier_plan_mode/handoff.md`

## Structured Execution Phases

- Phase 1 — Policy definition: define relaxed plan-mode todo semantics vs strict build-mode execution semantics.
- Phase 2 — Runtime todo authority model: define how `todowrite` knows whether the session is in casual ledger mode or execution ledger mode.
- Phase 3 — Transition contract: define how `plan_enter` / `plan_exit` switch todo authority and how planner materialization/adoption should behave.
- Phase 4 — Surface audit: identify prompt/system/docs/skill/runtime text that currently over-constrains plan mode or underspecifies sync behavior.
- Phase 5 — Validation planning: specify tests and doc sync needed before implementation.

## Proposed Runtime Contract

### Plan mode

- `todowrite` may act as a working-ledger writer.
- todo updates may originate from casual debug, exploration, temporary breakdowns, or small-fix execution.
- runtime must not require existing `tasks.md` authority before accepting these updates.

### Build mode

- `todowrite` must act as an execution-ledger updater.
- todo names and status transitions must stay aligned with planner-derived tasks / approved handoff.
- freeform todo reshaping is not allowed unless it is part of an explicit replan / planner re-entry.

### Sync behavior

- `plan_enter` enters relaxed ledger mode.
- `plan_exit` switches the session into strict execution ledger mode and re-materializes/adopts todo from planner artifacts.
- when runtime is already in build mode, `todowrite` should reject or normalize writes that would drift away from planner authority.

## Validation

- plan mode must explicitly allow freeform/casual todo updates.
- build mode must continue to require planner-derived execution todo alignment.
- transition from plan mode to build mode must define how runtime todo is re-materialized or adopted.
- validation must include `todowrite` mode-awareness and sync semantics, not only prompt wording.

## Handoff

- Build should not start until this package clearly separates casual ledger semantics from execution ledger semantics.
- Build implementation must preserve strict build-mode alignment even while relaxing plan-mode behavior.
- Build implementation must include both policy surfaces and runtime `todowrite` sync behavior together; do not ship prompt-only wording changes without runtime mode-aware enforcement.
