# Proposal — Scheduled Tasks UI (R2: Project-Session Reuse)

## Why

- Cron/scheduler 後端已完整實作（store, heartbeat, delivery, run-log），但只能透過 AI tool 或 gateway protocol 操作，沒有視覺化管理界面
- 使用者希望 Scheduled Tasks 作為 **系統級 Project**，複用現有 Project → Session List → Session Detail 的 layout 骨架
- 每個 cron job 本質上就是一個 session（帶有 Prompt 和定時設定），應該比照 session 來設計

## Original Requirement Wording (Baseline)

- "最好是再建立一個類似session list的scheduled tasklist，裏面的每個task都是一張卡片"

## Requirement Revision History

- 2026-03-25: 初始需求
- 2026-03-25 R1: 三區式卡片 + 入口 + LINE Bot 通知
- 2026-03-25 R2: **架構升級** — Scheduled Tasks 應作為系統級 Project，每個 task 就是一個 session。複用 Project → Session List → Session Detail layout 骨架。Session detail 不是無限聊天，而是三區：Prompt 輸入、Cron 設定、執行紀錄 log（含 AI 完整回覆）。工具 panel 處理 test/edit/log refresh/config。Per-user 隔離。

## Effective Requirement Description

1. **系統級 Project**：Scheduled Tasks 作為一個虛擬 Project，永遠置頂於 sidebar
2. **Session List = Task List**：左側 sidebar 列出所有 cron jobs（如同 session 列表）
3. **Session Detail = Task Detail**：選中某個 task 後，右側顯示三個區塊：
   - **Prompt 輸入區**：可編輯的 prompt
   - **Cron 設定區**：crontab 語法 + timezone + presets
   - **執行紀錄 log**：每次執行的時間 + AI 完整回覆（如 session 對話歷史）
4. **工具 panel**：Test（立即執行）、Edit（跳出浮窗編輯全部設定）、Log refresh/rotate、Configuration（指定 model 等）
5. **Per-user 隔離**：不同使用者登入系統有不同的 scheduled tasks（daemon 架構已保證）
6. **執行結果通知**：LINE Bot / webhook push（Phase 2）

## Scope

### IN

- 虛擬 Project 入口（sidebar 置頂 tile）
- Task session list（sidebar 區域複用 session list pattern）
- Task detail 三區 layout（prompt + cron + execution log）
- 完整的 cron job CRUD（已有 REST API）
- Task 工具 panel（test, edit dialog, log refresh, model config）
- **後端修復**：接通 trigger → session 執行管線，讓 cron job 真正產生 session + AI 回覆
- **後端修復**：run log 記錄 sessionId，讓 UI 可讀取 session messages 作為完整 AI 回覆

### OUT

- Cron 後端核心重構（store/heartbeat/delivery 結構不動）
- DAG 排程依賴管理
- LINE Bot delivery（Phase 2）
- 多租戶排程隔離（daemon 已保證 per-user）

## Non-Goals

- 取代對話內的 cron tool（兩者共存）
- 即時雙向 LINE 對話

## Constraints

- 複用現有 Solid.js + SDK + routing 骨架
- HTTP REST → daemon 路徑
- Cron 語法須相容 linux crontab 5-field

## What Changes

### 前端（複用骨架 + 新元件）
- 修改 `sidebar-shell.tsx` — 新增 Scheduled Tasks 虛擬 project tile（置頂）
- 新增 `pages/task-list/` — Task session list + Task detail page
- 修改 `app.tsx` — 路由註冊

### 後端（修復執行管線）
- 修改 `cron/heartbeat.ts` — 接通 CronSession.resolve() + RunQueue enqueue
- 修改 `cron/run-log.ts` — 記錄 sessionId
- 確認 run log summary 包含完整 AI response（或改用 session messages）
