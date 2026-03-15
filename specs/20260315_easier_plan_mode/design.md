# Design: easier_plan_mode

## Context

- 現有系統把 todo 強烈定義為 planner artifacts 的 runtime projection，這對 build mode 很合理，但對 plan mode 太重。
- 使用者明確要求：plan mode 也應是一種 casual mode，可以自由測試/debug/小修改，而不需要嚴格 plan 才能更新 todo。

## Design Approach

- 將 todo policy 改成 **mode-aware**。
- 保留現有 build-mode 嚴格性。
- 放寬 plan-mode 使用權限，但不讓這種寬鬆行為滲透到 build/autonomous execution。
- 將 `todowrite` 視為 runtime authority surface，而不只是 prompt instruction surface。

## Proposed Policy

### Plan mode

- todo = working ledger
- 可用於：
  - casual exploration
  - debug checkpoints
  - small fixes
  - temporary tracking
- 不要求必須先有 `tasks.md` / planner handoff 才能寫 todo

### Build mode

- todo = execution ledger
- 必須對齊：
  - planner artifacts
  - `tasks.md`
  - handoff metadata
  - approved mission

### Transition rule

- `plan_enter`: 進入 relaxed todo policy
- `plan_exit`: 切換到 strict execution todo policy

### todowrite mode-aware rule

- plan mode: `todowrite` = working-ledger write
- build mode: `todowrite` = execution-ledger write
- 需要明確 runtime state 來區分兩者，不能再只靠「todo 是 planner projection」的單一敘事

## Risks

- 若文字規範改了但 runtime 沒有 mode-aware distinction，仍可能發生 sidebar 漂移。
- 若放寬過度，build mode 可能被 plan-mode 的 casual todo 污染。
- 若 sync 策略不清，`plan_exit` 之後可能再次發生 runtime todo 空白、回退、或 planner tasks 失配。

## Expected File Changes (future build)

- `system.ts`
- `todo.ts`
- `tool/plan.ts`
- `plan.txt`
- `claude.txt`
- `anthropic-20250930.txt`
- `agent-workflow` skill
- `docs/ARCHITECTURE.md`
- related tests
