# Event: openai support error surface

Date: 2026-03-10
Status: Done

## 需求

- 使用者回報 GPT 服務錯誤：
  - `An error occurred while processing your request... Please include the request ID ...`
- 需要確認這是 upstream provider 問題、runtime 錯誤轉換問題，還是 web UI 把可診斷資訊吃掉。
- 若 runtime 已保存 request ID / hints，需讓 web 端可見，避免只剩不易操作的原始錯誤字串。

## 範圍 (IN / OUT)

### IN

- `docs/ARCHITECTURE.md`
- `docs/events/event_20260310_richer_llm_error_debug_logging.md`
- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/test/session/message-v2.test.ts`
- `packages/app/src/pages/error.tsx`
- `packages/app/src/pages/error-page.test.tsx`
- 本 event / validation / architecture sync 記錄

### OUT

- 不修改 OpenAI provider 實際重試策略
- 不改模型路由 / quota / rotation3d
- 不假設 upstream OpenAI 服務必然故障；本輪先聚焦本 repo 的錯誤顯示邊界

## 任務清單

- [x] 讀取 architecture 與最近 LLM error logging event
- [x] 對照使用者錯誤字串與 runtime 既有測試 coverage
- [x] 修正 web error page 的 `UnknownError` 顯示邊界
- [x] 補最小單元測試
- [x] 驗證與記錄

## Debug Checkpoints

### Baseline

- `packages/opencode/src/session/message-v2.ts` 已能從 OpenAI support-style unknown error 抽出：
  - `summary`
  - `hints`
  - `request ID`
- `packages/opencode/test/session/message-v2.test.ts` 已有對應測試覆蓋。
- 但 `packages/app/src/pages/error.tsx` 對 `UnknownError` 仍只顯示 `data.message`，未顯示 `summary/hints`。

### Instrumentation Plan

- 直接檢查 `MessageV2.fromError()` 對該錯誤案例的輸出。
- 檢查 web error page 格式化邏輯是否遺漏 `UnknownError.data.summary/hints`。
- 若確認為 UI surface gap，僅修改 error formatting 與對應測試。

### Execution

- `packages/opencode/src/session/message-v2.ts`
  - 已確認對 OpenAI support-style unknown error 會保存：
    - `data.summary`
    - `data.hints`
    - `Request ID`
- `packages/app/src/pages/error.tsx`
  - 改為使用抽出的純 formatter 模組，不再在 `UnknownError` 只顯示原始 `message`
- `packages/app/src/pages/error-format.ts`
  - 新增 server-safe error formatting helper
  - `UnknownError` 顯示順序：
    - `summary`
    - `message`（若與 summary 不同）
    - `hints`
- `packages/app/src/pages/error-page.test.tsx`
  - 新增 coverage：
    - 會顯示 OpenAI request ID 與 escalation hint
    - 若 summary 與 message 相同則不重複輸出

### Root Cause

- runtime 並沒有完全遺失診斷資訊。
- 真正缺口在 web error surface：
  - `packages/opencode/src/session/message-v2.ts` 已能為此類 OpenAI upstream error 生成 `summary/hints`
  - 但 `packages/app/src/pages/error.tsx` 對 `UnknownError` 只顯示 `data.message`
- 結果是：
  - request ID 雖已被 runtime 落盤
  - web UI 仍只露出笨重的原始錯誤段落
  - 操作者看不到已存在的 request ID 摘要與 support escalation hint
- 結論：這是 **錯誤診斷資訊 surface gap**，不是 provider parsing 缺失，也不是新的 upstream routing/rotation 問題。

### Validation

- App unit test:
  - `bun test --preload ./happydom.ts ./src/pages/error-page.test.tsx` (workdir: `packages/app`) ✅
- Existing runtime coverage:
  - `bun test /home/pkcs12/projects/opencode/packages/opencode/test/session/message-v2.test.ts` ✅
- App typecheck:
  - `bun run typecheck` (workdir: `packages/app`) ✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪只修正 web error display surface，未改變 provider/runtime/session 的模組邊界、資料流或架構責任。
