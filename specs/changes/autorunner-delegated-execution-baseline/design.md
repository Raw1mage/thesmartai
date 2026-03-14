# Design

## Context

- `mission-consumption` 已能回傳 compact execution input：goal、validation、execution checklist、required reads、stop gates。
- `workflow-runner` 目前仍使用固定 continuation text：
  - `AUTONOMOUS_CONTINUE_TEXT`
  - `AUTONOMOUS_PROGRESS_TEXT`
- 這代表 mission 雖已被讀，但尚未影響下一步是 coding/testing/docs/review 哪一種 execution posture。

> Status update: delegated execution baseline 已落地；本文件保留為已實作設計摘要。

## Goals / Non-Goals

**Goals:**

- 在不引入完整多代理 orchestration 的前提下，先讓 runtime 具備 role-shaped continuation。
- 讓 mission-derived role evidence 可觀測、可測試。
- 保持邏輯集中，不把 role 推導散落在 prompt 文案中。

**Non-Goals:**

- 本輪不實作完整 task-tool delegation scheduler。
- 本輪不建立外部 worker registry。
- 本輪不直接決定 provider/model/account routing。

## Decisions

1. **先做 role derivation，再做真正 task delegation**
   - 第一輪只建立「由誰來做」的 contract，不建立完整委派執行器。
2. **role derivation 來源以 actionable todo 為主、mission checklist 為輔**
   - 讓推導依據集中且容易測試。
3. **模糊情況不硬推 delegation**
   - 無證據時只能停在 bounded generic continue，而不是亂指派角色。
4. **delegation metadata 納入 synthetic continuation contract**
   - continuation 需保留 delegation trace，且與 mission metadata 並存。

## Risks / Trade-offs

- 若 role heuristics 過度自由，會偷偷引入 fallback-like behavior。
- 若完全不允許 generic continue，會把第一輪 delegated execution 做得太重。
- 若 metadata 不保留 derivation source，後續 debug 會退化成 prompt 猜測。

## Critical Files

- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/session/mission-consumption.ts`
- `packages/opencode/src/session/workflow-runner.test.ts`

## Proposed First Slice Shape

- 已新增 role-derivation helper
- continuation metadata 已擴充 delegation trace（含 role/source/todo evidence）
- 成功推導時，continuation text 會帶 bounded role hint
- 無法安全推導時，保持 `generic` continue，metadata 保留 bounded generic result
- mission artifacts 不可消費時，不進入 delegation；走 `mission_not_consumable` fail-fast + `workflow.mission_not_consumable` anomaly evidence

## Validation Strategy

- 已覆蓋：role derivation helper
- 已覆蓋：workflow continuation metadata（含 synthetic continuation delegation metadata contract）
- 已覆蓋：ambiguous todo 不會升格成 unsupported role
