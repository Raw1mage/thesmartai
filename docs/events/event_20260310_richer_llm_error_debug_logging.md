# Event: richer llm error debug logging

Date: 2026-03-10
Status: In Progress

## 需求

- 強化 LLM/provider 錯誤的落盤 debug 機制。
- 讓錯誤發生時，除了保存 raw/debug 結構，也能額外保存「人類可辨識」的摘要文字，協助快速判讀案情。

## 範圍 (IN / OUT)

### IN

- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/src/provider/error.ts`
- `packages/opencode/test/session/message-v2.test.ts`
- 本 event / validation / architecture sync 記錄

### OUT

- 不改 provider 實際重試策略
- 不改 UI 呈現邏輯

## 任務清單

- [ ] 盤點目前 `UnknownError.debug` 與 API/stream error 可用欄位
- [ ] 補可讀摘要（summary / hints / extracted request id / status / provider clues）
- [ ] 補測試
- [ ] 驗證與記錄

## Checkpoints

### Baseline

- 目前 `UnknownError` 已可保存 `error.data.debug`。
- 但很多情況只保留原始結構，操作者仍需人工閱讀 object tree 才能理解案情。
- 使用者希望知道：錯誤當下的 LLM output / provider error payload 是否還有更多人類可辨識文字。

### Execution

- `packages/util/src/error.ts`
  - 擴充 `UnknownError` schema：新增 optional `summary` / `hints`
- `packages/opencode/src/session/message-v2.ts`
  - 保留既有 `message` / `debug`
  - 新增從 unknown/provider payload 中抽取：
    - request IDs
    - status codes
    - 可讀 detail strings
  - 產出：
    - `data.summary`：一句話摘要
    - `data.hints`：數條可讀提示（例如 request ID、status、support escalation hint）
- 設計目標：
  - 不只保存 raw/debug object
  - 也讓操作者不必先讀完整 object tree，就能快速理解錯誤案情

### Validation

- 測試：`bun test "/home/pkcs12/projects/opencode/packages/opencode/test/session/message-v2.test.ts"`
- 結果：passed
- 型別：`bun run typecheck`（workdir: `packages/opencode`）
- 結果：passed
- 新增/更新 coverage：
  - unknown primitive input 也會產出 `summary`
  - object-like unknown error 會產出 `summary` / `hints`
  - object-like cause 會產出更可讀的 hints
  - OpenAI support-style request ID error 會抽出 request ID 與 escalation hint
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅強化 error persistence/debug payload，未改變 runtime 模組邊界、資料流或架構責任。
