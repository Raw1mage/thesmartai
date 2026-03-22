# Implementation Spec

## Goal

在 `autorunner` branch 上，完成 mission consumption baseline 的第一個可驗證切片：

1. 讓 runner 在 autonomous continuation 前真正讀取 approved mission 的核心 artifacts
2. 把讀出的 mission content 收斂成最小 execution input
3. 若 mission artifacts 不可消費，則 fail-fast 停止，而不是退回純 todo-driven autonomy

## Scope

### IN

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/tool/plan.ts`
- 可能新增 `packages/opencode/src/session/mission-consumption.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- `packages/opencode/test/session/planner-reactivation.test.ts`

### OUT

- delegated execution engine
- queue ownership / daemon topology refactor
- complete mission parser framework
- cms sync
- 新增任何 silent fallback behavior

## Assumptions

- 現有 `session.mission` contract 與 artifactPaths 已足以定位 approved mission files。
- `plan_exit` 已能保證第一輪 companion artifacts completeness gate。
- 第一個 consumption slice 只需處理 `implementation-spec.md` / `tasks.md` / `handoff.md`。

## Stop Gates

- 若 mission artifacts 的現有 section contract 不足以支撐 deterministic consumption，必須先回到 spec 補 contract。
- 若實作需要將 proposal/spec/design 也升格為第一輪必讀執行輸入，需先確認是否會擴張 slice 範圍。
- 若需改動 cms branch 或新增 fallback，必須先停下。

## Critical Files

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/tool/plan.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- `packages/opencode/test/session/planner-reactivation.test.ts`

## Structured Execution Phases

### Phase 1 — Define compact mission execution input

- 從 mission artifacts 萃取 runtime 真正需要的最小欄位

### Phase 2 — Add mission-consumption read/validate helper

- 讓 runtime 能顯式成功/失敗地消費 approved mission

### Phase 3 — Wire continuation to consumed mission

- 成功時附帶 mission-consumption trace
- 失敗時 fail-fast 停下

### Phase 4 — Regression protection

- 驗證 helper、workflow stop、trace surface

## Validation

- `bun test <mission consumption helper test file>`
- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/test/session/planner-reactivation.test.ts"`

## Handoff

- 後續 executor 應把本 spec 視為第二個正式 substrate slice。
- 先完成 mission consumption baseline，再進 delegated execution baseline。
