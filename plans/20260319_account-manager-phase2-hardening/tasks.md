# Tasks — Account Manager Phase 2 Hardening

## Phase G — Read-Path Hardening

- [ ] G.1 Account.list()：return structuredClone(accounts)
- [ ] G.2 Account.listAll()：return structuredClone(providersOf(storage))
- [ ] G.3 Account.get()：return structuredClone(account) if found
- [ ] G.4 Account.getById()：return { provider, info: structuredClone(info) }
- [ ] G.5 Account.getActiveInfo()：return structuredClone(info) if found
- [ ] G.6 新增 AccountRemoveError class（export from account/manager.ts）
- [ ] G.7 Account.remove()：目標不存在時 throw AccountRemoveError（取代靜默 return）
- [ ] G.8 Account.remove()：刪除 active account 後 activeAccount = undefined（移除 remaining[0] fallback）
- [ ] G.9 確認所有 Account.remove() 的 6 個 direct callers 已有 error handling
- [ ] G.10 provider.ts 中 `familiesWithAccounts` → `accountsByProviderKey`，comment 更新
- [ ] G.11 驗證：tsc --noEmit EXIT 0
- [ ] G.12 驗證：clone 行為手動確認（修改回傳值不影響 cache）
- [ ] G.13 驗證：Account.remove() 對不存在帳號 throw AccountRemoveError

## Phase I — accountId Generation Reform

- [ ] I.1 定義 normalizeAccountName(name: string): string 函式（在 account/index.ts 或 account/manager.ts）
- [ ] I.2 AccountManager.connectApiKey：accountId = normalizeAccountName(name) + 唯一性檢查
- [ ] I.3 AccountManager.connectOAuth：Auth.set 回傳 accountId → 確認 Auth.set 內部使用 normalizeAccountName
- [ ] I.4 Auth.set 中 accountId 生成改用 normalizeAccountName
- [ ] I.5 同 provider 下 accountId 唯一性邏輯：衝突 → suffix `-2`, `-3`
- [ ] I.6 load() 新增 accountId normalization migration：
  - [ ] I.6a 遷移前備份 accounts.json → accounts.json.pre-migration
  - [ ] I.6b 掃描所有帳號，計算 normalizeAccountName(existingName)
  - [ ] I.6c 若 newId !== oldId → rename account + update activeAccount
  - [ ] I.6d Collision handling（suffix）
  - [ ] I.6e 完整性檢查：帳號數量不變、activeAccount 指標有效
  - [ ] I.6f 冪等性：已 normalized 的 ID 不觸發 migration
- [ ] I.7 驗證：新建帳號 accountId === normalizeAccountName(name)
- [ ] I.8 驗證：衝突時自動加 suffix（-2, -3）
- [ ] I.9 驗證：migration 前 .pre-migration 備份存在
- [ ] I.10 驗證：migration 後帳號數量不變

## Phase J — Deploy Verification Gate

- [ ] J.1 webctl.sh 新增 verify_deploy() 函式
  - [ ] J.1a 計算 packages/app/dist/ 的 SHA256 hash
  - [ ] J.1b 計算 OPENCODE_FRONTEND_PATH 的 SHA256 hash
  - [ ] J.1c 比對兩者，不一致則輸出 detail 並 exit 1
- [ ] J.2 dev-refresh 流程結尾呼叫 verify_deploy()
- [ ] J.3 驗證：hash match → 靜默通過
- [ ] J.4 驗證：hash mismatch → exit 1 + detail output

## Phase X — Cross-Cutting

- [ ] X.1 specs/architecture.md 全貌同步：AccountManager service layer、write-ahead pattern、storage migration、canonical-provider-source
- [ ] X.2 Runtime regression：TUI admin panel 操作流程確認
- [ ] X.3 Runtime regression：webapp model manager 確認
- [ ] X.4 更新 docs/events/ event log
- [ ] X.5 更新 Phase 1 tasks.md 中 F.19 驗證狀態

## Deferred (Daemon Refactor)

- [ ] H.1 Core daemon 架構設計（獨立 plan）
- [ ] H.2 Bus event 跨 process 傳遞機制
- [ ] H.3 Event payload 完整化（排除 secrets）
- [ ] H.4 TUI consumer 接線
- [ ] H.5 SSE endpoint account event channel
- [ ] H.6 端到端驗證：mutation → event → TUI/webapp re-render
