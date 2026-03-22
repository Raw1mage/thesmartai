# Tasks: Rotation × Subagent Model Sync

## Phase 1: Foundation — Model Update Signal

- [x] **T1.1** 建立 `model-update-signal.ts` — per-session Promise registry（wait / resolve / timeout）
- [x] **T1.2** Worker stdin handler 加入 `model_update` 指令（`cli/cmd/session.ts`）
- [x] **T1.3** Worker 回報 `model_updated` 確認（included in T1.2 — worker sends `{ type: "model_updated", resolved }` back）

## Phase 2: Subagent Escalation

- [x] **T2.1** 定義 `task.rate_limit_escalation` BusEvent schema
- [x] **T2.2** `processor.ts` — child session rate limit 時 escalate 而非 self-rotate
  - 偵測 `session.parentID` 存在
  - 發出 escalation event（經 bus → stdout bridge）
  - await `ModelUpdateSignal.wait(sessionID)` with 30s timeout
  - timeout → fail fast
  - 收到 → 更新 sessionIdentity + pinExecutionIdentity + 繼續 loop
- [x] **T2.3** `task.ts` — `publishBridgedEvent()` 加入 escalation event 處理
  - 讀取 parent execution identity
  - 決定 new model（parent model 優先）
  - stdin 發送 `model_update` 到 worker
  - 更新 child session pinExecutionIdentity

## Phase 3: Manual Model Change Propagation

- [x] **T3.1** 找到使用者手動切 model 的 API endpoint / 邏輯（PATCH `/session/:sessionID`）
- [x] **T3.2** 在 model 切換時檢查 active child worker，發送 `model_update`

## Phase 4: Safety & Constraint Restoration

- [x] **T4.1** `processor.ts` — child session 禁止 self-rotate（fail fast → escalate to parent）
- [x] **T4.2** 確認 main session（非 child）rotation 邏輯不受影響（`isChildSession` guard 只作用於 child）

## Phase 5: Validation

- [ ] **T5.1** 手動測試：subagent 撞 rate limit → 觀察 escalation → model update → 繼續
- [ ] **T5.2** 手動測試：main session 切 model → 觀察 subagent model 更新
- [ ] **T5.3** 手動測試：escalation timeout → subagent fail fast
