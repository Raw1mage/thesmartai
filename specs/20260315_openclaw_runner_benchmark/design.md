# Design: openclaw runner benchmark

## Context

- opencode 的 autorunner 已有 mission contract、continuation queue、supervisor、Smart Runner assist、todo-driven continuation。
- 但這些能力是否足以支撐長時間 7x24 execution，仍缺少與成熟外部 agent runtime 的系統級 benchmark。

## Design Approach

- 用 external benchmark 的方式研究 OpenClaw，不預設它的每個設計都適合移植。
- 比對時以控制面為主：state machine、scheduler、persistence、recovery、safety gates、observability。
- 輸出應直接服務下一輪 runner 設計，而不是變成 detached architecture essay。

## Comparison Axes

1. Session / task authority boundary
2. Long-running control loop and re-entry
3. Durable queue / persistence model
4. Recovery / lease / crash handling
5. Stop gates / approval / human interrupt model
6. Delegation / worker topology
7. Observability / anomaly evidence / runtime journals

## Risks

- OpenClaw 若缺少足夠公開細節，容易把 benchmark 變成推測。
- opencode 現有 runner 是 session-scoped、mission-gated；若 OpenClaw 是不同產品假設，直接移植可能會錯位。
- 若不建立 portable/non-portable 分類，容易落入「看起來很強就想整包照搬」的錯誤。

## Benchmark Conclusions

### Already present in opencode

- approved mission gate
- todo-driven continuation
- pending continuation queue
- supervisor / lease / retry / anomaly evidence
- explicit approval / decision / blocker stop gates

### Portable next

- generic trigger model instead of mission-only continuation triggers
- lane-aware queue with per-session serialization + global concurrency caps
- isolated autonomous job session type
- heartbeat / wakeup primitives for non-chat background work

### Substrate-heavy

- host-wide scheduler daemon
- durable recurring scheduler store with retention / retry policy
- restart-drain lifecycle for all active runs
- host-wide scheduler observability / health endpoints

### Incompatible / do not copy directly

- channel-specific product assumptions (WhatsApp/Telegram/Discord-centric execution model)
- product-specific auth/account routing behavior that conflicts with current local policy
- any silent fallback or implicit authority recovery semantics

## Framework Changes Needed In Opencode

1. `workflow-runner` 需從「plan continuation coordinator」升級為「generic run orchestrator」。
2. `session` 模型需新增 non-chat autonomous run identity，而不再只靠目前的 planner/mission transcript。
3. `queue` 模型需從 pending continuation 升級到 lane-aware run queue。
4. `scheduler` 必須成為獨立層，而不是把 heartbeat / delayed followup 硬塞回 prompt contract。
5. `observability` 需新增 host-wide queue/scheduler/stuck-run 視角，而不是只有 session-local workflow health。
