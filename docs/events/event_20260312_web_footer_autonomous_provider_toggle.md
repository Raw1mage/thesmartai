# Event: web footer autonomous provider toggle

Date: 2026-03-12
Status: Completed

## 需求

- 調整 webapp prompt footer UI。
- 移除原本獨立的「自動代理」切換按鈕。
- 改由 footer 第一個 provider 字樣（例如 `OpenAI`）作為自動代理開關。
- 啟用時 provider 字樣需有明顯高亮（例如亮綠色）。

## 範圍 (IN / OUT)

### IN

- `packages/app/src/components/prompt-input.tsx`
- `docs/ARCHITECTURE.md`
- `docs/events/event_20260312_web_footer_autonomous_provider_toggle.md`

### OUT

- 不變更 autonomous backend API contract
- 不變更 TUI autonomous toggle 行為
- 不新增 fallback / rescue 機制

## 任務清單

- [x] 讀取 architecture 與既有 event，確認目前 autonomous footer contract
- [x] 定位 web prompt footer 的 provider label 與 autonomous toggle 實作
- [x] 改為 provider label click/tap 觸發 autonomous toggle
- [x] 移除 footer 獨立 autonomous icon button
- [x] 加上 autonomous enabled 的高亮視覺狀態
- [x] 驗證前端建置/型別，並同步 architecture

## Debug Checkpoints

### Baseline

- 現況在 `packages/app/src/components/prompt-input.tsx`：footer 左側顯示 provider label，右側另有獨立 autonomous icon button。
- autonomous toggle 走 `POST /api/v2/session/:sessionID/autonomous`，並在 enable 時送 `enqueue: true`。

### Instrumentation Plan

- 僅調整同一個前端元件的 footer render 與互動綁定。
- 保留既有 `toggleAutonomous()` 行為，避免動到 backend contract。

### Execution

- `packages/app/src/components/prompt-input.tsx`
  - 將 footer 第一個 provider 字樣從純文字改為可點擊 `Button`，並綁定既有 `toggleAutonomous()`。
  - 啟用自動代理時套用高亮樣式：`text-green-400` + `bg-green-500/10`。
  - 保留 pending/disabled/aria 邏輯（`autonomousPending()`、`aria-pressed`、`aria-label`）。
  - 移除右側原本獨立的 autonomous icon button（console 圖示切換鈕）。
- `docs/ARCHITECTURE.md`
  - 更新 web prompt footer autonomous entrypoint 描述：由獨立按鈕改為 provider label 入口。

### Root Cause

- N/A（UI 調整任務）

### Validation

- `bun run --cwd "/home/pkcs12/projects/opencode/packages/app" typecheck` ✅
- `git diff -- /home/pkcs12/projects/opencode/packages/app/src/components/prompt-input.tsx /home/pkcs12/projects/opencode/docs/ARCHITECTURE.md /home/pkcs12/projects/opencode/docs/events/event_20260312_web_footer_autonomous_provider_toggle.md` ✅
- 註記：`bun run typecheck`（workspace 全域）在本次 session 因超時中斷；已以目標模組 `packages/app` typecheck 完成驗證。
- Architecture Sync: Updated
  - 依據：autonomous 入口 UI contract 由獨立按鈕改為 provider label，已同步 `docs/ARCHITECTURE.md`。
