# Event: easier_plan_mode

Date: 2026-03-15
Status: Planned
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 需求

- 使用者要求放寬 todolist 更新條件。
- 重新定義：plan mode 不只是 planner 文件階段，也是一種 casual/debug/small-fix mode。
- build mode 才嚴格與 planned task todo list 同步。
- 使用者明確追加：一併修復 `todowrite` 的 mode-aware 與 sync 能力。

## 範圍 (IN / OUT)

### IN

- plan/build mode todo policy rewrite
- mode-aware todo authority semantics
- prompt/system/docs/skill 規範同步
- validation planning

### OUT

- scheduler substrate implementation
- daemon / heartbeat / cron changes
- push / PR

## 任務清單

- [x] 建立 easier_plan_mode 的獨立 spec package 與 event
- [x] 把 plan mode 寬鬆 todo policy 與 build mode 嚴格 sync policy 寫成 execution-ready spec
- [x] 收斂 transition rule、受影響檔案與驗證策略

## Debug Checkpoints

### Baseline

- 現行規範把 todo 強烈綁定 planner artifacts projection，對 build mode 合理，但對 plan mode 過重。
- `system.ts`、`plan.txt`、`agent-workflow` 與 `docs/ARCHITECTURE.md` 都存在偏向「plan mode 也要嚴格對齊 planner todo」的敘述。

### Instrumentation Plan

- 先建立獨立 plan package。
- 再明確定義 mode-aware todo semantics。
- 最後盤點 prompt/system/docs/tests 的修正面。

### Execution

- 已建立 `specs/20260315_easier_plan_mode/*`
- 已建立 `docs/events/event_20260315_easier_plan_mode.md`
- 已根據使用者批准，將本 plan 範圍擴展為：
  - plan mode relaxed todo policy
  - build mode strict planner sync policy
  - `todowrite` mode-aware authority rewrite
  - explicit plan/build sync behavior

### Root Cause

- todo policy 把 plan mode 和 build mode 混成單一嚴格規則，導致 casual/debug 工作流被過度約束。
- 同時，`todowrite` 缺少明確 mode-aware authority 與 plan/build sync contract，導致 sidebar/runtime todo 在兩種模式間容易空白、回退或失配。

### Validation

- 本 plan 已明確定義後續 build validation：
  - plan mode 可自由寫 working-ledger todo
  - build mode 必須維持 planner-derived execution todo
  - `plan_exit` 必須明確定義 runtime todo 的 materialize/adopt/replace 規則
  - runtime `todowrite` 需具備 mode-aware enforcement

## Architecture Sync

- Architecture Sync: Deferred to implementation
- 本輪為 planning task；尚未修改 runtime/doc surfaces。
- 後續 build 必須同步更新 `docs/ARCHITECTURE.md` 中關於 todo 為 planner projection 的單一敘事，改成 mode-aware contract。
