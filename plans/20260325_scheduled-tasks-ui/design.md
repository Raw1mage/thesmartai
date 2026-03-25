# Design — Scheduled Tasks as System-Level Project

## Context

- Cron 後端已完整（store, heartbeat, delivery, run-log, session, active-hours, retry）
- REST API 已完整（7 個端點已實作並通過 type-check）
- 前端已有初版 task-list 頁面（三區卡片 + 編輯浮窗 + 執行歷史面板）
- **架構升級需求**：Scheduled Tasks 應作為系統級 Project，複用 Project → Session List → Session Detail layout

## Goals / Non-Goals

**Goals:**
- Scheduled Tasks 作為置頂虛擬 Project
- Task list 複用 session list sidebar pattern
- Task detail 複用 session detail layout，替換 chat 為 prompt/cron/log
- 執行紀錄 log 顯示完整 AI 回覆（非截斷 summary）
- 工具 panel 含 test/edit/config
- 後端 trigger → session 執行管線接通

**Non-Goals:**
- 重構 cron 後端核心
- DAG 排程依賴
- LINE 通知（Phase 2）

## Decisions

### DD-1: 虛擬 Project 實現方式
**決策**：在 sidebar-shell.tsx 新增一個硬編碼的「Scheduled Tasks」project tile，置於所有真實 project 之上。不建立真正的 Project.Info 記錄。
**理由**：
- 不需要 directory 對應（cron data 是 per-user 全域）
- 不需要 git VCS
- 只需要 UI 層的 project 入口感
**路由**：`/system/tasks` → 不走 `/:dir` pattern，避免 base64 decode 衝突

### DD-2: Task List = Session List Pattern
**決策**：在 sidebar 左欄（與 session list 同位置），以 session item 的視覺風格渲染 cron jobs 列表。
**理由**：使用者明確要求 "session list 的設計方式"
**實作**：
- 選中某 project tile 時，sidebar session list 區域切換為 cron job list
- 每個 job 渲染為 SessionItem-like 的行：名稱 + 狀態圓點 + 下次執行時間
- 支援 "New Task" 按鈕

### DD-3: Task Detail Layout = Session Detail Adaptation
**決策**：Task detail 頁面複用 session page 的 layout 骨架（header + main content + side panel），但替換內容：
```
┌────────────────────────────────────────────────────┐
│ [Task Name]                 [Status] [Schedule]    │
├──────────────────────────────────────┬─────────────┤
│                                      │ Tool Panel  │
│  ┌─ Prompt ─────────────────────┐    │             │
│  │ (editable textarea)          │    │ ▶ Test      │
│  └──────────────────────────────┘    │ ✏ Edit      │
│                                      │ 🔄 Refresh  │
│  ┌─ Cron Config ────────────────┐    │ ⚙ Config    │
│  │ [*/5 * * * *]  [Asia/Taipei] │    │ 🗑 Delete   │
│  │ Presets: [1m][5m][15m][1h]   │    │             │
│  │ Next: in 3 minutes           │    │ ──────────  │
│  └──────────────────────────────┘    │ Start/Stop  │
│                                      │             │
│  ┌─ Execution Log ──────────────┐    │             │
│  │ ▸ Today 14:30 (2.1s) ✅      │    │             │
│  │   AI: 找到 2 封股市相關信件… │    │             │
│  │                               │    │             │
│  │ ▸ Today 14:25 (1.8s) ✅      │    │             │
│  │   AI: 目前沒有未讀的股市…    │    │             │
│  │                               │    │             │
│  │ ▸ Today 14:20 (3.2s) ❌      │    │             │
│  │   Error: API timeout          │    │             │
│  └──────────────────────────────┘    │             │
└──────────────────────────────────────┴─────────────┘
```

### DD-4: 執行紀錄 log — 完整 AI 回覆
**決策**：執行紀錄不只是 summary，要顯示完整 AI response。
**實作策略**（兩階段）：
- **Phase 1（本次）**：run log 記錄 sessionId → UI 透過 `GET /session/:sessionId/messages` 讀取完整對話
- **Phase 2（未來）**：若 session 被 retention reaper 清除，fallback 到 run log summary
**理由**：Session messages 已包含完整 AI response，不需要在 run log 重複儲存。sessionId 是連結關鍵。

### DD-5: 後端 Trigger → Session 管線修復
**決策**：修復 heartbeat.ts 中 trigger built but not enqueued 的缺口。
**實作**：
1. `executeJobRun()` 呼叫 `CronSession.resolve()` 建立/取得 session
2. 取得 sessionId，記錄到 outcome
3. 將 trigger enqueue 到 session 的 RunQueue
4. Run log entry 包含 sessionId
**理由**：這是讓整個系統真正運作的關鍵修復

### DD-6: 工具 Panel
**決策**：右側 side panel 提供操作工具：
- **Test**：立即執行一次，結果顯示在 log
- **Edit**：跳出完整編輯浮窗（name, prompt, schedule, timezone — 已實作 TaskEditDialog）
- **Refresh**：重新載入 run history
- **Config**：指定 model、timeout、delivery mode
- **Delete**：刪除此 task
- **Start/Stop**：toggle enabled
**理由**：使用者明確要求工具 panel

### DD-7: Per-user 隔離
**決策**：不在 CronJob schema 加 userId。依賴 daemon per-user 架構。
**理由**：
- 每個使用者有獨立 daemon（自己的 UID）
- Cron store 在 `~/.config/opencode/cron/jobs.json`（使用者 home 下）
- 天然隔離，無需額外欄位

### DD-8: 路由設計
**決策**：
```
/system/tasks                → Task List（虛擬 project 首頁）
/system/tasks/:jobId         → Task Detail（選中的 task）
```
**理由**：
- `/system/` prefix 區分虛擬 project 和真實 project（`/:dir/`）
- 不走 base64 directory encode
- 簡潔直覺

## Data / State / Control Flow

### Sidebar 切換流

```
sidebar-shell.tsx
├─ [★ Scheduled Tasks]  (置頂虛擬 project tile)
│   └→ click → navigate(/system/tasks)
│   └→ sidebar session list → 切換為 cron job list
│       ├─ [Job A] ● Active — next in 3m
│       ├─ [Job B] ○ Disabled
│       └─ [+ New Task]
├─ [📁 Project 1]
├─ [📁 Project 2]
└─ [Settings] [Logout]
```

### Task Detail Data Flow

```
TaskDetailPage
  ├→ createCronApi(globalSDK) → fetch job detail
  ├→ PromptSection: job.payload.message (editable)
  ├→ CronConfigSection: job.schedule (editable inline)
  ├→ ExecutionLogSection:
  │    ├→ api.getRuns(jobId, 20) → run entries
  │    ├→ 每個 entry 有 sessionId
  │    └→ 展開 entry → GET /session/:sessionId/messages → 完整 AI 回覆
  └→ ToolPanel: test/edit/refresh/config/delete/toggle
```

### Test Mode 執行流

```
User clicks [Test]
  │
  ├→ POST /api/v2/cron/jobs/:id/run
  │    └→ Heartbeat.tick() → executeJobRun()
  │    └→ CronSession.resolve() → creates isolated session
  │    └→ RunQueue.enqueue(cronTrigger)
  │    └→ Returns { ok: true, jobId }
  │
  ├→ Poll: GET /api/v2/cron/jobs/:id/runs?limit=1
  │    └→ 取得最新 run entry (含 sessionId)
  │
  ├→ GET /api/v2/session/:sessionId/messages
  │    └→ 完整 AI 回覆
  │
  └→ UI 顯示在 execution log 最新條目
```

## Risks / Trade-offs

- **Trigger enqueue 修復** → 需確認 RunQueue 在 cron context 下的行為（gate policy, worker process）→ mitigation: CronTrigger 已定義 gate policy 繞過 approval/mission/beta
- **Session messages 讀取** → retention reaper 24h 後清除 session → mitigation: Phase 2 考慮延長 cron session retention 或在 run log 備份完整 response
- **路由衝突** → `/system/tasks` 不能與 `/:dir` pattern 衝突 → mitigation: router 中 `/system/*` 在 `/:dir` 之前匹配
- **Large AI response** → 完整回覆可能很長 → mitigation: 預設折疊，展開後 max-height + scroll

## Critical Files

### 需修改
- `packages/opencode/src/cron/heartbeat.ts` — 接通 session 執行管線
- `packages/opencode/src/cron/run-log.ts` — 確保 sessionId 寫入
- `packages/app/src/pages/layout/sidebar-shell.tsx` — 新增虛擬 project tile
- `packages/app/src/app.tsx` — 路由 `/system/tasks`, `/system/tasks/:jobId`
- `packages/app/src/pages/task-list/` — 重構為 session-like layout

### 需新增
- `packages/app/src/pages/task-list/task-detail.tsx` — Task detail 三區 page
- `packages/app/src/pages/task-list/task-sidebar.tsx` — Task session list for sidebar
- `packages/app/src/pages/task-list/task-tool-panel.tsx` — 右側工具 panel

### 可複用（參考）
- `packages/app/src/pages/layout/sidebar-items.tsx` — SessionItem 視覺風格
- `packages/app/src/pages/layout/sidebar-workspace.tsx` — Session list loading pattern
- `packages/app/src/pages/session/index.tsx` — Session detail layout 骨架
