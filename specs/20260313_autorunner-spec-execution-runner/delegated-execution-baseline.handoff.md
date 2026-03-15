# Handoff

## Execution Contract

- 此 change 是 autonomous-agent 計畫的第三個正式 slice：從 mission consumption baseline 前進到 delegated execution baseline。
- executor 應先建立 bounded role derivation contract，再考慮真正的 task-tool delegation。
- 不得把完整 orchestration、worker registry、queue ownership 一次混進本 slice。

## Required Reads

- `docs/events/event_20260313_autorunner_autonomous_agent_completion.md`
- `docs/ARCHITECTURE.md`
- `specs/20260315_openspec-like-planner/implementation-spec.md`
- `specs/20260315_openspec-like-planner/handoff.md`
- `specs/20260315_openspec-like-planner/proposal.md`
- `specs/20260315_openspec-like-planner/spec.md`
- `specs/20260315_openspec-like-planner/design.md`
- `specs/20260315_openspec-like-planner/tasks.md`

## Stop Gates In Force

- 若 role derivation 需要引入新的 implicit fallback，必須先停下來請求批准。
- 若 scope 演變為真正 task-tool delegation engine，必須先開新一輪 spec slice。
- 若 delegation role 無法從 mission + todo 安全推導，不得假裝已有多代理 authority。

## Execution-Ready Checklist

- [x] Goal 清楚：讓 mission 影響 execution role
- [x] Scope 清楚：本輪只做 bounded delegated execution baseline
- [x] Stop gates 已明確
- [x] implementation boundary 已映射到實際 runtime files
- [x] targeted validation 已列出

## Completion Note

- delegated execution baseline 已完成（bounded scope）：
  - synthetic continuation metadata 已帶 delegation contract（含 role trace）
  - role set 維持 bounded：`coding` / `testing` / `docs` / `review` / `generic`
  - ambiguous/low-evidence 情況維持 `generic`，不宣稱完整多代理 orchestration
- mission consumption fail-fast contract 仍生效：mission 不可消費時走 `mission_not_consumable` + `workflow.mission_not_consumable` evidence path。
