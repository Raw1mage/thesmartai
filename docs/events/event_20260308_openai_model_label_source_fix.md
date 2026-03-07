# Event: OpenAI Model Label Source Fix

Date: 2026-03-08
Status: Done

## 需求

- 找出 OpenAI model label 後綴 `(OAuth)` 的實際來源。
- 從源頭移除這個不合理顯示，避免未來再次寫入。
- 讓目前執行中的本機設定也同步修正，避免 UI 持續顯示舊字樣。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/templates/opencode.json`
- `/home/pkcs12/.config/opencode/opencode.json`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_openai_model_label_source_fix.md`

OUT:

- `models.dev` upstream 資料格式變更
- OpenAI auth / OAuth flow 邏輯變更
- 非 OpenAI provider model label 調整

## 任務清單

- [x] 追查 `(OAuth)` 是否來自 models.dev 或 config overlay
- [x] 移除 repo template 中 OpenAI model name 的 `(OAuth)`
- [x] 同步移除本機 config 中 OpenAI model name 的 `(OAuth)`
- [x] 驗證目前 repo / 本機 config 已無 OpenAI `(OAuth)` label
- [x] 完成 Architecture Sync 檢查並記錄結果

## Debug Checkpoints

### Baseline

- `Provider.initState()` 會將 `config.provider[providerId].models[*].name` 覆蓋 models.dev 名稱。
- `templates/opencode.json` 與 `/home/pkcs12/.config/opencode/opencode.json` 的 OpenAI model names 直接寫成 `... (OAuth)`。
- `packages/opencode/src/provider/model-curation.ts` 的 OpenAI curated additions 名稱並沒有 `(OAuth)`，可排除 models.dev/curation 為根因。

### Execution

- 鎖定根因為 repo template / user config 的 config overlay name 欄位。
- 已同步修正 `templates/opencode.json` 與 `/home/pkcs12/.config/opencode/opencode.json` 的 6 個 OpenAI model names，移除 `(OAuth)` 後綴。

### Validation

- `grep "\\(OAuth\\)" /home/pkcs12/projects/opencode/templates/opencode.json`
  - 通過，無結果；repo template 不再保留 OpenAI `(OAuth)` model label。
- `grep "\\(OAuth\\)" /home/pkcs12/.config/opencode/opencode.json`
  - 通過，無結果；目前本機生效設定也已清除 OpenAI `(OAuth)` model label。
- 根因確認：
  - `packages/opencode/src/provider/provider.ts` 會以 `config.provider.*.models[*].name` 覆蓋 models.dev 名稱。
  - `packages/opencode/src/provider/model-curation.ts` 的 OpenAI curated additions 名稱本身沒有 `(OAuth)`。
  - 結論：根因是 config overlay (`templates/opencode.json` / `~/.config/opencode/opencode.json`) 的手寫名稱，而非 models.dev。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅修正 OpenAI model display label 的 config seed / local config，未變更 provider graph、API contract、models.dev ingest 流程或 runtime architecture。
