# Implementation Spec

## Goal

在 `autorunner` branch 上，完成 delegated execution baseline 的第一個可驗證切片（已完成）：

1. 讓 runner 能從 approved mission + actionable todo 推導 bounded execution role
2. 讓 synthetic continuation metadata 帶出 delegation trace
3. 對模糊情況保持 bounded generic continue，而不是偽裝成已授權的多代理委派

## Scope

### IN

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/mission-consumption.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`
- delegated role helper（已落地）

### OUT

- 完整 task-tool delegation engine
- external worker registry
- queue ownership refactor
- cms sync
- 新增任何 silent fallback behavior

## Assumptions

- mission consumption baseline 已完成且可提供 compact execution input。
- 第一輪 delegated execution 只需要 role-shaped continuation，不需完整 orchestration。

## Stop Gates

- 若 role derivation 無法以 mission + actionable todo 的現有 evidence 安全完成，需保持 bounded generic continue。
- 若要引入真正 multi-agent orchestration，需先開新 slice。
- 若需新增 fallback 或同步 cms，必須先停下。

## Critical Files

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/mission-consumption.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`

## Structured Execution Phases

### Phase 1 — Define bounded role set

- 已定義第一輪 bounded roles：`coding` / `testing` / `docs` / `review` / `generic`

### Phase 2 — Add role derivation helper

- 已讓 runtime 從 mission + actionable todo 推導 role，並保留 derivation evidence

### Phase 3 — Wire delegated continuation metadata

- 已在 synthetic continuation metadata 帶入 delegation trace（含 role）
- 模糊時保留 bounded `generic` continue
- metadata contract 與 mission metadata 並存（synthetic continuation contract）

### Phase 4 — Regression protection

- 已驗證 role derivation、trace、ambiguous protection
- `mission_not_consumable` fail-fast/anomaly path 在 delegated baseline 下持續生效

## Validation

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- delegated execution targeted tests（role derivation / continuation metadata / ambiguous fallback）

## Handoff

- bounded delegated execution baseline 已完成；後續 executor 僅在需要時再開新 slice 擴張為完整 task-tool delegation engine。
