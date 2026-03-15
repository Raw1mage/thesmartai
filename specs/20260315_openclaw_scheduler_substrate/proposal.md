# Proposal: openclaw scheduler substrate

## Why

- OpenClaw benchmark 已證明，7x24 agent 的關鍵在 control-plane substrate，而不是更激進的 prompt。
- opencode 目前最值得優先補強的是 trigger model 與 queue substrate，這是往 scheduler-ready runner 前進的最低風險入口。

## Effective Requirement Description

1. 讓 runner 不再只接受 approved mission continuation。
2. 將 pending continuation queue 升級成 generic run queue。
3. 保留現有 planner / approval / decision / blocker contract，不破壞既有開發 workflow。

## Scope

### IN

- trigger model extraction
- lane-aware queue design
- workflow-runner orchestration refactor planning
- validation and architecture sync planning

### OUT

- recurring scheduler store
- heartbeat implementation
- isolated job session implementation
- daemon restart/drain implementation

## Constraints

- 不能新增 silent fallback
- 不能削弱 approved mission / stop gates
- 不能讓 planner authority 與 runtime trigger authority 混成同一件事

## Decision Summary

- 先做 scheduler substrate，不直接做 full 7x24 runtime。
- benchmark package 保留研究 authority；本 package 作為 build-facing planning authority。
