# Implementation Spec

## Goal

基於 Phase 1 的 AccountManager service layer 與 terminology migration，完成資料完整性強化、accountId 人類可讀化、deploy verification gate 與 architecture.md 同步。

## Scope

### IN

- Slice G: Read-path hardening（defensive cloning + remove fail-fast + naming cleanup）
- Slice I: accountId generation reform（新 ID 格式 + load() 時自動 migration + 備份 + 完整性檢查）
- Slice J: Deploy verification gate（webctl.sh）
- Cross-cutting: architecture.md sync + runtime regression

### OUT

- Slice H: Event bus consumer（延後到 daemon 重構）
- Event payload 完整化（延後到 daemon 重構）
- parseProvider() 移除
- Web UI 改版
- SDK regeneration

## Assumptions

- Phase 1 的 9 commits 在 account-manager-refactor branch 上可用作基礎
- structuredClone() 在 Bun runtime 中完整支援（Bun 1.x+）
- Account.Info 型別不含 function/symbol/Date 等 structuredClone 無法處理的型別
- accounts.json 中既有帳號的 name 欄位已填充（migration 需 fallback for empty name）
- webctl.sh 中 OPENCODE_FRONTEND_PATH 環境變數已定義且指向正確路徑

## Stop Gates

- **SG-1**: Slice I 開始前，必須確認 accounts.json 中既有帳號的 name 欄位覆蓋率（若大量帳號無 name → migration 規則需調整）
- **SG-2**: Slice J 修改 webctl.sh 前，須確認當前 dev-refresh 流程正常運作
- **SG-3**: Account.remove() 改 throw 前，須確認所有 6 個 direct callers 已有 error handling

## Critical Files

- `packages/opencode/src/account/index.ts` — read-path cloning + remove throw + accountId migration
- `packages/opencode/src/account/manager.ts` — accountId generation + AccountRemoveError
- `packages/opencode/src/auth/index.ts` — accountId generation alignment
- `packages/opencode/src/server/routes/provider.ts` — variable naming cleanup
- `webctl.sh` — deploy verification gate
- `specs/architecture.md` — sync

## Structured Execution Phases

### Phase G — Read-Path Hardening（低風險，可獨立）

G.1 在 Account module 的 5 個 read-path function 加入 structuredClone before return
G.2 新增 AccountRemoveError class（export from account/manager.ts）
G.3 Account.remove() 改為目標不存在時 throw AccountRemoveError
G.4 Account.remove() 刪除 active account 後 activeAccount = undefined（移除 remaining[0] fallback）
G.5 provider.ts 中 `familiesWithAccounts` → `accountsByProviderKey`，comment 更新
G.6 驗證：tsc 通過 + callers 行為不變 + remove throw 確認

### Phase I — accountId Generation Reform（中風險，需 migration safety）

I.1 定義 normalizeAccountName(name) 函式
I.2 AccountManager.connectApiKey / connectOAuth：新帳號 accountId = normalizeAccountName(name)
I.3 同 provider 下 accountId 唯一性檢查（衝突 → 自動加 suffix `-2`, `-3`）
I.4 load() 中新增 accountId normalization migration：
  - 遷移前備份 accounts.json → accounts.json.pre-migration
  - 掃描所有帳號，長 ID → normalizeAccountName(existingName)
  - Collision handling：suffix `-2`, `-3`
  - activeAccount pointer 同步更新
  - 完整性檢查：帳號數量不變、所有 activeAccount 指標有效
  - 遷移成功後 save() + log
I.5 驗證：新建帳號 ID === normalizeAccountName(name)、migration 前後帳號數量一致

### Phase J — Deploy Verification Gate（低風險，獨立 infra）

J.1 webctl.sh 新增 verify_deploy() 函式：
  - 計算 packages/app/dist/ 的 SHA256 hash
  - 計算 OPENCODE_FRONTEND_PATH 的 SHA256 hash
  - 比對兩者，不一致則輸出 detail 並 exit 1
J.2 dev-refresh 流程結尾呼叫 verify_deploy()
J.3 驗證：hash match → 靜默通過、hash mismatch → 中止並輸出 detail

### Phase X — Cross-Cutting

X.1 specs/architecture.md 全貌同步：AccountManager service layer、write-ahead pattern、storage migration、canonical-provider-source 重命名
X.2 Runtime regression：TUI admin panel 操作流程確認、webapp model manager 確認
X.3 更新 docs/events/ event log

## Validation

- tsc --noEmit EXIT 0（每個 Phase 完成後）
- Account.list() 回傳值被 caller 修改後 cache 不變（手動確認）
- Account.remove() 對不存在帳號 throw AccountRemoveError（手動確認）
- 刪除 active account 後 activeAccount === undefined（手動確認）
- 新建帳號 accountId === normalizeAccountName(name)（手動確認）
- accounts.json.pre-migration 備份存在且內容正確
- migration 前後帳號數量一致
- webctl.sh verify_deploy() 在 hash mismatch 時 exit 1
- architecture.md 與 codebase 交叉比對

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
- Phase G 可獨立先行，無外部依賴。
- Phase I 開始前必須通過 SG-1 stop gate（name 欄位覆蓋率檢查）。
- 實作在 opencode-beta repo，從 account-manager-refactor 分出新 branch account-manager-phase2。
