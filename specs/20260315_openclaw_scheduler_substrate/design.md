# Design: openclaw scheduler substrate

## Context

- 現有 `workflow-runner` 已經能處理 planner-led continuation，但它把 mission continuation 與 runtime run authority 綁太緊。
- OpenClaw benchmark 顯示：7x24 agent 的關鍵是 trigger-driven control plane，而不是單一對話 loop。

## Design Approach

- 先不做完整 scheduler 產品面，而是先重構 runtime substrate。
- 核心是拆出兩個新抽象：
  1. `RunTrigger`
  2. `RunLane`
- `workflow-runner` 改成 generic orchestrator；planner/mission 保留，但不再是唯一入口。

## Proposed Runtime Changes

### 1. RunTrigger

- 建議欄位：
  - `type`
  - `sourceId`
  - `sessionId | sessionKey`
  - `priority`
  - `requestedAt`
  - `reason`
  - `payloadRef`
- 初始類型：
  - `mission_continue`
  - `user_message`
  - `manual_resume`
- 預留未來類型：
  - `heartbeat`
  - `scheduled_job`
  - `external_hook`

### 2. RunLane

- 初始 lanes：
  - `session:<key>`
  - `main`
  - `subagent`
- session lane 保證單線；global lane 作為總併發 cap。

### 3. Generic run queue

- 現有 pending continuation queue 改成可容納任意 trigger-driven run request。
- queue 的任務不是解釋 planner，而是排程 run。

### 4. Responsibility split

- planner / mission：定義**應該做什麼**
- trigger：定義**為什麼現在要起 run**
- lane queue：定義**現在能不能跑**
- workflow-runner：定義**跑了之後如何決定 continue / stop**

## Risks

- 若 trigger / queue 抽象化做得太急，可能打破既有 mission continuation flow。
- 若 planner authority 與 trigger authority 邊界不清，sidebar/todo 與 runtime queue 會再次漂移。
- 若 lane 模型不足夠簡單，容易提前掉進 full scheduler complexity。

## Deferred For Later Plans

- isolated autonomous job sessions
- recurring wakeup persistence
- heartbeat implementation
- daemon lifecycle / restart-drain / host-wide observability
