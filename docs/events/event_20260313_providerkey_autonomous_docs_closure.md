## Requirements

- 依使用者要求改用 autonomous runner 模式，一次完成所有仍可安全自動推進的 provider-key D1 文件收尾工作。
- 範圍限定為 non-breaking docs wording cleanup；不得進入 commit gate 或任何 breaking-risk / Phase D removal 工作。

## Scope

### In

- `README.md` 高層 provider wording 收斂
- `docs/ARCHITECTURE.md` 高層 provider-key-first wording 收斂
- event ledger / validation / architecture sync record

### Out

- 所有 event 歷史檔的大規模 wording 回寫
- OpenAPI / SDK / route metadata / generated artifact 變更
- runtime behavior / code / tests 變更
- commit / push / breaking change execution

## Task List

- [x] 建立可全自動執行的 todo skeleton
- [x] 搜尋剩餘 public docs / architecture wording 熱點
- [x] 一次收斂所有明顯安全的高層 provider-key wording
- [x] 補 event / validation / architecture sync
- [x] 收斂到 approval gate 前並回報剩餘工作

## Baseline

- 既有未提交 docs 切片已包含：
  - `event_20260313_providerkey_deprecation_notice_docs.md`
  - `event_20260313_providerkey_architecture_wording_followup.md`
- 仍殘留少量高層 public docs wording，例如：
  - README 的 `provider family` 語句
  - architecture 中 OpenAI quota gate / provider set / account inventory 等高層說明

## Execution

- 使用靜態搜尋定位 public docs / specs 熱點，刻意排除 event 歷史檔與 legacy contract surface，避免把歷史 RCA 記錄改寫成失真版本。
- 精讀 `README.md` 與 `docs/ARCHITECTURE.md` 相關片段後，一次改寫以下高層措辭：
  - `provider family` → `provider identity` / `provider key`（視語意）
  - `effective provider family = openai` → `effective provider key = openai`
  - `account families` → `provider-keyed account inventory`
  - `provider family set` → `provider set`
  - variant utility 表格輸入說明改為 `provider key`
- 明確保留所有仍在描述以下內容的 `family` 字樣：
  - legacy `:family` route shape
  - `family/families` compatibility fields/storage
  - model-family 作為 catalog grouping 的正式概念

## Decisions

1. 本輪 autonomous runner 僅收斂「高層敘述」；event 歷史與 RCA 內容不做大規模改寫，避免扭曲當時證據語境。
2. 若 `family` 指的是 model catalog grouping，保留不改。
3. 若 `family` 指的是現存 legacy contract surface，保留並明示 compatibility 性質。
4. 若 `family` 只是高層語言描述 provider/account binding，改為 provider-key-first wording。

## Validation

- `git diff -- README.md docs/ARCHITECTURE.md` ✅
  - 僅為 docs wording changes，沒有 code/runtime/API artifact 變更。
- `git status --short -- README.md docs/ARCHITECTURE.md docs/events/event_20260313_providerkey_deprecation_notice_docs.md docs/events/event_20260313_providerkey_architecture_wording_followup.md docs/events/event_20260313_providerkey_autonomous_docs_closure.md` ✅
  - 本輪 autonomous docs 工作僅累積在上述文件；其餘 worktree noise 不納入本切片。
- Architecture Sync: Verified
  - `docs/ARCHITECTURE.md` 已完成目前可安全自動推進的高層 provider-key wording 收斂；剩餘 `family` 多屬 model-family 或 legacy compatibility surface，應保留。

## Remaining Work

- 可自動收尾部分已大致完成；若再往下，主要是更零碎的 docs/examples wording 巡檢。
- 真正未完成的大頭仍在 Phase D gate 之後：legacy field/path removal、storage migration、SDK alias removal、telemetry observation、migration guide / versioned deprecation policy。

## Next

- 停在 approval gate 前，等待使用者決定是否要：
  1. 先提交這一批 docs-only slices，或
  2. 繼續做更零碎的 docs/examples 巡檢，或
  3. 轉向需要明確批准的 Phase D 規劃/決策工作。
