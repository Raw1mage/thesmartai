# Implementation Spec

## Goal

- 為現有 cron 後端建立 REST API 和前端 Task List 管理界面，讓使用者能直觀地建立、測試、管理 AI 排程任務，並透過 LINE Bot 接收即時通知

## Scope

### IN

- Phase 1: REST API + Task List 頁面 + 卡片 UI + Test mode
- Phase 2: LINE Bot delivery adapter
- Phase 3: 執行歷史詳情 + 條件式通知

### OUT

- Cron 後端核心重構
- DAG 排程依賴
- LINE 雙向對話

## Assumptions

- 現有 `CronStore` API（list, create, update, remove, get）穩定且可直接使用
- 現有 `CronRunLog`（append, read）穩定且可直接使用
- Heartbeat loop 已在 daemon boot 時自動恢復排程
- 現有 delivery webhook 機制可直接用於 LINE Bot push
- LINE Messaging API 只需 channel access token + user ID 即可 push message

## Stop Gates

- 若 `CronStore` API 簽名與 types.ts 不符 → 先對齊
- 若 heartbeat 的 isolated session 無法支援 MCP tool call（如 Gmail） → 需確認 light-context 是否載入 MCP
- 若 LINE Bot push API 需要 OAuth 而非 static token → 需調整 delivery adapter 設計
- Phase 2 LINE Bot 需使用者提供 channel access token → 需確認取得方式

## Critical Files

- `packages/opencode/src/cron/store.ts` — CronStore CRUD
- `packages/opencode/src/cron/types.ts` — CronJob, CronSchedule, CronPayload schemas
- `packages/opencode/src/cron/run-log.ts` — CronRunLog read
- `packages/opencode/src/cron/heartbeat.ts` — 排程觸發（確認 light-context + MCP）
- `packages/opencode/src/cron/delivery.ts` — Delivery routing（擴展 LINE adapter）
- `packages/opencode/src/server/routes/` — 新增 cron.ts
- `packages/opencode/src/server/index.ts` — 路由掛載
- `packages/app/src/app.tsx` — 前端路由
- `packages/app/src/pages/layout/sidebar-shell.tsx` — Sidebar 入口
- `packages/app/src/pages/task-list/` — 新增前端頁面

## Structured Execution Phases

- Phase 1: REST API — CronStore CRUD + RunLog read + manual trigger 暴露為 HTTP 端點
- Phase 2: Frontend scaffold — Task List 頁面骨架 + 路由 + sidebar 入口（MCP Market 下方）
- Phase 3: Task card — 三區式卡片（prompt editor + AI viewer + cron panel）+ action buttons
- Phase 4: Test mode — Test 按鈕即時執行 prompt → 建立 isolated session → SSE/polling 取得 AI response → 顯示在卡片 viewer
- Phase 5: Cron panel — 5-field crontab input + timezone selector + preset shortcuts + 下次執行時間預覽
- Phase 6: LINE Bot delivery — delivery.ts 擴展 LINE Messaging API push adapter + 設定 UI（channel token + user ID）
- Phase 7: Polish — 執行歷史展開、條件式通知（只在有內容時通知）、錯誤重試狀態顯示、batch 操作
- Phase 8: Validation — 端到端測試、build 驗證

## Validation

- TypeScript build 無新增 type errors
- REST API 端點可透過 curl 驗證 CRUD + trigger
- Task List 頁面可正常載入、顯示現有 cron jobs
- 新建 task → 填 prompt + crontab → Save → 卡片出現在列表
- Test 按鈕 → AI response 出現在 viewer
- Start/Stop toggle 即時切換 job enabled
- Delete 移除 job
- LINE Bot push 成功送達（Phase 2）

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
