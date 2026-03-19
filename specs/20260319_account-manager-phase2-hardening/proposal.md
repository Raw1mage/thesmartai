# Proposal

## Why

Phase 1 完成了 AccountManager service layer 與 terminology migration（family → providerKey），建立了統一 mutation 入口與 storage schema 遷移。Code review 揭露了數個既有風險點，加上原 plan 中延後的功能項目，需要第二階段收尾。

風險分為三類：
1. **資料完整性風險** — read-path 回傳 live reference、Account.remove() 靜默成功
2. **ID 可讀性缺口** — accountId 仍使用系統生成的長格式
3. **營運風險** — 無 deploy verification gate、architecture.md 未同步

Event bus consumer（Phase H）延後到 core daemon 重構。原因：TUI 和 webapp 可能在不同 process 執行，bus event 無法跨 process 傳遞。根本解法需要拆成 core daemon + frontend attach 架構，規模遠超本次 hardening。

## Original Requirement Wording (Baseline)

- Phase 1 tasks.md 中標記 `[~]` 的延後項目（F.1-F.5, 0.9-0.11）
- Code review 發現的 3 項既有風險（read-path leakage, remove() silent success, active account implicit fallback）
- Cross-cutting: X.1 architecture.md sync, X.3 regression verification

## Requirement Revision History

- 2026-03-19: 初版，基於 Phase 1 review 結果
- 2026-03-19: Phase H（event bus consumer）延後到 daemon 重構；event payload 完整化同步延後

## Effective Requirement Description

1. Account read-path functions（list, listAll, get, getById, getActiveInfo）必須回傳 structuredClone，防止 caller 汙染 in-memory cache
2. Account.remove() 必須在目標不存在時 throw AccountRemoveError，與 AccountManager 契約對齊
3. 刪除 active account 後 activeAccount = undefined，不自動 fallback
4. accountId 生成改為 normalizeAccountName(name)，衝突時自動加 suffix `-2`, `-3`
5. 既有帳號 migration 在 load() 時自動執行，migration 前強制備份 + 完整性檢查
6. webctl.sh 新增 SHA256 deploy verification gate（dist/ vs OPENCODE_FRONTEND_PATH）
7. architecture.md 必須反映 AccountManager service layer 與 storage migration
8. 變數命名清理（familiesWithAccounts → accountsByProviderKey）

## Scope

### IN

- Account module read-path defensive cloning（5 functions, 55+ callers）
- Account.remove() fail-fast（AccountRemoveError）+ active removal = undefined
- accountId generation reform + load() 時自動 migration + 備份 + 完整性檢查
- webctl.sh verify_deploy() gate（dist/ vs OPENCODE_FRONTEND_PATH SHA256）
- architecture.md 全貌同步
- Variable naming cleanup

### OUT

- Event bus consumer wiring（TUI/SSE）— 延後到 daemon 重構
- Event payload 完整化 — 延後到 daemon 重構
- parseProvider() / parseAccountType() 移除 — 仍為有效 utility
- Web frontend 帳號管理 UI 改版 — R14 UX 不變限制仍生效
- SDK regeneration — 等 route 穩定後處理
- Core daemon 架構拆分 — 獨立 plan

## Non-Goals

- 不改變前臺使用者操作流程（R14）
- 不改變 API response 結構（已在 Phase 1 完成）
- 不處理跨 process event 傳遞（daemon 重構範疇）

## Constraints

- R14 UX 不變限制仍生效
- 禁止新增 fallback mechanism（天條）
- 從 account-manager-refactor 分出新 branch（account-manager-phase2）實作
- accountId migration 必須有 rollback 機制（.pre-migration 備份 + 完整性檢查）

## What Changes

- Account module 的 5 個 read-path function 從回傳 live reference 改為回傳 structuredClone
- Account.remove() 從靜默成功改為 throw AccountRemoveError
- 刪除 active account 後 activeAccount = undefined（不再自動 fallback 到 remaining[0]）
- 新建帳號 accountId = normalizeAccountName(使用者輸入名稱)
- 既有帳號 accountId 在 load() 時自動遷移（長 ID → 短 ID）
- webctl.sh 新增 verify_deploy() 函式

## Capabilities

### New Capabilities

- **Deploy verification gate**: webctl.sh dev-refresh 完成後自動 SHA256 hash 比對
- **Human-readable accountId**: 帳號 ID 即帳號名稱（normalized）
- **Migration safety**: 遷移前自動備份 + 完整性檢查

### Modified Capabilities

- **Account read API**: 回傳值從 mutable reference 改為 immutable clone（caller 語義不變）
- **Account.remove()**: 對不存在帳號從靜默成功改為 throw AccountRemoveError
- **Active account removal**: 從自動 fallback 改為 activeAccount = undefined

## Impact

- 55+ callers of Account.list/listAll/get/getById/getActiveInfo — 行為不變但取得 clone 而非 reference
- Account.remove() callers — 需確認 error handling 覆蓋
- accounts.json — accountId migration（長 ID → 短 ID）+ .pre-migration 備份
- webctl.sh — 新增 verify_deploy() 函式
- specs/architecture.md — 全面同步
