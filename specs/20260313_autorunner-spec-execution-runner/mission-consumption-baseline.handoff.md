# Handoff

## Execution Contract

- 此 change 是 autonomous-agent 計畫的第二個正式 slice：從「approved mission authority」前進到「approved mission consumption baseline」。
- executor 必須先證明 runtime 會讀 mission artifacts，再考慮 delegated execution。
- 不得跳過本 change 直接把 delegated execution、queue ownership 或 daemon orchestration 混進來。

## Required Reads

- `docs/events/event_20260313_autorunner_autonomous_agent_completion.md`
- `docs/ARCHITECTURE.md`
- `specs/20260315_openspec-like-planner/implementation-spec.md`
- `specs/20260315_openspec-like-planner/tasks.md`
- `specs/20260315_openspec-like-planner/handoff.md`
- `specs/20260315_openspec-like-planner/proposal.md`
- `specs/20260315_openspec-like-planner/spec.md`
- `specs/20260315_openspec-like-planner/design.md`
- `specs/20260315_openspec-like-planner/tasks.md`

## Stop Gates In Force

- 若要把 mission consumption 直接擴張成多角色 delegation engine，必須先停下來做新一輪 spec 確認。
- 若實作需要新增任何 implicit fallback（例如 mission 讀不到就改用 todos 續跑），必須停下來請求批准。
- 若 mission artifact 真實內容顯示目前 OpenSpec section contract 不足以被 runtime 消費，需先回到 spec/design 補 contract，不得靠 prompt 文字臨時猜測。

## Execution-Ready Checklist

- [x] Goal 清楚：讓 runner 真正讀取 approved mission content
- [x] Scope 清楚：本輪只做 mission consumption baseline
- [x] Stop gates 已明確
- [x] implementation boundary 已映射到實際 runtime files
- [x] targeted validation 已列出
- [x] runtime 會把 consumed mission trace 帶入 continuation metadata
- [x] artifact 缺漏時會以 `mission_not_consumable` fail-fast 停止

## Completion Note

- 此 slice 已完成最小 mission consumption baseline：
  - 新增 `packages/opencode/src/session/mission-consumption.ts`
  - `workflow-runner` 會在 continuation 前驗證 approved mission artifacts 可消費
  - 成功時保留 `missionConsumption` trace；失敗時記錄 `workflow.mission_not_consumable`
- 下一步正式切片應為 delegated execution baseline，而不是再重複擴張 mission consumption。
- delegated execution baseline 已於後續 slice 完成：
  - continuation synthetic metadata 現已同時保留 mission + delegation trace
  - delegated role 維持 bounded：`coding` / `testing` / `docs` / `review` / `generic`
  - `mission_not_consumable` stop/anomaly 路徑仍是 delegated execution 的前置保護，不可繞過
