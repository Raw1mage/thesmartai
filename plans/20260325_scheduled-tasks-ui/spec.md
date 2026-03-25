# Spec

## Purpose

- 讓使用者透過 Web UI 管理 AI 排程任務，取代純對話/CLI 操作模式，形成自主能力的視覺化控制面板

## Requirements

### Requirement: Cron REST API

The system SHALL expose CronStore CRUD operations as HTTP REST endpoints under `/api/v2/cron`.

#### Scenario: List all jobs

- **GIVEN** daemon 中有 2 個 cron jobs（1 enabled, 1 disabled）
- **WHEN** GET `/api/v2/cron/jobs`
- **THEN** 回傳 JSON array 包含 2 個 job 物件，各含 id, name, enabled, schedule, payload, state

#### Scenario: Create a job

- **GIVEN** 使用者提交 { name, schedule, payload } 至 POST `/api/v2/cron/jobs`
- **WHEN** payload.kind = "agentTurn" 且 schedule.kind = "every" everyMs = 300000
- **THEN** 系統建立 job 並回傳含 id 的完整 job 物件，job 預設 enabled=true

#### Scenario: Toggle job enabled

- **GIVEN** 一個 enabled=true 的 job
- **WHEN** PATCH `/api/v2/cron/jobs/:id` with { enabled: false }
- **THEN** job.enabled 變為 false，heartbeat 下次不再觸發此 job

#### Scenario: Delete a job

- **GIVEN** 一個存在的 job
- **WHEN** DELETE `/api/v2/cron/jobs/:id`
- **THEN** job 從 store 移除，對應 run-log 保留（不自動清除）

#### Scenario: Get run history

- **GIVEN** 一個已執行過 5 次的 job
- **WHEN** GET `/api/v2/cron/jobs/:id/runs?limit=10`
- **THEN** 回傳最近 5 筆 CronRunLogEntry（含 status, summary, durationMs, timestamp）

#### Scenario: Manual trigger

- **GIVEN** 一個 enabled 的 job
- **WHEN** POST `/api/v2/cron/jobs/:id/run`
- **THEN** 立即觸發一次執行（不影響 schedule 的 nextRunAtMs）

### Requirement: Scheduled Tasks Page

The system SHALL provide a Scheduled Tasks page accessible from the sidebar navigation.

#### Scenario: Empty state

- **GIVEN** 沒有任何 cron job
- **WHEN** 使用者進入 Scheduled Tasks 頁面
- **THEN** 顯示空狀態提示和「建立任務」按鈕

#### Scenario: Task card display

- **GIVEN** 存在 3 個 cron jobs
- **WHEN** 使用者進入 Scheduled Tasks 頁面
- **THEN** 顯示 3 張卡片，每張包含：任務名稱、prompt 摘要、schedule 描述、enabled toggle、status 指示燈、最近執行時間

#### Scenario: Create task via dialog

- **GIVEN** 使用者點擊「建立任務」
- **WHEN** 填入名稱、prompt、選擇 schedule 類型並設定參數，點擊確認
- **THEN** 新 job 建立並出現在卡片列表中

#### Scenario: Edit task

- **GIVEN** 使用者點擊某卡片的編輯按鈕
- **WHEN** 修改 prompt 內容並儲存
- **THEN** job 更新並反映在卡片上

### Requirement: Sidebar Navigation Entry

The system SHALL add a Scheduled Tasks entry in the sidebar navigation.

#### Scenario: Navigation to Scheduled Tasks

- **GIVEN** 使用者在任何頁面
- **WHEN** 點擊 sidebar 的 Scheduled Tasks 圖示/連結
- **THEN** 導航至 Scheduled Tasks 頁面

## Acceptance Checks

- REST API 6 個端點全部可用（list, create, update, delete, runs, trigger）
- Scheduled Tasks 頁面可正常載入並顯示 job 卡片
- Create/Edit dialog 可成功建立和修改 job
- Toggle 啟停即時生效
- Delete 成功移除 job
- Sidebar 入口可正常導航
- Build 無新增 type errors
