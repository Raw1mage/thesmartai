# Design

## Context

- `plan_exit` 目前已完成兩件重要事：
  1. materialize `tasks.md` 成 runtime todos
  2. persist `session.mission` 與完整 artifact paths
- `workflow-runner.ts` 目前只檢查 mission contract 是否存在/approved，並把 mission metadata 帶到 synthetic continuation；它尚未讀取 artifact 內容。
- 因此目前的 runner authority 比較像「permission gate」，還不是「spec consumption runtime」。

## Goals / Non-Goals

**Goals:**

- 建立最小 mission artifact consumption path。
- 讓 runtime 在 continuation 前能顯式讀取 approved mission 的核心 artifacts。
- 將 mission read failure 收斂成 fail-fast stop/evidence，而不是 todo fallback。
- 保持本 slice 小到不直接跳進 delegated execution orchestration。

**Non-Goals:**

- 本輪不實作完整 delegated execution engine。
- 本輪不重寫 todo materialization。
- 本輪不建立完整 mission parser DSL。
- 本輪不直接同步 cms。

## Decisions

1. **先做 read/validate，再做 delegation**
   - 先證明 runner 真的會讀 mission，再討論如何依不同 role 委派。
2. **只消費三個核心 artifacts**
   - `implementation-spec.md`
   - `tasks.md`
   - `handoff.md`
   - proposal/spec/design 暫時保留為 trace/supporting context，不作第一輪必要執行輸入。
3. **mission consumption helper 應集中化**
   - 建議新增單一 helper/module，避免 workflow-runner 直接散讀檔案。
4. **consumption failure 一律 fail-fast**
   - 不新增「mission 讀不到就改靠 todos 跑」的 fallback。
5. **consumed mission summary 應可回流到 continuation metadata**
   - 讓後續 delegated execution/debug 可以知道 runner 實際依據的是哪份 mission content。

## Risks / Trade-offs

- 若 consumption schema 設計過大，會提前把 delegated execution 一起做掉。
- 若只做檔案存在檢查而不保留 artifact role boundaries，後續仍會退化成自由文字 handoff。
- 若直接讓 workflow-runner 讀檔，會讓 autonomous decision path 變得難測且難維護。

## Critical Files

- `packages/opencode/src/tool/plan.ts`
- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- `packages/opencode/test/session/planner-reactivation.test.ts`
- `specs/20260315_openspec-like-planner/*`

## Proposed First Slice Shape

### New runtime helper

- 建議新增 mission-consumption helper：
  - read mission artifact files from `session.mission.artifactPaths`
  - validate minimum non-empty required sections
  - return a compact execution input object

### Compact execution input shape

- `goalScopeValidation`
  - from `implementation-spec.md`
- `executionChecklist`
  - from `tasks.md`
- `executorContract`
  - from `handoff.md`
- `consumedArtifacts`
  - absolute/relative path evidence for the three consumed artifacts

### Integration point

- `workflow-runner.ts`
  - 在 continuation decision/assembly 前取得 consumed mission input
  - success：把 compact mission-consumption evidence 帶入 synthetic continuation metadata
  - failure：顯式 stop，留下 mission consumption failure reason/anomaly

## Validation Strategy

- 單元測試：mission helper 的 read/validate 行為
- regression test：workflow-runner 在 artifact 缺失時 fail-fast
- regression test：successful continuation 帶有 mission-consumption trace
