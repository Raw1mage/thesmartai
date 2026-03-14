# Handoff

## Execution Contract

- 此 change 是 autonomous-agent 計畫的第二個正式 slice：從「approved mission authority」前進到「approved mission consumption baseline」。
- executor 必須先證明 runtime 會讀 mission artifacts，再考慮 delegated execution。
- 不得跳過本 change 直接把 delegated execution、queue ownership 或 daemon orchestration 混進來。

## Required Reads

- `docs/events/event_20260313_autorunner_autonomous_agent_completion.md`
- `docs/ARCHITECTURE.md`
- `specs/changes/autorunner-autonomous-agent-substrate/implementation-spec.md`
- `specs/changes/autorunner-autonomous-agent-substrate/tasks.md`
- `specs/changes/autorunner-autonomous-agent-substrate/handoff.md`
- `specs/changes/autorunner-mission-consumption-baseline/proposal.md`
- `specs/changes/autorunner-mission-consumption-baseline/spec.md`
- `specs/changes/autorunner-mission-consumption-baseline/design.md`
- `specs/changes/autorunner-mission-consumption-baseline/tasks.md`

## Stop Gates In Force

- 若要把 mission consumption 直接擴張成多角色 delegation engine，必須先停下來做新一輪 spec 確認。
- 若實作需要新增任何 implicit fallback（例如 mission 讀不到就改用 todos 續跑），必須停下來請求批准。
- 若 mission artifact 真實內容顯示目前 OpenSpec section contract 不足以被 runtime 消費，需先回到 spec/design 補 contract，不得靠 prompt 文字臨時猜測。

## Execution-Ready Checklist

- [x] Goal 清楚：讓 runner 真正讀取 approved mission content
- [x] Scope 清楚：本輪只做 mission consumption baseline
- [x] Stop gates 已明確
- [ ] implementation boundary 已映射到實際 runtime files
- [ ] targeted validation 已列出
