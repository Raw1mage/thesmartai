## Requirements

- 延續 provider-key migration checkpoint 後的 D1 非破壞性階段。
- 將 README 與 `docs/ARCHITECTURE.md` 的公開敘述進一步收斂為 `providerKey/providers` 為主語言。
- 保留 legacy `family/families` 作為相容語彙，不移除任何 legacy route / field / storage surface。

## Scope

### In

- `README.md` provider-first wording sync
- `docs/ARCHITECTURE.md` canonical naming note
- event ledger / validation / architecture sync record

### Out

- OpenAPI/SDK generation
- 移除 `family/families` 欄位或 `:family` 路由
- storage schema migration
- 任何 runtime behavior change

## Task List

- [x] 讀取 architecture 與 provider-key roadmap，確認目前 D1 仍屬 non-breaking 文件階段
- [x] 檢查未提交的 `README.md` / `docs/ARCHITECTURE.md` 變更是否只涉及措辭同步
- [x] 保留 provider-key-first wording，避免擴張為 breaking surface change
- [x] 新增 event 記錄本次 deprecation notice docs slice
- [x] 完成最小驗證與 architecture sync 記錄

## Baseline

- `docs/events/event_20260313_providerkey_deprecation_execution_roadmap.md` 已將 D1 定義為「先宣告、不移除」的 non-breaking 階段。
- 目前 worktree 中已有未提交的 `README.md` 與 `docs/ARCHITECTURE.md` 變更，內容看起來屬於 provider-first wording sync。
- 本次任務必須避免誤入 D3/D4 類 breaking-risk 工作；只允許 docs wording / notice 收斂。

## Execution

- 重新讀取 `docs/ARCHITECTURE.md`、`event_20260312_session_global_fallback_rca.md`、`event_20260313_providerkey_deprecation_execution_roadmap.md` 與當前 `README.md`。
- 以 `git diff -- README.md docs/ARCHITECTURE.md` 檢查未提交差異，確認本次變更僅包含：
  - README 將 `family` / `provider family` 等敘述改為 `canonical provider key`
  - README 補充 legacy `family` 僅為 compatibility wording
  - Architecture 補入 canonical naming note：`providerKey/providers` canonical、`family/families` compatibility-only
- 確認目前 diff 不涉及 route/path/schema/runtime behavior 變更，因此可作為 D1 文件宣告切片處理。

## Decisions

1. 本次只收斂文件語言，不進行任何 legacy surface removal。
2. `providerKey/providers` 應成為對外文件中的主語言；`family/families` 只保留在 compatibility/deprecated 說明脈絡。
3. `docs/ARCHITECTURE.md` 採短 canonical naming note 即可，避免把 event 式遷移歷史塞回 architecture state doc。

## Validation

- `git diff -- README.md docs/ARCHITECTURE.md` ✅
  - 確認僅為非破壞性 wording changes，沒有 API/runtime/storage 變更。
- `git status --short -- README.md docs/ARCHITECTURE.md docs/events` ✅
  - 確認本 slice 目前只涉及既有兩份 docs 變更與新增 event ledger；其餘 docs/events 髒檔為既有 unrelated worktree noise。
- Architecture Sync: Verified
  - `docs/ARCHITECTURE.md` 已新增 canonical naming note，與目前 provider-key compatibility baseline 一致。

## Next

- 若要繼續 D1，可再逐步把其他對外 docs/examples 改為 provider-key-first wording。
- 任何觸及 legacy field/path removal、SDK alias removal、storage migration 的工作都必須停在 Phase D approval gate 前等待明確批准。
