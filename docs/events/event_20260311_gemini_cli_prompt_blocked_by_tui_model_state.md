# Gemini CLI Prompt Blocked By TUI Model State

## 需求

使用者回報 `gemini-cli` 帳號無法對話，且後續補充 symptom 為 request 打不出去、前端報錯。需查明是 provider/runtime 故障，還是 TUI/session model state 污染導致 prompt 在送出前失敗。

## 範圍

IN:
- `gemini-cli` provider/runtime 與近期 session/log 對照
- TUI model selection / local state / prompt submit 路徑
- 最小修正與驗證

OUT:
- 非 `gemini-cli` provider 的一般 429 問題
- 大規模 rotation policy 調整

## 任務清單

- [x] 查近期 `debug.log` 與 session storage，確認 `gemini-cli` 是否真的無法回答
- [x] 比對成功/失敗 session 的 persisted user message metadata
- [x] 找出 request 未送出的前端根因
- [x] 修正 TUI model state 正規化與 submit 錯誤可觀測性
- [x] 清理本機 `model.json` 污染項
- [x] 記錄驗證結果

## Debug Checkpoints

1. Provider health
   - 直接 Gemini API 測試成功
   - `probeModelAvailability("gemini-cli","gemini-2.5-flash",...)` 成功
   - 近期成功 assistant message 存在，例：
     - `ses_326b8bd98fferOXo2rzqnf0XpA`
     - provider=`gemini-cli`
     - model=`gemini-3-pro-preview`
     - account=`gemini-cli-api-ncucode`

2. Failure shape
   - `debug.log` 在「request 打不出去」時間窗只看到 `/api/v2/log`
   - 沒有新的 `POST /api/v2/session/:id/prompt_async`
   - 判定失敗發生在前端送出前，不是 server route / provider runtime 拒絕

3. State corruption evidence
   - persisted user message:
     - `ses_326ab3d7fffenX7PD7zthmJ7wN/messages/msg_cd954c286001FhQg4dN6VoYKfk/info.json`
     - `model.providerId = gemini-cli-api-yeatsluo`
     - `model.accountId = gemini-cli-api-ivon0829`
   - `~/.local/state/opencode/model.json` 也存在非法 recent entries：
     - `providerId = gemini-cli-api-yeatsluo`

4. Root cause
   - TUI local model state 被污染後，session / recent model identity 可能把 account ID 當成 providerId 傳遞
   - submit 路徑原本把 `sdk.client.session.prompt(...).catch(() => {})` 完全吞掉，導致 request 沒送出時只有 symptom、沒有可見錯誤

## 修正

### 1. TUI model identity 正規化

檔案：
- `packages/opencode/src/cli/cmd/tui/context/local.tsx`

變更：
- 新增 `normalizeModelIdentity()`
- 將 account-like provider ID 經 `Account.parseProvider()/parseFamily()` 正規化成 canonical provider family
- 在以下路徑套用正規化：
  - `recent` state 載入
  - `getFirstValidModel()`
  - `model.set()`

### 2. Prompt submit 錯誤可見化

檔案：
- `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`

變更：
- 將原本吞掉的 `.catch(() => {})` 改成：
  - `console.error("Failed to submit prompt:", error)`
  - 顯示 toast：`Send failed: ...`

### 3. 本機狀態清理

檔案：
- `~/.local/state/opencode/model.json`

變更：
- 移除非法 recent entries：
  - `providerId = gemini-cli-api-yeatsluo`

## 驗證

- `bun x eslint packages/opencode/src/cli/cmd/tui/context/local.tsx packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
- `bun -e '...Account.parseProvider("gemini-cli-api-yeatsluo")...'`
  - 驗證 account-like provider ID 會正規化為 `gemini-cli`

## 結論

這次 `gemini-cli` 無法對話的主因不是 provider runtime 或 API key 壞掉，而是 TUI model/session state 污染加上 submit 錯誤被吞，造成使用者看到「request 打不出去」但 log 沒有直接顯示 prompt route。

## Architecture Sync

Verified (No doc changes)

依據：
- 問題屬於既有 TUI local model state 與 prompt submit error visibility 的實作缺陷
- 未改動長期模組邊界、資料流總體結構或狀態機定義
