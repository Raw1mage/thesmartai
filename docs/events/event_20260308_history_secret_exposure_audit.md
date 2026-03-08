# Event: history secret exposure audit

Date: 2026-03-08
Status: Done

## 需求

- 確認 git history 中是否曾提交過含 secrets 的 `accounts.json` / `opencode.json` / 相關 runtime auth 檔。
- 在不修改 history 的前提下，先界定重寫範圍與風險。
- 在使用者明確同意後執行 history rewrite，避免 secrets 繼續在 commit history 中暴露。

## 範圍

### IN

- 全 repo git history（只讀稽核）
- `accounts.json`, `opencode.json`, `mcp-auth.json`, `*-accounts.json` 等敏感路徑
- 對應 event 與 remediation 建議

### OUT

- 本輪不 force-push

## 任務清單

- [x] 盤點敏感檔案在 history 中的出現範圍
- [x] 確認是否有 commit 以內容變更方式引入 secrets
- [x] 輸出後續 history rewrite 建議範圍
- [x] 依使用者要求執行 history rewrite 並驗證舊 secret commits 不再可達

## Debug Checkpoints

### Baseline

- 使用者已確認相關 keys/tokens 都已 revoked，但不希望 secrets 仍留在 git history 中暴露。
- 目前工作樹中的 legacy runtime data 已清理，但這不影響既有 history 暴露風險。

### Execution

- 針對敏感路徑做只讀 history 稽核（未修改任何 commit）：
  - `config/data/accounts.json` / `accounts.json`
  - `opencode.json` / `config/opencode/opencode.json` / `templates/opencode.json`
  - `mcp-auth.json` 相關路徑
- 發現 `accounts.json` 相關歷史 commit：
  - `a4de3f936682650ed367d013c0e13d3eed938cc7` (2026-02-09)
  - `2adc1b9b199a088946f0ee006490927fda371fd6` (2026-02-15)
  - `97329d3bfb10955ab734fcf285a264d6e490711a` (2026-02-23，停止追蹤 local runtime artifacts)
- 對歷史 blob 進行 pattern-count 稽核（不輸出 secret 值）：
  - `a4de3f...:config/data/accounts.json` 命中多組 `apiKey/accessToken/refreshToken` 欄位，且命中 Google API key、GitHub token、JWT 類 access token、OpenAI `sk-` 類字串。
  - `2adc1b...:config/data/accounts.json` 同樣命中多組 token/key pattern。
  - `97329d...` 為停止追蹤/移除節點，本身不是新增暴露來源。
- `opencode.json` 相關歷史檢查：
  - `574d494c3c53f858b19b5adda31718dbb997d1ec`
  - `71cd84dbbb59c3655ef9647e9cb1280eb16e73cb`
    這兩個 commit 的 `opencode.json` 命中 `sk-` 類字串與 token key field；需納入 rewrite 範圍。
- `mcp-auth.json` 路徑在本輪 history 掃描中未找到 pattern-level 命中結果。
- 結論：即使目前工作樹 secrets 已清理、keys 已 revoked，git history 仍有可直接還原 secrets 的 commit/blob，必須 rewrite 才能降低暴露面。
- 後續執行 rewrite：
  - 先前嘗試 `git filter-branch` 未能完全消除可達舊 commits，因此改採 `git-filter-repo`。
  - 以 path-level rewrite 移除下列歷史路徑：
    - `config/data/accounts.json`
    - `accounts.json`
    - `opencode.json`
    - `config/opencode/opencode.json`
    - `.opencode/opencode.json`
    - `mcp-auth.json`
    - `config/data/mcp-auth.json`
    - `config/opencode/mcp-auth.json`
    - `openai-codex-accounts.json`
    - `config/opencode/openai-codex-accounts.json`
  - `git-filter-repo` rewrite 完成後，stash 已被自動重寫並成功還原工作樹未提交變更。
  - `git-filter-repo` 依預設安全機制移除了 `origin` remote；其餘 remotes 保留。

### Validation

- `git log --all -- ...` 路徑稽核完成 ✅
- `git log -G 'apiKey|accessToken|refreshToken|secret|token' -- ...` 內容級變更稽核完成 ✅
- 以 `git show <commit>:<path>` + pattern-count 驗證敏感 blob 存在，但未在輸出中暴露 secret 值 ✅
- rewrite 後驗證：
  - `git rev-list --all | rg '<old secret commit hashes>'` 無結果 ✅
  - `git log --all -G 'apiKey|accessToken|refreshToken|secret|token' -- <removed runtime paths>` 無結果 ✅
  - 先前命中的舊 secret commit（如 `a4de3f...`, `2adc1b...`, `574d49...`, `71cd84...`）不再是可達 history ✅
- Remote 狀態：
  - `origin` 已被 `git-filter-repo` 自動移除（預設保護機制）
  - `gitlab`、`raw1mage` 仍存在 ✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅做 history 稽核與後續 remediation 規劃，未改動 runtime 架構。

## 建議的 rewrite 範圍

### 必須納入

- `config/data/accounts.json`
- `accounts.json`（若歷史早期存在 repo-root 版本）
- `opencode.json`（至少覆蓋已命中的歷史 commit 範圍）

### 建議一併納入

- `config/opencode/opencode.json`
- `templates/opencode.json`（若後續確認僅模板、無 secret，可保留）
- `mcp-auth.json`
- `config/data/mcp-auth.json`
- `config/opencode/mcp-auth.json`

### 實際採用策略

- 已採用 `git-filter-repo` 進行路徑級 rewrite。
- 對 local runtime/auth 類檔案採「整條歷史移除」而非內容替換，避免遺漏個別 secret 值。
- 接下來若要同步到 remote，需由使用者自行決定何時 force-push 重寫後的 refs。
