# Tasks — Scheduled Tasks UI (R2: Project-Session Reuse)

## Phase 1: 後端修復（Trigger → Session 管線）

- [ ] 1.1 修復 `heartbeat.ts` — `executeJobRun()` 呼叫 `CronSession.resolve()` 建立 isolated session
- [ ] 1.2 修復 `heartbeat.ts` — 將 built trigger enqueue 到 session 的 RunQueue
- [ ] 1.3 修復 `heartbeat.ts` — 捕獲 sessionId 並回填至 outcome
- [ ] 1.4 修復 `run-log.ts` — 確保 append() 寫入 sessionId 欄位
- [ ] 1.5 驗證 `POST /jobs/:id/run` 端點實際建立 session 並執行 AI
- [ ] 1.6 驗證 run log entry 包含 sessionId，可用於讀取 session messages

## Phase 2: 路由 + 虛擬 Project 入口

- [ ] 2.1 在 `app.tsx` 新增路由 `/system/tasks` 和 `/system/tasks/:jobId`
- [ ] 2.2 確保 `/system/*` 路由不與 `/:dir` pattern 衝突（優先匹配）
- [ ] 2.3 在 `sidebar-shell.tsx` 新增 Scheduled Tasks 虛擬 project tile（置頂）
- [ ] 2.4 點擊虛擬 tile 時 navigate 到 `/system/tasks`，sidebar 切換為 task list

## Phase 3: Task Session List（Sidebar）

- [ ] 3.1 建立 `task-sidebar.tsx` — 複用 SessionItem 風格的 cron job 列表
- [ ] 3.2 列表項顯示：job name + 狀態圓點 + 下次執行時間
- [ ] 3.3 選中某 job 時 navigate 到 `/system/tasks/:jobId`
- [ ] 3.4 列表頂部 "New Task" 按鈕（觸發 TaskEditDialog）
- [ ] 3.5 右鍵 / 長按 context menu：Edit / Delete / Toggle

## Phase 4: Task Detail Page（三區 Layout）

- [ ] 4.1 建立 `task-detail.tsx` — 主內容區骨架（prompt + cron + log）
- [ ] 4.2 **Prompt 區**：可編輯 textarea，blur 時 auto-save（PATCH payload）
- [ ] 4.3 **Cron 設定區**：inline crontab input + timezone + presets + next run preview
- [ ] 4.4 **執行紀錄 log 區**：
  - [ ] 4.4.1 載入 run history（api.getRuns）
  - [ ] 4.4.2 每筆 entry 顯示：時間 + 耗時 + 狀態
  - [ ] 4.4.3 展開 entry → 透過 sessionId 讀取 session messages → 顯示完整 AI 回覆
  - [ ] 4.4.4 若 session 已被 reaper 清除，fallback 到 run.summary
- [ ] 4.5 **Header**：Task name + status badge + schedule badge

## Phase 5: Tool Panel（右側）

- [ ] 5.1 建立 `task-tool-panel.tsx` — 右側工具 panel
- [ ] 5.2 **Test**：立即執行，結果出現在 log 最新條目
- [ ] 5.3 **Edit**：觸發 TaskEditDialog（name, prompt, schedule, timezone）
- [ ] 5.4 **Refresh**：重新載入 run history
- [ ] 5.5 **Config**：指定 model、timeout 等 payload 參數
- [ ] 5.6 **Start/Stop**：toggle job.enabled
- [ ] 5.7 **Delete**：刪除 job（確認 dialog）

## Phase 6: 整合 + 清理

- [ ] 6.1 將現有 `pages/task-list/` 中的元件整合進新 layout
- [ ] 6.2 移除舊的 `/:dir/tasks` 路由（改為 `/system/tasks`）
- [ ] 6.3 GlobalSync 或 dedicated store 管理 cron job 列表 reactive state

## Phase 7: Validation

- [ ] 7.1 TypeScript build 驗證（無 type errors）
- [ ] 7.2 後端驗證：POST /jobs/:id/run → 實際建立 session + AI 執行
- [ ] 7.3 前端驗證：sidebar 虛擬 project → task list → task detail 完整導航
- [ ] 7.4 前端驗證：execution log 展開顯示完整 AI 回覆
- [ ] 7.5 前端驗證：test 按鈕 → 執行 → log 更新 → AI response 可見
- [ ] 7.6 前端驗證：edit dialog → 修改 name/prompt/schedule → 儲存
- [ ] 7.7 Event log + Architecture sync
