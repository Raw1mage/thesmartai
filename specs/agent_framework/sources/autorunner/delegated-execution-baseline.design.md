# Design

## Context

- `mission-consumption` 已能回傳 compact execution input：goal、validation、execution checklist、required reads、stop gates。
- `workflow-runner` 目前仍使用固定 continuation text，代表 mission 雖已被讀，但尚未影響下一步是 coding/testing/docs/review 哪一種 execution posture。

## Decisions

1. 先做 role derivation，再做真正 task delegation
2. role derivation 來源以 actionable todo 為主、mission checklist 為輔
3. 模糊情況不硬推 delegation
4. delegation metadata 納入 synthetic continuation contract
