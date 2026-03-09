# Event: UI File Changes Git-Uncommitted Contract

Date: 2026-03-09
Status: In Progress

## 需求

- 重新定義 TUI / webapp 的 `Changes` / `檔案異動` contract。
- UI 應以「當下 session workspace 的 git uncommitted files」為主語意，而不是 legacy `session.diff` ownership 視角。
- 釐清目前 runtime / frontend 實作是否仍混用 session-owned dirty diff，並規劃替換路徑。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/context/sync.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/layout/sidebar-items.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/prompt-input.tsx`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx`
- `/home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
- `/home/pkcs12/projects/opencode/packages/opencode/src/server/routes/session.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/server/routes/file.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/project/workspace/owned-diff.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/file/index.ts`
- `/home/pkcs12/projects/opencode/docs/events/event_20260309_ui_file_changes_git_uncommitted_contract.md`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`（若 contract/boundary 需更新）

### OUT

- 不在本輪保留以 session ownership 為主的 UI dirty bubble semantics
- 不在未確認前直接刪除 `session.diff` 的 message-level summary diff 用途
- 不在未盤點完所有 surface 前直接修改 SDK schema

## 任務清單

- [x] 盤點 webapp / TUI 目前所有 `session.diff` UI 使用點
- [x] 釐清 backend `session.diff` 與 `File.status()` 的實際語意
- [x] 定義 UI end-state contract：session workspace git uncommitted files
- [x] 決定先重用 `file.status` 作為 current-workspace truth
- [x] 實作 TUI / webapp 資料源切換
- [ ] 驗證並更新 Architecture Sync

## Debug Checkpoints

### Baseline

- 目前 webapp 與 TUI 的 `Changes` / `檔案異動` 均直接消費 `session.diff`：
  - webapp：`packages/app/src/context/sync.tsx`, `packages/app/src/pages/session.tsx`, `packages/app/src/pages/layout/sidebar-items.tsx`, `packages/app/src/components/prompt-input.tsx`
  - TUI：`packages/opencode/src/cli/cmd/tui/context/sync.tsx`, `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
- backend `GET /session/:sessionID/diff` 在 `messageID` 缺省時，回傳的是 `getSessionOwnedDirtyDiff(...)`，其描述明確為 `session-owned dirty diff`。
- `getSessionOwnedDirtyDiff(...)` 並非純歷史累積；它會先讀 `File.status()` 取得當前 dirty files，再和：
  - session touched files
  - latest summary diff
    做交集。
- 但這個 contract 仍然是「current dirty ∩ session ownership」，不是「all current git uncommitted files in current session workspace」。
- 使用者明確要求：AI coding workflow 下，UI 應聚焦「現在還沒 commit 的檔案」，而不是 session ownership / attribution 視角。

### Execution

- 已確認 `File.status()` 實作基於 git working tree：
  - `git diff --numstat HEAD`
  - `git ls-files --others --exclude-standard`
  - `git diff --name-only --diff-filter=D HEAD`
- 已確認目前 UI 並**沒有**在前端拿 `session.diff` 後再做第二次 git diff 過濾；真正的過濾都在 backend `session.diff` 內完成。
- 因此若要符合新的產品 contract，應調整 UI 主資料源本身，而不是只改 sidebar 呈現文案。
- 本輪設計決策：
  - `session.diff` 保留給 attribution / message-level review 語意
  - UI operator-facing `Changes` / `檔案異動` 改以 `file.status` 作為 canonical source
  - app child-store 新增 `changes` cache（directory-scoped current git uncommitted files）
  - TUI sync store 新增 `changes` cache，sidebar 直接改吃 current workspace git 狀態
- 已完成的實作調整：
  - `packages/app/src/context/sync.tsx`
    - `sync.session.diff(sessionID)`（無 `messageID`）改為抓 `client.file.status()` 並寫入 `changes`
    - `sync.session.diff(sessionID, { messageID })` 保留既有 `session.diff` summary/attribution 路徑
  - `packages/app/src/pages/session.tsx`
    - review/dirty bubble/file tree 改讀 directory-scoped `changes`
    - current-change kind 判斷改直接使用 git status (`added|deleted|modified`)
    - 由於 `changes` 代表 current git working tree truth，不能像 session-owned attribution 一樣長時間視為 immutable cache；因此 session page 進入與開啟 Changes/Review surface 時改採 `force: true` refresh，避免 webapp 持有過期的舊計數
  - `packages/app/src/pages/layout/sidebar-items.tsx`
    - session row dirty bubble 改從對應 directory child-store 的 `file.status()` 結果計數
  - `packages/app/src/components/prompt-input.tsx`
    - comment 是否屬於 review 來源改看 current `changes`
  - `packages/opencode/src/cli/cmd/tui/context/sync.tsx`
    - session sync 不再為 sidebar hydrate `session.diff`; 改抓 `file.status()` 存入 `changes`
  - `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`
    - `Changes` 清單改顯示 current workspace git uncommitted files

### Validation

- 驗證指令：
  - `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）
  - `bun run --cwd /home/pkcs12/projects/opencode/packages/opencode typecheck`
- 結果：passed
- Architecture Sync: Updated
  - 依據：UI `Changes` canonical source 從 `session.diff` 轉為 `file.status`，而 `session.diff` 降回 attribution/history 邊界，屬於 architecture contract 變更，已同步更新 `docs/ARCHITECTURE.md`。
