# Spec

## Purpose

- 定義 `dialog_trigger_framework` 第一版的行為需求，讓對話觸發邏輯從隱性 prompt 習慣收斂為可驗證的系統合約。

## Requirements

### Requirement: Rule-First Trigger Detection

The system SHALL use deterministic programmatic detectors for first-version dialog trigger decisions before considering any future semantic expansion.

#### Scenario: Detect planning trigger without background AI governor

- **GIVEN** 使用者提出多步驟、architecture-sensitive、或需要 plan/replan 的需求
- **WHEN** 系統評估下一輪對話控制面
- **THEN** 系統以 rule-based detectors 決定是否進入或維持 planning flow，而不是另外啟動背景 AI classifier

### Requirement: Next-Round Surface Rebuild

The system SHALL apply tool/capability visibility changes through a dirty-flag plus next-round rebuild contract.

#### Scenario: Tool surface changes after policy or MCP state update

- **GIVEN** MCP tool list、planner mode、或 trigger policy 造成可用工具集合變動
- **WHEN** 目前 round 結束並進入下一輪 processing
- **THEN** 系統在下一輪重新 resolve tools，而不是在同一輪執行中做 in-flight hot swap

### Requirement: Explicit Planner Root Naming

The system SHALL derive a planner root name that matches the actual task topic and SHALL fail fast on invalid naming inputs.

#### Scenario: Enter plan mode for dialog_trigger_framework

- **GIVEN** 使用者要求為 `dialog_trigger_framework` 開 plan
- **WHEN** `plan_enter` 建立 active `/plans/` root
- **THEN** 產生的 root slug 必須反映 `dialog_trigger_framework` 主題，而不是殘留錯誤或無關的名稱

### Requirement: Replan Trigger Applies Only To Material Direction Change During Active Execution

The system SHALL route to replan only when a user message indicates material scope/direction change while an active execution context already exists.

#### Scenario: Replan request during active execution context

- **GIVEN** session 已有 active mission / execution-ready context，且使用者明確表示需求變更、方向改變、或要求重新規劃
- **WHEN** 系統評估 `replan` trigger
- **THEN** 系統將該訊息視為 `replan` 候選，並把後續 routing 收斂到 plan agent，而不是把它當成一般 status reply

#### Scenario: General discussion without active execution context

- **GIVEN** session 尚未進入 active execution context，或使用者只是一般討論/詢問狀態
- **WHEN** 系統評估 `replan` trigger
- **THEN** 不得僅因出現模糊字詞就誤判成 `replan`

### Requirement: Approval Trigger In V1 Is Limited To Centralized Detection And Routing

The system SHALL centralize approval detection in v1, but SHALL NOT claim full runtime stop-state orchestration beyond existing workflow behavior.

#### Scenario: Approval reply while session is waiting on approval

- **GIVEN** workflow stop reason 已是 `approval_needed`
- **WHEN** 使用者送出明確 approval reply
- **THEN** 系統辨識為 approval trigger，並保持 deterministic routing，而不是誤導回 plan mode

### Requirement: No Silent Fallback On Trigger Contracts

The system SHALL stop for approval, product decision, or architecture review when a trigger outcome would cross a protected boundary.

#### Scenario: Trigger would require architecture-sensitive behavior change

- **GIVEN** 某個 trigger 需要改變 planner lifecycle、beta workflow、或 runtime mutation contract
- **WHEN** 系統發現這已超出第一版既定 scope
- **THEN** 系統停止自動續跑並要求重新規劃或取得明確決策

## Acceptance Checks

- 規格明確要求第一版不使用背景 AI governor。
- 規格明確要求 surface 變更走 dirty flag + next-round rebuild。
- 規格明確要求 `plan_enter` 命名與任務主題對齊。
- 規格明確要求 protected boundary 一律 fail fast，不靠 silent fallback。
- 規格明確要求 `replan` 僅在 active execution context + material direction change 下成立。
- 規格明確要求 `approval` 在 v1 只先做到 centralized detection/routing，不誇大成完整 runtime orchestration。
