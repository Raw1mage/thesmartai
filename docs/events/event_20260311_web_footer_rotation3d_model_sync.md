# Event: Web footer rotation3d model sync

Date: 2026-03-11
Status: Done

## 需求

- 修正 Web session footer 在 `rotation3d` 發生後仍顯示舊 model/account 的問題。
- 讓 Web footer 與實際 assistant 執行後的 `{ providerId, modelID, accountId }` 保持一致，避免所見非所得。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/session-model-sync.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/session-model-sync.test.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/components/prompt-input/submit.ts`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260311_web_footer_rotation3d_model_sync.md`

### OUT

- 不更動 `rotation3d` fallback 選擇策略本身
- 不變更 OpenAI quota API / cooldown 機制
- 不修改全域 active account 控制平面語意

## 任務清單

- [x] 讀取 architecture 與既有 footer / model label 事件
- [x] 追查 Web footer model/account 資料來源與 rotate 後不同步原因
- [x] 補上 Web session 對最後 completed assistant model/account 的同步
- [x] 新增單元測試覆蓋 rotate / narration guard / manual divergence guard
- [x] 執行 `packages/app` 測試與 typecheck
- [x] 完成 Architecture Sync

## Debug Checkpoints

### Baseline

- 使用者回報：發生 rate-limit rotate 後，Web footer 顯示的使用 model 沒有跟著 `rotation3d` 變更。
- 現況 `packages/app/src/pages/session.tsx` 只在最後一筆 user message 變化時，把 `msg.model` 同步到 `local.model`。
- 但 `rotation3d` 的實際 fallback/rotate 發生在 assistant 執行中或完成後，新的 `{ providerId, modelID, accountId }` 是寫回 assistant message metadata，而不是回頭修改最後一筆 user message。
- 結果：`packages/app/src/components/prompt-input.tsx` 的 footer model 顯示仍讀到舊的 `local.model.current(params.id)`，形成所見非所得。

### Instrumentation Plan

- 比對 TUI prompt footer 既有的 assistant fallback 同步邏輯。
- 檢查 Web session page 是否已有 assistant-completed model sync。
- 補一層純函式 helper，驗證以下邊界：
  - 正常 rotate 需同步
  - autonomous narration 不可誤判成 model switch
  - 若使用者已手動改過 session-local selection，不可被舊 assistant 反向覆蓋

### Execution

- 新增 `packages/app/src/pages/session/session-model-sync.ts`，抽出 Web 端 assistant-rotation sync 判斷。
- 在 `packages/app/src/pages/session.tsx` 新增 `lastCompletedAssistantMessage` effect：當最後完成的 assistant message 帶有新的 model/account，且符合 guard 條件時，回寫 `local.model.set(..., sessionID)`。
- guard 規則對齊 TUI：
  - narration-only synthetic assistant message 不同步
  - 若目前 session-local selection 已偏離最後一筆 user model，不強行覆蓋
  - 若 assistant 沒帶 accountId 且目前 selection 已有同 model 的 account，避免降級覆蓋
- 額外修補 `packages/app/src/components/prompt-input/submit.ts`，讓 `local.model.selection` 在舊測試 mock 缺席時使用 optional chaining，避免測試因 mock 不完整而失敗。

### Root Cause

- 真正根因不是 provider cooldown，也不是 quota 顯示 API。
- causal chain：
  1. `rotation3d` 在 assistant 執行期間切換實際 execution identity
  2. runtime 把新的 `{ providerId, modelID, accountId }` 寫回 assistant message
  3. Web session page 只從最後 user message 同步 `local.model`
  4. footer 仍讀到舊的 session-local model/account
  5. UI 顯示與真實執行 identity 分裂，造成所見非所得

### Validation

- `bun test --preload ./happydom.ts ./src/pages/session/session-model-sync.test.ts`
  - passed
- `bun test --preload ./happydom.ts ./src && bun run typecheck`（`/home/pkcs12/projects/opencode/packages/app`）
  - passed
- 新增測試覆蓋：
  - rotate 後 assistant model/account 會同步到 session-local selection
  - narration assistant message 不會觸發同步
  - 若使用者已手動切離最後 user model，不會被 assistant sync 蓋回去
- Architecture Sync: Updated
  - 已補充 Web prompt footer/session model sync 契約，明確記錄 Web 也必須跟隨最後 completed assistant 的 execution identity。
