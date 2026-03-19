# Design

## Context

Phase 1 建立了 AccountManager service layer 與 terminology migration。Code review 揭露：
- Read-path 回傳 live reference（5 functions, 55+ callers）
- Account.remove() 靜默成功
- 刪除 active account 自動 fallback 到 remaining[0]
- accountId 仍使用系統生成的長格式

Event bus consumer 延後到 daemon 重構（TUI/webapp 可能不同 process，需 core daemon 架構）。

## Goals / Non-Goals

**Goals:**

- 消除 read-path 資料汙染風險
- Account.remove() 與 AccountManager 錯誤契約對齊
- accountId 人類可讀化 + 安全 migration
- 建立 deploy verification gate

**Non-Goals:**

- 不改變 API response 結構
- 不改變前臺 UX 流程（R14）
- 不處理跨 process event 傳遞（daemon 重構範疇）
- 不移除 parseProvider()

## Decisions

### DD-1: Deep Clone 策略 — structuredClone()

採用 `structuredClone()` 而非 `JSON.parse(JSON.stringify())`。

理由：
- Runtime native API，語義更清晰
- Bun 1.x+ 完整支援
- Account.Info 不含 function/symbol，兩者結果等價
- 效能更好（不經 JSON serialization）

### DD-2: Clone 位置 — module boundary

在 Account.list / listAll / get / getById / getActiveInfo 內部 clone，不要求 55+ callers 各自 clone。

理由：單一修改點 vs 55+ 修改點。Account data 量小（通常 < 20），clone 開銷可忽略。

### DD-3: Account.remove() — AccountRemoveError

Account.remove() 在目標不存在時 throw 專屬 AccountRemoveError（不是通用 Error，也不是 AccountNotFoundError）。

理由：
- AccountNotFoundError 屬於 AccountManager 層
- Account.remove() 屬於 storage 層，用不同 error class 區分層次
- Route handler 可 catch 兩種 error 做不同處理

### DD-4: Active account removal — undefined，不 fallback

刪除 active account 後設 activeAccount = undefined。

理由：
- 天條：禁止新增 fallback mechanism
- 讓 caller（AccountManager / UI）決定是否 re-activate
- UI 須能處理 "no active account" 狀態

### DD-5: accountId 正規化規則

```
normalizeAccountName(name: string): string
  1. trim()
  2. toLowerCase()
  3. replace /[^a-z0-9-_]/g → '-'
  4. replace /-{2,}/g → '-'
  5. replace /^-|-$/g → ''
  6. truncate to 64 chars
  7. if empty → 'default'
```

### DD-6: accountId 衝突 — suffix `-2`, `-3`

同 provider 下重複 accountId 自動加 suffix。

理由：UX 友善（使用者可能不知道已有同名帳號）。suffix 是明確的（`-2`），不是靜默覆蓋。

### DD-7: Migration 策略 — load() 時自動 + 強制備份

既有帳號 migration 在 load() 時執行（與 families→providers 遷移同模式）。

備份與安全策略：
1. 遷移前複製 accounts.json → accounts.json.pre-migration
2. 執行 normalization（長 ID → normalizeAccountName(name)）
3. 處理 collision（suffix）
4. 更新 activeAccount pointer
5. 完整性檢查：帳號數量不變、activeAccount 指向有效帳號或 undefined
6. 檢查通過 → save() + log；檢查失敗 → 從備份還原 + error log

冪等性：若所有 ID 已是 normalized 格式 → 不觸發 migration。

### DD-8: Deploy gate — dist/ vs OPENCODE_FRONTEND_PATH SHA256

在 webctl.sh 新增 verify_deploy()：
- `find dist/ -type f | sort | xargs sha256sum | sha256sum` → expected hash
- 對 OPENCODE_FRONTEND_PATH 同樣操作 → actual hash
- 比對兩者

## Data / State / Control Flow

### Read-Path Clone Flow

```
Caller → Account.list(provider)
         → state() → providersOf(storage)[provider].accounts
         → structuredClone(accounts)  ← NEW
         → return clone
```

### accountId Migration Flow

```
load()
  → families → providers migration (existing, Phase 1)
  → anthropic → claude-cli migration (existing)
  → accountId normalization (NEW)
    → backup accounts.json → accounts.json.pre-migration
    → for each provider:
      → for each account:
        → newId = normalizeAccountName(account.name)
        → if newId !== accountId:
          → resolve collision (suffix -2, -3)
          → move account to newId
          → update activeAccount if needed
    → integrity check (count + activeAccount validity)
    → save()
```

### Deploy Verification Flow

```
dev-refresh
  → build frontend
  → deploy to OPENCODE_FRONTEND_PATH
  → verify_deploy()
    → hash(dist/) → expected
    → hash(OPENCODE_FRONTEND_PATH) → actual
    → compare
    → match: pass (exit 0)
    → mismatch: print detail, exit 1
```

## Risks / Trade-offs

- **Clone 效能** → Account data 量小（< 20 accounts），clone 開銷可忽略。若未來帳號大幅增加可改為 Object.freeze() + Proxy
- **accountId migration collision** → suffix 策略處理，但需 log 清楚記錄每個 rename（含舊 ID → 新 ID mapping）
- **Active account = undefined after removal** → UI 必須能處理 "no active account" 狀態。TUI admin panel 已有此路徑（顯示無 active badge）。webapp model selector 需確認
- **Account.remove() 改 throw** → 6 個 direct callers 中，AccountManager.removeAccount 已有前置 get() 檢查不會觸發；其餘 callers 需逐一確認 error handling
- **Migration backup 磁碟空間** → accounts.json 通常 < 10KB，可忽略
- **structuredClone 相容性** → Bun 1.x+ 完整支援，非風險

## Critical Files

- `packages/opencode/src/account/index.ts` — clone + remove throw + migration
- `packages/opencode/src/account/manager.ts` — accountId generation + AccountRemoveError
- `packages/opencode/src/auth/index.ts` — accountId generation alignment
- `packages/opencode/src/server/routes/provider.ts` — naming cleanup
- `webctl.sh` — deploy gate
- `specs/architecture.md` — sync
