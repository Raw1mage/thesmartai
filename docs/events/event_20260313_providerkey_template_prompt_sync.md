## Requirements

- 延續 provider-key docs closure 後的 autonomous follow-up，補齊一個仍殘留在 release template 的 terminology mismatch。
- 依專案規範，同步修正 `templates/**` 中仍把 provider inventory 直接敘述成 `families` 的模板文字。

## Scope

### In

- `templates/prompts/SYSTEM.md` wording sync
- event ledger / validation record

### Out

- runtime code or MCP output schema changes
- prompt policy大改寫
- breaking-risk legacy field removal

## Task List

- [x] 搜尋 templates/specs 熱點
- [x] 確認模板中仍有 `families` 作為 provider inventory 主敘述
- [x] 改寫為 provider-first wording，同時保留 legacy field name 說明
- [x] 補 event 與 validation

## Baseline

- 前一輪 autonomous docs closure 已完成 README / ARCHITECTURE 的 provider-key-first wording 收斂。
- `templates/prompts/SYSTEM.md` 仍有一處敘述：`system-manager_get_system_status` 將 model providers 列在 `families` 下。
- 這裡若完全刪掉 `families` 字樣會失真，因為工具回傳欄位名目前確實仍是 `families`；正確做法是保留欄位名但改成 legacy-field framing。

## Changes

- `templates/prompts/SYSTEM.md`
  - 將 `under families` 改寫為：
    - 這是 provider entries
    - `families` 是 legacy field name
    - 概念上應理解為 provider inventory

## Decisions

1. 模板層應優先教導 provider-first 心智模型，但不能捏造不存在的即時欄位名。
2. 因此本次採「保留欄位名 + 修正概念敘述」而非硬改成假想的 `providers` 欄位。

## Validation

- 靜態搜尋確認 repo 中唯一這種模板敘述熱點即為本檔。✅
- 本次修改為 docs/template wording only；未改動 runtime 行為或 schema。✅

## Next

- 若後續真的要把 system-manager 的實際回傳欄位從 `families` 改為 `providers`，那將屬 code/contract change，必須另開切片處理。
