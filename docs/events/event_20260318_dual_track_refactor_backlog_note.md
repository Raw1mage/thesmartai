# Event: Backlog Note — app/console 新舊雙軌制重構需求

## 背景

- 本日事件顯示兩條相似但不同的帳號管理路徑同時存在：
  1. `packages/app` 的 provider connect dialog（runtime-facing）
  2. `packages/console` 的 workspace BYOK provider section（console-facing）
- 問題排查期間曾出現路徑誤判，造成修復延遲與認知成本增加。

## 後續需求（待新 branch）

- 建立專用 branch 進行「新舊雙軌制」重構，目標：
  - 對齊 UX 與欄位語意（name/api key/provider）
  - 對齊 deploy 與 runtime 驗證流程
  - 對齊事件分類與調查入口，降低跨路徑誤判

## 建議執行方向

1. 先做 capability/flow inventory（app vs console）。
2. 定義單一名詞與欄位契約（尤其 account name）。
3. 規劃 phased migration（避免一次性高風險改動）。
4. 將 webctl refresh 的 sync result 納入顯性健康檢查與 fail-fast gate。

## Cross-References

- `docs/events/event_20260318_console_byok_account_name_input.md`
- `docs/events/event_20260318_gemini_connect_name_input_rca.md`

## Architecture Sync

- `specs/architecture.md`: Verified (No doc changes)
- 本文件為 backlog note，未直接變更架構實作。
