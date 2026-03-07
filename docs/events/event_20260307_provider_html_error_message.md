# Event: provider HTML error message normalization

Date: 2026-03-07
Status: Done

## 需求

- 改善 provider/gateway 回傳 HTML 錯誤頁時的錯誤訊息可讀性
- 避免在 session/runtime 錯誤中直接把整段 HTML markup 暴露給使用者
- 只做與 cms 現有 provider error parsing 相容的最小安全切片

## 範圍

### IN

- `packages/opencode/src/provider/error.ts`
- `packages/opencode/test/session/message-v2.test.ts`
- upstream commit `6b7e6bde4`

### OUT

- 不重構整個 provider error taxonomy
- 不改動 session retry orchestration
- 不做 provider-specific auth/control-plane redesign

## 任務清單

- [x] 建立 provider HTML error 專題 event
- [x] 比對 upstream HTML error normalization 與 cms 現況
- [x] 定義 minimum safe first slice
- [x] 補上至少一個 regression test
- [x] 執行驗證並完成 commit
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- `ProviderError.message(...)` 目前在 `responseBody` 無法解析 JSON 時，會直接回傳 `${msg}: ${e.responseBody}`。
- 若 gateway / proxy / auth wall 回傳 HTML error page，使用者會看到整段 HTML 內容，訊息可讀性很差。

### Execution

- Upstream `6b7e6bde4` intent matches a cms-safe gap: `ProviderError.message(...)` already centralizes APICallError normalization, so HTML-response handling can be added without touching provider/session architecture.
- Minimum safe first slice:
  - detect HTML markup in `responseBody` after JSON parse fallback fails
  - map `401` and `403` HTML gateway pages to human-readable guidance
  - preserve current fallback for other HTML status codes by returning the base status message instead of raw markup
- Implementation:
  - `packages/opencode/src/provider/error.ts` now normalizes HTML response bodies before the raw `${msg}: ${responseBody}` fallback
  - `packages/opencode/test/session/message-v2.test.ts` adds regression coverage for 401/403 HTML gateway pages

### Validation

- `bun test /home/pkcs12/projects/opencode/packages/opencode/test/session/message-v2.test.ts` 通過（20 pass / 0 fail）。
- `bun run typecheck` 通過（repo-wide）。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅改善 provider API error message formatting 與對應 regression test，未改動 provider graph、session contract、或 runtime routing 邊界。
