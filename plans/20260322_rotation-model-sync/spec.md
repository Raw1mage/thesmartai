# Rotation × Subagent Model Sync

## Problem Statement

當 subagent (worker process) 撞到 rate limit 時，它在自己的進程內獨立做 rotation3d，
選了一個新 model。Main session 完全不知道這件事。反過來，使用者在 main session
手動切 model，也無法傳播到正在跑的 subagent。

結果：main session 和 subagent 的 model 完全脫鉤，使用者無法控制 subagent 的 model。

## Root Cause

1. **`sessionIdentity` 約束已被移除** — `llm.ts:914-932` 明確允許 cross-provider fallback
2. **Worker 只支援 `run` / `cancel`** — 沒有 model update IPC
3. **`Session.pinExecutionIdentity()` 是 spawn-time 一次性** — subagent 的 processor 讀一次就鎖死

## Goal

Model 切換（無論 rate limit 或手動）→ 全域暫停 → main session 決定 model → 傳播到 subagent → 對齊後繼續。

## Design

### 核心機制：Escalate + Model Update Protocol

#### 1. Subagent Rate Limit → Escalate to Parent (不自己 rotate)

**processor.ts 變更**：
- 當 `session.parentID` 存在（= child session）且撞到 rate limit：
  - **不呼叫** `handleRateLimitFallback()`
  - 改為發出 `rate_limit_escalation` bridge event（透過 Bus → stdout → parent）
  - 進入等待狀態：await 一個 Promise，直到收到 `model_update` stdin 指令
  - 收到後更新 `sessionIdentity` + `Session.pinExecutionIdentity()`，繼續 loop

**新 bridge event**：
```typescript
// worker → parent (via stdout bridge)
BusEvent.define("task.rate_limit_escalation", z.object({
  sessionID: z.string(),
  currentModel: z.object({
    providerId: z.string(),
    modelID: z.string(),
    accountId: z.string().optional(),
  }),
  error: z.string(),
  triedVectors: z.array(z.string()),
}))
```

#### 2. Worker Stdin 新增 `model_update` 指令

**session.ts (worker command) 變更**：
```typescript
// 新增 handler
if (msg.type === "model_update") {
  // 通知 processor 使用新 model
  ModelUpdateSignal.resolve(msg.sessionID, {
    providerId: msg.providerId,
    modelID: msg.modelID,
    accountId: msg.accountId,
  })
  send({ type: "model_updated", sessionID: msg.sessionID })
}
```

**ModelUpdateSignal** — 簡單的 per-session Promise registry：
```typescript
// 共享在 worker process 內
const pending = new Map<string, {
  resolve: (model: ModelInfo) => void
}>()

export function wait(sessionID: string): Promise<ModelInfo> {
  return new Promise(resolve => {
    pending.set(sessionID, { resolve })
  })
}

export function resolve(sessionID: string, model: ModelInfo) {
  const entry = pending.get(sessionID)
  if (entry) {
    pending.delete(sessionID)
    entry.resolve(model)
  }
}
```

#### 3. Parent 端處理 Escalation

**task.ts 變更**：
- 在 `publishBridgedEvent()` 加入 `task.rate_limit_escalation` 處理
- 收到後：
  1. 讀取 parent session 當前的 execution identity
  2. 如果 parent 也被 rate limited → 用 parent 的 rotation3d 結果
  3. 如果 parent model 仍然可用 → 直接用 parent model
  4. 透過 worker stdin 發送 `model_update`
  5. 更新 child session 的 `pinExecutionIdentity()`

#### 4. 使用者手動切 Model → 傳播到 Subagent

**server/routes 變更**：
- 在 model 切換的 API endpoint 中（或 session execution identity 變更時）
- 檢查是否有 active child worker
- 如果有 → 透過 stdin 發送 `model_update`
- 更新 child session 的 `pinExecutionIdentity()`

### Timeout 與安全

- `ModelUpdateSignal.wait()` 有 30 秒 timeout
- Timeout 後 subagent fail fast（不 silent fallback）
- 如果 parent process 死了，worker ppid=1 watchdog 已存在

### 不做

- 不建立新的 fallback mechanism
- 不允許 subagent 自行 rotate（child session 永遠 escalate）
- 不改變 main session（非 child）的 rotation 邏輯

## Files

| File | Change |
|------|--------|
| `packages/opencode/src/session/processor.ts` | Child session rate limit → escalate instead of self-rotate |
| `packages/opencode/src/session/model-update-signal.ts` | NEW: per-session Promise registry for model updates |
| `packages/opencode/src/cli/cmd/session.ts` | Worker stdin: handle `model_update` command |
| `packages/opencode/src/tool/task.ts` | Handle `rate_limit_escalation` bridge event, send `model_update` |
| `packages/opencode/src/server/routes/session.ts` | Manual model change → propagate to active child |
| `packages/opencode/src/session/llm.ts` | Re-enforce `sessionIdentity` for child sessions |
