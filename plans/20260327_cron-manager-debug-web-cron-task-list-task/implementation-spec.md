# Implementation Spec

## Goal

- 修正 subagent child session 的觀測面 contract：禁止對話輸入、補上執行中 kill switch，並收斂 subsession / status bar / session list 的同步一致性。

## Scope

### IN

- child session（subsession）頁面不再提供可互動對話輸入框
- child session 顯示唯讀佔位文案，明示 subagent session 為非對話互動式 process
- child session 在 authoritative running 狀態下顯示 kill switch
- 既有 active-child / session monitor / session list / child transcript 觀測面需保持一致
- 驗證 stop/kill 後 UI 狀態收斂，不殘留 stale running child

### OUT

- 不重做 task worker IPC
- 不重做 parent session orchestration contract
- 不新增 child session 對話接管/handoff 模式
- 不修改全域 emergency kill-switch 機制

## Assumptions

- subagent 的產品定義維持為非對話互動式 worker process，而不是可被使用者直接接續聊天的 session。
- `terminateActiveChild(parentSessionID)` 可作為 child-session kill switch 的既有 runtime 停止入口。
- `SessionActiveChild` 仍是 child 是否屬於 authoritative running state 的單一真相來源。

## Stop Gates

- 若 child session 仍有合法的人機對話需求，需先回 planning 重新定義 subagent contract。
- 若現有 API 無法從 child session 安全映射回 parentSessionID，停止並補 API/route contract。
- 若 kill 行為需要 destructive-style 二次確認策略變更，先停下來做產品決策。

## Critical Files

- packages/app/src/pages/session/session-prompt-dock.tsx
- packages/app/src/pages/session/**
- packages/app/src/context/global-sync/event-reducer.ts
- packages/opencode/src/tool/task.ts
- packages/opencode/src/server/routes/session.ts
- packages/opencode/src/session/monitor.ts

## Structured Execution Phases

- Phase 1: 收斂 child session contract，禁止可互動 PromptInput 並改為唯讀佔位
- Phase 2: 導入 child session running indicator + kill switch，直接綁定 authoritative active-child state
- Phase 3: 驗證 child transcript / status bar / session list / stop action 的一致性並同步文件

## Validation

- 針對 child session UI 做 targeted typecheck / component test / route-level smoke verification
- 驗證 running child 時可見 kill switch；完成/停止後 kill switch 消失
- 驗證 child session 不再出現可提交的 PromptInput，只顯示唯讀佔位
- 驗證 session list、status bar、child page 對同一 active-child 的顯示一致
- 驗證 stop 後不殘留 stale running subsession

## Handoff

- Build agent must read this spec first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md / handoff.md before coding.
- Build agent must materialize runtime todo from tasks.md and preserve planner task naming.
- Build agent must prefer delegation-first execution when the task slice can be safely handed off.
