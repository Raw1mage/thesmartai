# Event: openclaw scheduler substrate plan

Date: 2026-03-15
Status: Planning
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 需求

- 使用者確認 OpenClaw 的實作值得獨立成新 plan。
- 新 plan 的 scope 選擇為 **Scheduler substrate**，不做 full 7x24 全面路線圖，也不做直接激進移植。
- 目標是為下一輪 build 建立一個低風險入口：trigger model + lane-aware queue + workflow-runner orchestration refactor。

## 範圍 (IN / OUT)

### IN

- `workflow-runner` 的 generic trigger / queue substrate 規劃
- planner authority 與 runtime trigger authority 的邊界重整
- queue generalization 與 validation strategy
- `specs/20260315_openclaw_scheduler_substrate/*`

### OUT

- full daemon lifecycle implementation
- recurring scheduler persistence
- heartbeat implementation
- isolated job session implementation
- push / PR

## 任務清單

- [ ] 從 benchmark package 分流出獨立 scheduler substrate plan authority
- [ ] 寫成 execution-ready implementation spec / proposal / spec / design / tasks / handoff
- [ ] 向使用者說明目前框架的改動面與 build 入口 slice
- [ ] 收斂 plan handoff 與 stop gates

## Debug Checkpoints

### Baseline

- benchmark package 已收斂出 OpenClaw control-plane 特徵與 opencode gap analysis。
- 目前需要的是把 benchmark 結論轉成 build-facing 計畫，而不是直接在 benchmark package 中混入下一輪實作 authority。

### Instrumentation Plan

- 以 benchmark package 作為研究輸入。
- 將下一輪 build 嚴格限制在 Trigger + Queue substrate。
- 明確區分：本輪先規劃的內容 vs 之後 deferred 的 heartbeat / daemon / isolated jobs。

### Execution

- Pending

### Root Cause

- Pending

### Validation

- Pending

## Architecture Sync

- Pending
