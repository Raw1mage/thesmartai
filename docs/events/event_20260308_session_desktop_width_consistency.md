# Event: session desktop width consistency

Date: 2026-03-08
Status: In Progress

## 需求

- 修正 web session 在 1024–1535px 區間內容寬度異常縮窄的問題
- 讓 1023 以上的桌面版 session 內容寬度規則一致
- 維持既有 centered desktop 版面結構，不變更 runtime / API

## 範圍

### IN

- `packages/app/src/pages/session/message-timeline.tsx`
- `packages/app/src/pages/session/session-prompt-dock.tsx`
- `packages/app/src/components/session/session-new-view.tsx`

### OUT

- 不修改 mobile 版面規則
- 不修改 sidebar / review panel 開關邏輯
- 不修改 backend 或 web runtime 架構

## 任務清單

- [x] 定位 desktop centered width 在 1024–1535px 區間的縮窄來源
- [x] 統一 desktop centered width 規則
- [x] 驗證 typecheck 並更新文件紀錄

## Debug Checkpoints

### Baseline

- `MessageTimeline`、`SessionPromptDock`、`NewSessionView` 共用 `md:max-w-200 md:mx-auto 2xl:max-w-[1000px]`。
- 但 centered desktop 模式是從 `min-width: 1024px` 才啟用，因此 1024–1535px 區間會先吃到較窄的 `max-w-200`，直到 2xl 才放寬成 `1000px`。
- 造成視覺上 1024–1535px 反而比 1023 以下更窄。

### Execution

- 將 `MessageTimeline` 的 header、timeline container、message wrapper 的 centered width class 統一改為 `max-w-[1000px]`，移除只在 2xl 才放寬的雙段式寬度規則。
- 將 `SessionPromptDock` centered width 同步改為 `max-w-[1000px] mx-auto`，避免輸入區在 1024–1535px 區間仍套用較窄寬度。
- 將 `NewSessionView` 空白態頁面的 root centered width 同步改為 `max-w-[1000px] mx-auto`，確保新 session 與既有 session 視覺一致。

### Validation

- `bun run typecheck`（repo root）失敗：`turbo` native binary `EACCES`，原因是 `node_modules/.bun/turbo-linux-64.../bin/turbo` 缺少 executable bit，屬環境權限問題，非本次程式修改造成。
- `bun run typecheck`（`packages/app`）失敗：`tsgo` native binary `EACCES`，原因是 `node_modules/.bun/@typescript+native-preview-linux-x64.../lib/tsgo` 缺少 executable bit，同屬環境權限問題。
- `bunx tsc -p /home/pkcs12/projects/opencode/packages/app/tsconfig.json --noEmit`：passed。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅統一 web session centered content 的前端寬度 class，未改動 runtime boundary、資料流、模組責任或 API contract。
