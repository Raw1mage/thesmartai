# Handoff

> **ARCHIVED (2026-03-17)** — Predecessor spec superseded by `specs/20260315_openclaw_reproduction/`. This spec is reference-only; do not resume execution from here.

## Execution Contract

- 此 change 是 `autorunner` branch 的 autonomous-agent 大計畫第一個 substrate 切片。
- 先完成 journal + mismatch anomaly evidence path，再往 reducer / lease / worker supervisor / daemon split 推進。
- 不得跳過本 change 直接做大規模 daemon mesh 重寫。

## Required Reads

- `docs/events/event_20260313_autorunner_autonomous_agent_completion.md`
- `docs/events/event_20260313_autorunner_system_stability_plan.md`
- `docs/specs/autorunner_daemon_architecture.md`
- `docs/specs/planning_agent_revival.md`
- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`
- `mission-consumption-baseline.proposal.md`
- `mission-consumption-baseline.spec.md`
- `mission-consumption-baseline.design.md`
- `mission-consumption-baseline.tasks.md`
- `delegated-execution-baseline.proposal.md`
- `delegated-execution-baseline.spec.md`
- `delegated-execution-baseline.design.md`
- `delegated-execution-baseline.tasks.md`

## Stop Gates In Force

- 若發現需要直接改動 daemon topology、session lifecycle SSOT 或 cms branch，同步前必須先停下來做新一輪規格確認。
- 若切片實作需要新增任何 fallback behavior，必須停下來請求使用者批准。
- 若測試顯示 `wait_subagent` mismatch 無法以最小 event/anomaly 切片表達，需先回到 spec/design 修正，不得直接憑直覺擴張範圍。

## Execution-Ready Checklist

- [x] Goal 清楚：先完成 autonomous-agent 的最小 runtime substrate evidence path
- [x] Scope 清楚：本輪先做 journal baseline + `unreconciled_wait_subagent` anomaly
- [x] Tasks 已切成可驗證 phase
- [x] Validation targets 已列出
- [x] Stop gates 已明確
- [x] 已完成 runner authority baseline 與 mission-driven continuation baseline
- [x] 已完成 runtime event service baseline
- [x] 已完成 stale `wait_subagent` mismatch anomaly integration
- [ ] 下一步：定義並規格化 mission consumption baseline
