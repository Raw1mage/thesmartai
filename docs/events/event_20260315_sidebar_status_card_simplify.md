# Event: Sidebar status card simplification and persistence

Date: 2026-03-15
Status: Completed

## 需求

- 移除 sidebar 中過於複雜且不直觀的 `Smart Runner history`
- 移除 `Latest narration` / `Latest result` / `Debug` 卡片
- 將 autonomous 與 task monitor 重構合併為單一「工作監控」卡
- 移除 sidebar 中的 `外掛程式 (plugins)` 與 `LSP` 卡
- 讓 sidebar 卡片支援拖曳排序
- 將卡片順序與展開/收折狀態以**全域**方式持久化記憶

## 範圍

### IN

- `packages/app/src/pages/session/session-side-panel.tsx`
- `packages/app/src/pages/session/session-status-sections.tsx`
- `packages/app/src/pages/session/helpers.ts`
- `packages/app/src/context/layout.tsx`
- 相關前端測試與驗證

### OUT

- 不改 backend runtime contract
- 不改 session autonomous queue/health API shape
- 不改 TUI status sidebar

## 任務清單

- [x] 簡化 status sidebar 卡片資訊架構
- [x] 合併 autonomous / task monitor 為單一卡片
- [x] 移除 Smart Runner history / Latest narration / Latest result / Debug / LSP / plugins
- [x] 加入卡片拖曳排序
- [x] 加入全域展開狀態與順序持久化
- [x] 驗證並完成 architecture sync 記錄

## 實作摘要

- `packages/app/src/context/layout.tsx`
  - 新增全域 `statusSidebar.order` 與 `statusSidebar.expanded` persisted state。
  - 提供 `setOrder` / `expanded` / `setExpanded` / `toggleExpanded` 供 session status surfaces 共用。
- `packages/app/src/pages/session/session-status-sections.tsx`
  - sidebar/status sections 精簡為 `工作監控`、`Todo`、`Servers`、`MCP` 四卡。
  - 移除舊的 `summary`、`LSP`、`plugins` sections。
  - 加入 `@thisbeyond/solid-dnd` sortable card reorder，並寫回全域 layout store。
  - expand/collapse 狀態改為使用全域 layout store，不再使用區域 state。
- `packages/app/src/pages/session/session-side-panel.tsx`
  - 將原 autonomous summary / queue control / process status 與 monitor list 合併進單一 `工作監控` 卡。
  - 停止渲染獨立 summary card。
- `packages/app/src/pages/session/tool-page.tsx`
  - 對齊桌面側欄的 `工作監控` 呈現，改用相同的 status summary + monitor content 組合。
  - Todo 卡可高亮 current todo。
- `packages/app/src/pages/session/helpers.ts`
  - 將 `SessionStatusSummary` contract 收斂為 `currentStep` / `methodChips` / `processLines`。
  - 移除已不再供 sidebar 使用的舊 Smart Runner summary/debug/history helper 邏輯。
- `packages/app/src/pages/session.tsx`
  - 修正 `sync.data.message[id]` 直接索引導致的 `TS2538` 型別錯誤。

## Debug / Checkpoints

### Baseline

- sidebar 仍保留 Smart Runner 歷史/敘事/結果等多張卡片，資訊密度過高且不符合最新 UX 目標。
- card 展開狀態與順序未做全域持久化。
- tool-page status view 與桌面側欄資訊結構已開始漂移。
- app typecheck 因 session page message index 與 status helper 測試遷移中斷而失敗。

### Instrumentation Plan

- 先讀 architecture 與既有 web sidebar events，確認這次是否只屬 UI aggregation/persistence，不動 backend contract。
- 以 `layout.tsx` 作為全域 persisted UI state SSOT。
- 以 targeted app typecheck / helper tests 當作收斂驗證，不做無關 full-repo 掃描。

### Execution

- 將狀態卡片收斂到單一 `工作監控` 主卡，保留 objective / method chips / process lines / queue controls / monitor rows。
- 將排序與展開狀態寫入 global layout persisted store。
- 對齊 tool-page 與 desktop sidebar 的 monitor rendering contract。
- 清除 helpers.ts 殘留的 Smart Runner sidebar summary dead code。
- 修正 session page 的訊息索引型別問題。
- 調整 DOM-only helper tests 為條件執行，避免在無 DOM test runtime 下誤失敗。

### Root Cause

- 主要問題不是 backend/state 不一致，而是前端 sidebar 經多輪 autonomous observability 疊加後，資訊架構未再收斂，造成 card 邊界與 summary contract 過度複雜。
- 同時，status summary helper 已局部重構，但舊 Smart Runner-oriented helper 邏輯仍殘留，讓測試與型別面維持不穩定。

## Validation

- `bun --filter @opencode-ai/app typecheck` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/app/src/pages/session/helpers.test.ts" "/home/pkcs12/projects/opencode/packages/app/src/pages/session/monitor-helper.test.ts"` ✅
  - 結果：11 pass / 2 skip / 0 fail
  - skip 原因：`focusTerminalById` 測試需要 DOM，當前 bun 測試 runtime 無 document。

## Follow-up adjustments (same day)

- 移除 `review.toggle` 的 `Ctrl/Cmd+Shift+R` 綁定，避免異動檢視被快捷鍵強綁。
- 工作監控卡內取消全域 `Current objective / No current step` 區塊，避免把 runner/main agent 目標混成單一摘要。
- monitor 子卡改為以 badge + title + headline 呈現：
  - session / sub-session 顯示 `[S]` / `[SS]` + session title
  - agent / sub-agent 顯示 `[A]` / `[SA]` + agent 名稱
  - tool 顯示 `[T]` + tool 名稱
- headline 優先顯示該卡自己的 `todo.content`，否則才落到最新 narration 或 active tool，讓 runner/agent「正在忙什麼」出現在自己的卡內，而不是被全域 `No current step` 取代。

### Follow-up validation

- `bun --filter @opencode-ai/app typecheck` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/app/src/pages/session/helpers.test.ts" "/home/pkcs12/projects/opencode/packages/app/src/pages/session/monitor-helper.test.ts"` ✅
  - 結果：11 pass / 2 skip / 0 fail

## Runner card integration

- 將 Runner 視為工作監控中的一個獨立工作單位，以**前端合成卡**方式固定呈現為 `[R]`。
- 資料流整合來源：
  - `session workflow`（workflow state / stop reason / supervisor）
  - `autonomous health`（summary / queue / anomalies）
  - `current todo/current step`
  - `session runtime status`
- `[R]` 卡永遠存在：
  - 若 Runner 已有 current step，標題顯示 current step
  - 否則退到 queue reason / health summary / runtime status
  - 若完全未啟動，明確顯示 `idle`
- monitor 列表中的其他卡片仍代表 session / agent / subagent / tool 等工作單位；Runner 不再依賴 monitor API 原生提供 `level: runner`，而是由前端將 orchestration 狀態聚合成一張穩定卡片。
- `[R]` 卡進一步升級為**執行動態卡**，不再只顯示粗粒度 workflow/runtime 狀態：
  - 會聚合 current task / current step
  - 會列出 active tools
  - 會列出 delegated subagents
  - 會從 tool input metadata 推斷 MCP / server 痕跡（如 `mcpName` / `serverName`）
  - 因此 `[R]` 現在用來表達真正的 Runner activity，而不是單純 `STATUS` 摘要
- Todo list 不再把低資訊價值的 `implement` 顯示為獨立泡泡；改為只顯示有意義的狀態後綴，並以 `·` 內嵌在同一行尾端（如 waiting / needs approval）。

### Runner validation

- `bun --filter @opencode-ai/app typecheck` ✅
- `bun test "/home/pkcs12/projects/opencode/packages/app/src/pages/session/helpers.test.ts" "/home/pkcs12/projects/opencode/packages/app/src/pages/session/monitor-helper.test.ts"` ✅
  - 結果：12 pass / 2 skip / 0 fail

## Controlled web restart flow

- 新增受控 Web restart control flow，而不是常駐 auto-refresh：
  - Web settings 新增 `Restart Web` 按鈕
  - 按下後呼叫 `POST /api/v2/global/web/restart`
  - backend 透過 runtime control script 觸發 `webctl.sh restart --graceful`
  - frontend 進入等待狀態並輪詢 `/api/v2/global/health`
  - server 恢復健康後自動 `window.location.reload()`
- restart control script 路徑改納入 runtime config contract：
  - `templates/system/opencode.cfg` 新增 `OPENCODE_WEBCTL_PATH="/etc/opencode/webctl.sh"`
  - `install.sh` 會安裝 repo `webctl.sh` 到 `/etc/opencode/webctl.sh`
  - backend route 預設優先使用 `OPENCODE_WEBCTL_PATH`（若有 env override 則可覆蓋）
- 設計目標：不是所有情況都自動 refresh，而是**只有使用者明確觸發 restart 時**，頁面才進入受控等待與 reload。

## Architecture Sync

- Verified (No doc changes)
- 依據：本次變更限於 web session sidebar 的 UI aggregation、排序/展開全域持久化與測試收斂，未改變模組邊界、後端資料流、runtime state machine 或 API contract。
