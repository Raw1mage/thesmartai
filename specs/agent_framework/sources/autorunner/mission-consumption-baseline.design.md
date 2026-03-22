# Design

## Context

- `plan_exit` 目前已完成兩件重要事：
  1. materialize `tasks.md` 成 runtime todos
  2. persist `session.mission` 與完整 artifact paths
- `workflow-runner.ts` 目前只檢查 mission contract 是否存在/approved，並把 mission metadata 帶到 synthetic continuation；它尚未讀取 artifact 內容。
- 因此目前的 runner authority 比較像「permission gate」，還不是「spec consumption runtime」。

## Decisions

1. 只消費三個核心 artifacts：`implementation-spec.md`、`tasks.md`、`handoff.md`
2. consumption failure 一律 fail-fast
3. consumed mission summary 應可回流到 continuation metadata
