## Requirements

- 在既有 D1 deprecation notice docs slice 之後，繼續收斂 `docs/ARCHITECTURE.md` 中少數仍把 provider-scoped 概念寫成 family-first 的高層描述。
- 僅做 architecture wording sync，不改 route/path/schema/runtime behavior。

## Scope

### In

- `docs/ARCHITECTURE.md` 高層 provider-first wording follow-up
- event ledger / validation / architecture sync record

### Out

- README 以外的其他 public docs 大範圍改寫
- OpenAPI / SDK / generated artifacts
- legacy `:family` path 或 `family/families` contract removal
- 任何 code/runtime behavior change

## Task List

- [x] 搜尋 docs 中仍可安全收斂的 provider-vs-family 高層敘述熱點
- [x] 精讀 `docs/ARCHITECTURE.md` 相關段落，區分哪些是實際 legacy contract 說明、哪些只是可改的高層措辭
- [x] 將可安全改寫的高層描述改為 provider-key-first wording
- [x] 補 event 與 validation 記錄

## Baseline

- `docs/events/event_20260313_providerkey_deprecation_notice_docs.md` 已完成 README + canonical naming note 的第一個 D1 文件切片。
- `docs/ARCHITECTURE.md` 仍有少數高層描述使用 `runtime families` / `provider family`，但其中也混有不能隨意改掉的 legacy route/helper 說明。
- 本次切片只應改高層說明，不應誤改實際 compatibility contract 記錄。

## Execution

- 使用靜態搜尋掃描 docs/README 中的 `family` / `families` 熱點，確認大量 event 歷史紀錄與 legacy contract 說明不屬於本次可安全改寫範圍。
- 聚焦 `docs/ARCHITECTURE.md` 的下列高層段落：
  - cms branch feature summary 的 Provider Granularity 描述
  - TUI `/admin` provider operation pipeline 表格中的高層 stage wording
  - prompt footer quota gate 的 `provider family = openai` 描述
- 保留以下不可在本 slice 改掉的內容：
  - `/:family` legacy route shape 說明
  - `family/families` compatibility field/path/storage notes
  - model-family 作為 catalog grouping 的正式概念

## Changes

- `docs/ARCHITECTURE.md`
  - 將 cms branch feature summary 中的 `runtime families` 改為 `provider-keyed runtime entries`
  - 將 legacy alias 說明改為 `canonical runtime provider keys`
  - 將 admin pipeline 的 API-key / Google-account 高層描述改為 provider-scope wording，同時保留 `Account.add(family, ...)` 與 `/:family` 屬於 legacy compatibility naming 的事實
  - 將 OpenAI quota gate 的 `effective provider family = openai` 改為 `effective provider key = openai`

## Decisions

1. `model family` 仍是正式保留概念，因為它描述的是 model catalog grouping，不是單純舊名；本次不混淆這一層。
2. 只有在描述 account-binding / provider-scoped behavior 的高層句子時，才將 family-first wording 收斂為 provider-key-first。
3. 提到真實 legacy route/helper surface 的段落，必須保留 `family` 字樣並明示 compatibility 性質。

## Validation

- `git diff -- docs/ARCHITECTURE.md` ✅
  - 僅包含高層 wording sync，未變更任何 code/runtime/API artifact。
- Architecture Sync: Verified
  - 本次直接更新 architecture baseline 本身，讓高層描述更符合目前 provider-key canonical naming policy。

## Next

- 可繼續挑選其他 public docs/examples 中純高層、非 contract 型的 family-first wording 做同樣的 D1 docs cleanup。
- 若後續要改到 OpenAPI / SDK docs / route metadata，仍應獨立成另一個 non-breaking slice，避免與 architecture wording 混在一起。
