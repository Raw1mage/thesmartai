# Event: Refresh submodules from remotes

Date: 2026-03-20
Status: Completed

## Requirement

將 submodules 各自從遠端拉到最新狀態，並提交主 repo 的 submodule pointer 更新。

## Scope

### In
- 執行 submodule remote update
- 提交成功更新的 submodule pointers
- 記錄失敗的 submodule 與原因

### Out
- 不修改 submodule 內部程式碼
- 不修復外部遠端倉庫配置問題

## Task Checklist

- [x] 檢查主 repo 與 submodule 狀態
- [x] 執行 `git submodule update --init --recursive --remote`
- [x] 確認成功更新與失敗項目
- [x] 提交成功更新的 submodule pointers

## Debug Checkpoints

### Baseline
- 使用者要求 submodules 各自 pull 最新遠端狀態，而非只對齊主 repo 已記錄 commit。

### Instrumentation Plan
- 執行 remote update
- 讀取 submodule status 與遠端設定
- 分辨哪些 submodule 成功更新、哪些因遠端配置失敗

### Execution
- 成功更新：`refs/claude-code`, `refs/codex`, `refs/openclaw`, `refs/opencode-antigravity-auth`, `refs/vscode-antigravity-cockpit`
- 初次未更新：`templates/skills`
- 初次失敗原因：其 `origin` remote 指向 `http://gitlab.wuyang.co/miat/skills.git/`，遠端不存在；雖然 `github` remote 可用，但 `git submodule update --remote` 本次命中的是失效來源。
- 後續處置：將 `templates/skills` 的主要來源改為本機 `/home/pkcs12/projects/skills`，並把最新 skill 變更正式集中到該 repo 的 `master` 後，再將 submodule 對齊到 `e15ae8b`。

### Root Cause
- 根因在於 `templates/skills` submodule 的既有 remote 配置存在失效來源，導致自動 remote refresh 無法完整成功。
- 補救方式是把技能更新的單一主要來源收斂到 `/home/pkcs12/projects/skills`，再讓 `opencode` 的 `templates/skills` submodule 直接追蹤該來源。

### Validation
- 主 repo 已產生 5 個外部 submodule pointer 更新。
- `.gitmodules` 已更新：`templates/skills` 改以 `/home/pkcs12/projects/skills` 為主要來源。
- `templates/skills` 已對齊到 `/home/pkcs12/projects/skills` 的 `master`，目前指向 `e15ae8b`。
- Architecture Sync: Verified (No doc changes)；依據：本次僅更新 submodule pointers、來源設定與事件紀錄，不變更 repo 模組邊界。
