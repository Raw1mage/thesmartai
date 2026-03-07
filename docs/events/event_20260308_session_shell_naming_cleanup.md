# Event: Session Shell Naming Cleanup

Date: 2026-03-08
Status: Done

## 需求

- 清理 session shell 中 `reviewPanel` / `desktopReviewOpen` 等舊命名。
- 讓 file pane、changes pane、tool sidebar 的語意更清楚。
- 降低後續維護時把 file pane 誤認成 review pane 的風險。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/packages/app/src/context/layout.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/session-side-panel.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/session/session-header.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/prompt-input.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/dialog-select-file.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_session_shell_naming_cleanup.md`

OUT:

- `SessionReviewTab` / diff domain 名稱全面改名
- `commentOrigin: "review" | "file"` 型別重構
- store schema 全量 rename migration

## 任務清單

- [x] 盤點 shell 相關 `review*` 舊命名
- [x] 將 shell API 與主要呼叫點收斂成 `filePane` / `changesPanel` 語意
- [x] 保留必要相容層，避免一次動到過多 diff domain 命名
- [x] 驗證 build/runtime，並完成 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- `view().reviewPanel.opened()` 在目前實際語意上代表 file view pane 是否開啟。
- `session.tsx` 內仍存在 `openReviewPanel`、`desktopReviewOpen`、`reviewPanel()` 等命名，容易和變更檢視 changes panel 混淆。
- `SessionSidePanel` 雖已拆成 file pane / tool sidebar，但 prop 名稱仍有 `reviewPanel` 殘留。

### Execution

- 在 `context/layout.tsx` 新增 `view().filePane` canonical shell API，並暫時保留 `reviewPanel` alias 作為相容層，避免一次打爆所有舊呼叫點。
- 在 `pages/session.tsx` 將主要 shell 命名收斂：
  - `openReviewPanel` → `openFilePane`
  - `reviewPanel()` → `changesPanel()`
  - `desktopReviewOpen` → `desktopFilePaneOpen`
  - `desktopFileTreeOpen` → `desktopToolSidebarOpen`
- 在 `session-side-panel.tsx` 將 prop `reviewPanel` 改為 `changesPanel`，並讓 file pane `×` 透過 `view().filePane.close()` 關閉。
- 在 `session-header.tsx`、`prompt-input.tsx`、`dialog-select-file.tsx` 將 shell 級呼叫從 `reviewPanel` 改為 `filePane`。
- 仍保留 diff domain 名稱如 `SessionReviewTab`、`commentOrigin: "review"`，避免把 shell 命名清理和 review 功能語意混成一個大重構。

### Validation

- `bun run build`（workdir: `packages/app`）
  - 通過。
- `./webctl.sh dev-refresh && ./webctl.sh status`
  - 通過，health 為 `{"healthy":true,"version":"local"}`。
- Spot check:
  - `packages/app/src/context/layout.tsx` 仍只保留單一 store source，但對外提供 `filePane` canonical API。
  - `packages/app/src/pages/session.tsx` / `session-side-panel.tsx` / `session-header.tsx` 的 shell 命名已不再把 file pane 誤稱為 review panel。
- Architecture Sync: Updated
  - 已更新 `docs/ARCHITECTURE.md`：
    - 補充 session page shell contract
    - 記錄 pane topology（main conversation / file pane / tool sidebar / terminal panel）
    - 記錄 `view().filePane` 為 canonical shell API，`reviewPanel` 為 compatibility alias
