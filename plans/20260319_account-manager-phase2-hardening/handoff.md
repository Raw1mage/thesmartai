# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md
- Phase 1 event log: docs/events/event_20260319_account_manager_unified_refactor.md

## Current State

- Phase 1 完成：9 commits on `account-manager-refactor` branch（AccountManager service layer + terminology migration）
- Phase 2 plan 已建立，尚未開始實作
- Branch: 需從 `account-manager-refactor` 分出 `account-manager-phase2`

## Stop Gates In Force

- **SG-1**: Phase I 開始前確認 accounts.json 中 name 欄位覆蓋率
- **SG-2**: Phase J 修改 webctl.sh 前確認 dev-refresh 正常
- **SG-3**: Account.remove() 改 throw 前確認所有 direct callers 有 error handling

## Build Entry Recommendation

**建議起點：Phase G（Read-Path Hardening）**

Phase G 是獨立、低風險的防禦性改進，不依賴其他 Phase。完成後可立即驗證。

執行順序：G → I → J → X

Phase I 有 stop gate（SG-1），建議在 G 完成後先做 SG-1 檢查再進入 I。

## Key Technical Notes

1. **structuredClone 位置**：在 Account module 的 5 個 export function 內部 clone，不是在 caller 端
2. **AccountRemoveError vs AccountNotFoundError**：兩個不同 error class，分屬不同層（storage vs service）
3. **normalizeAccountName 規則**：trim → toLowerCase → 非 alphanumeric 替換為 hyphen → dedup hyphens → strip leading/trailing hyphens → truncate 64 → fallback 'default'
4. **Migration 冪等性**：透過比較 normalizeAccountName(name) === currentId 判斷是否需要 migrate
5. **Migration 備份**：accounts.json.pre-migration 只在有實際 rename 時建立（冪等 → 不建立）

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned（proposal, spec, design, tasks, handoff）
- [x] Validation plan is explicit（per-phase validation items in tasks.md）
- [x] Runtime todo seed is present in tasks.md
- [x] Stop gates identified and documented
- [x] Branch strategy confirmed（新 branch from account-manager-refactor）
- [ ] SG-1: accounts.json name 欄位覆蓋率已確認
- [ ] SG-2: dev-refresh 正常運作已確認
- [ ] SG-3: Account.remove() callers error handling 已確認
