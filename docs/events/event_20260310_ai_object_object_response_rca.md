# Event: AI `[object Object]` response RCA

Date: 2026-03-10
Status: Done

## 需求

- 調查目前工作中 session 偶發收到 AI 回應顯示 `[object Object]` 的來源。
- 判斷問題是在 AI provider、runtime message 序列化、還是 web/TUI 顯示層。
- 以 evidence-first 方式確認是否與使用者修改中的程式無關。

## 範圍 (IN / OUT)

### IN

- `docs/ARCHITECTURE.md`
- `docs/events/event_20260307_session_runtime_correctness_analysis.md`
- `docs/events/event_20260309_existing_session_reload_black_screen_rca.md`
- `docs/events/event_20260310_session_completion_text_shift_rca.md`
- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/src/session/processor.ts`
- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`
- live session storage under `~/.local/share/opencode/storage/session/*`

### OUT

- 本輪不處理 quota / model selector / workspace 無關議題
- 本輪不重建或清理既有 session 資料

## 任務清單

- [x] 讀取 architecture 與近期 session/runtime RCA 文件
- [x] 直接檢查目前工作中 session 對話與 message storage
- [x] 確認 `[object Object]` 是否已被持久化到資料層
- [x] 追查 runtime 錯誤轉換與 UI 顯示路徑
- [x] 記錄 root cause 與 validation

## Debug Checkpoints

### Baseline

- 使用者回報：目前工作中 session 偶發出現 AI 回應為 `[object Object]`。
- 使用者明確指出同樣現象也出現在原本穩定版 opencode，因此優先懷疑 runtime / provider error handling，而非目前修改中的前端程式。

### Evidence

- 最新工作 session `ses_328eb8422ffeAJIc5ZPn1fcf46` 內存在 assistant message：
  - `~/.local/share/opencode/storage/session/ses_328eb8422ffeAJIc5ZPn1fcf46/messages/msg_cd716f64e001QLtqQO7tu5T4Yl/info.json`
  - 其內容為:
    - `error.name = "UnknownError"`
    - `error.data.message = "[object Object]"`
- 另一個相近 session `ses_328f2123cffeprV1uhHjbYajvD` 也有相同型態：
  - `~/.local/share/opencode/storage/session/ses_328f2123cffeprV1uhHjbYajvD/messages/msg_cd70dedd1001xt8PX799EJ9Vzl/info.json`
  - 同樣為 `UnknownError` + `error.data.message = "[object Object]"`
- 這證明 `[object Object]` 並非僅是 UI 即時渲染異常，而是已被 runtime 持久化進 message info。
- TUI render path `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` 直接顯示：
  - `props.message.error?.data.message`
- 因此 UI 只是原樣展示 runtime 寫入的錯誤訊息。

### Root Cause

- `packages/opencode/src/session/processor.ts` 在 provider/stream 錯誤時會呼叫：
  - `const error = MessageV2.fromError(e, { providerId: input.model.providerId })`
- `packages/opencode/src/session/message-v2.ts` 的 `fromError()` 對無法更精準分類的錯誤存在兩個 fallback：
  - `new NamedError.Unknown({ message: e.toString() }, { cause: e }).toObject()`
  - `new NamedError.Unknown({ message: String(e) }, { cause: e }).toObject()`
- 若上游拋出的 `e` 或其包裝內容本質是 object-like payload，而不是具可讀字串訊息的錯誤，這兩條路徑就會產生 `[object Object]`。
- `packages/opencode/src/session/llm.ts` 其實已有較完整的 debug 序列化 (`serializeError` / `serializeErrorForDebug`)，但這份較豐富的結構沒有被 `MessageV2.fromError()` 重用，最後仍退化成 `String(...)` / `toString()`。
- 結論：這是 **runtime 錯誤序列化退化**，不是正常 AI text response 被 UI 誤解讀，也不是這輪修改中的 session/web 呈現邏輯造成。

### Fix

- 已在 `packages/util/src/error.ts` 擴充 `UnknownError` schema：
  - 保留既有 `message`
  - 新增 optional `debug`
- 已在 `packages/opencode/src/session/message-v2.ts` 實作 unknown error serialization helper：
  - `extractReadableUnknownMessage(...)`
  - `serializeUnknownDebug(...)`
  - `unknownErrorData(...)`
- 新行為：
  - 仍保留 user-facing `message`
  - 若錯誤為 object-like payload 或 `Error` + object-like cause，會將原始結構的安全快照寫入 `error.data.debug`
  - 避免未來再次只剩 `[object Object]` 而無法追查
- 這份 debug payload 會跟隨 assistant message 一起持久化到 session storage，後續可直接從 `info.json` 回溯。

## Validation

- 文件驗證：
  - 已讀 `docs/ARCHITECTURE.md` 與近期 session/runtime 相關 events，確認本輪調查範圍聚焦在 session persistence / error rendering boundary。
- Storage 驗證：
  - `rg -n "\\[object Object\\]" ~/.local/share/opencode/storage/session/...`
  - 命中 live session assistant `info.json` 的 `error.data.message`
- Runtime 路徑驗證：
  - `packages/opencode/src/session/processor.ts` 會把 caught error 交給 `MessageV2.fromError()`
  - `packages/opencode/src/session/message-v2.ts` 會在 unknown fallback 使用 `e.toString()` / `String(e)`
- UI 驗證：
  - `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` 直接 render `props.message.error?.data.message`
- 測試驗證：
  - `bun test packages/opencode/test/session/message-v2.test.ts` ✅
  - 新增 coverage：
    - object-like unknown error 會保存 `data.debug`
    - `Error` 包裹 object-like cause 時會保存 `data.debug.cause`
- 型別驗證：
  - `bun run typecheck`（workdir: `packages/opencode`）✅
- 結論：
  - `[object Object]` 原因已定位為 runtime 將 unknown/object-like error 字串化後寫入 message error 欄位
  - 修復後，未來同類錯誤會額外落盤 `error.data.debug`，可保留原始資料包供後續分析
  - 不是工作中前端修改造成
  - 也不是「AI 真正回了這段文字」的自然語言輸出
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅完成 RCA，未改變 session/runtime 架構邊界、資料流或模組責任。
