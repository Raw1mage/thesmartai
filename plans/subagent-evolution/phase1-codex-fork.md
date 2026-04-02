# Phase 1 Implementation: Codex Fork Dispatch

## 目標

Child session 使用 parent 的 `previousResponseId` 作為 fork base，第一 round 不重送 parent history，直接讀 parent 的雲端 cache。

---

## 步驟一：暴露 `LLM.getCodexResponseId()`

**檔案：** `packages/opencode/src/session/llm.ts`

`codexSessionState` 目前是 module-level private Map。新增一個 read-only getter：

```ts
// 在 LLM namespace 內，codexSessionState 宣告之後
export function getCodexResponseId(sessionID: string): string | undefined {
  return codexSessionState.get(sessionID)?.responseId
}
```

無副作用，純讀取。

---

## 步驟二：Dispatch 時讀取並傳遞 parent responseId

**檔案：** `packages/opencode/src/tool/task.ts`

在 `task()` execute 函數的 model 解析完成後（約 line 1370 附近），加入：

```ts
// Codex fork: seed child with parent's responseId so child can continue from parent's cache
let codexForkResponseId: string | undefined
if (model.providerId === "codex") {
  codexForkResponseId = LLM.getCodexResponseId(ctx.sessionID)
  if (codexForkResponseId) {
    log.info("codex fork: seeding child with parent responseId", {
      parentSessionID: ctx.sessionID,
      responseId: codexForkResponseId.slice(0, 16) + "...",
    })
  }
}
```

然後把 `codexForkResponseId` 傳進 worker spawn 路徑（或存進 child session metadata）。

**傳遞機制：** 最乾淨的方式是在 `Session.create()` 的 metadata 欄位（或 worker spawn payload）帶上這個值，讓 child session 的 `prompt.ts` 在 startup 時能讀到。

```ts
// Session.create() 時
return await Session.create({
  parentID: ctx.sessionID,
  // ...existing fields...
  metadata: {
    codexForkResponseId,  // undefined if not applicable
  },
})
```

若 `Session.Info` 尚無 metadata 欄位，加一個 optional `codexForkResponseId?: string` 欄位在 session info schema 上更直接。

---

## 步驟三：Child session startup 跳過 parentMessagePrefix

**檔案：** `packages/opencode/src/session/prompt.ts`，lines 497–511

目前邏輯：
```ts
if (session.parentID) {
  parentMessagePrefix = await MessageV2.filterCompacted(MessageV2.stream(session.parentID))
}
```

改為：
```ts
if (session.parentID) {
  const forkId = session.codexForkResponseId  // 從 session info 讀取
  if (forkId) {
    // Codex fork path: parent cache already inherited via previousResponseId
    // Skip parentMessagePrefix — re-sending would duplicate what provider already has
    log.info("context sharing: codex fork active, skipping parentMessagePrefix", {
      sessionID,
      parentID: session.parentID,
      forkResponseId: forkId.slice(0, 16) + "...",
    })
  } else {
    parentMessagePrefix = await MessageV2.filterCompacted(MessageV2.stream(session.parentID))
    log.info("context sharing: loaded parent messages", {
      sessionID,
      parentID: session.parentID,
      parentMessageCount: parentMessagePrefix.length,
    })
  }
}
```

同時在 `codexSessionState` 初始化：若 `session.codexForkResponseId` 存在，在進入 loop 前種入：

```ts
if (session.codexForkResponseId) {
  // Pre-seed codex state so first LLM call uses parent's responseId as fork base
  // optionsHash set to child's own system+tools hash (computed below) to bypass mismatch
  LLM.seedCodexForkState(sessionID, session.codexForkResponseId)
}
```

---

## 步驟四：First-call hash bypass in `llm.ts`

**檔案：** `packages/opencode/src/session/llm.ts`

問題：child 的 system prompt 與 parent 不同（少了 AGENTS.md 等），若直接繼承 parent responseId 進 codexSessionState，第一次 hash 比對會失敗（`prev.optionsHash !== currentHash`），導致 `willInject = false`，fork 失效。

解法：新增一個 `seedCodexForkState()` 函數，在種入 responseId 的同時把 optionsHash 設為 **sentinel 值**，讓第一次呼叫無條件注入，之後再更新為 child 自己的真實 hash：

```ts
export function seedCodexForkState(sessionID: string, responseId: string): void {
  codexSessionState.set(sessionID, {
    responseId,
    optionsHash: FORK_SEED_SENTINEL,  // 特殊值，表示「第一次呼叫直接注入，不比對」
  })
}

const FORK_SEED_SENTINEL = "__fork_seed__"
```

在 hash 比對邏輯中：

```ts
const isForkSeed = prev?.optionsHash === FORK_SEED_SENTINEL
const hashMatch = isForkSeed || prev?.optionsHash === currentHash

// isForkSeed 時 isRebindSuspect 不適用（child messages 一開始就是空的，這是預期行為）
const isRebindSuspect = !isForkSeed && input.messages.length < 5 && prev?.responseId
```

第一次呼叫注入成功後，`optionsHash` 被正常更新為 child 自己的 `currentHash`，後續 rounds 走正常 hash 比對。

---

## 整體資料流

```
task() dispatch (parent session, Codex, R_N exists)
  ↓
LLM.getCodexResponseId(parentSessionID) → R_N
  ↓
Session.create({ codexForkResponseId: R_N })
  ↓
prompt.ts startup:
  - session.codexForkResponseId = R_N → skip parentMessagePrefix
  - LLM.seedCodexForkState(childSessionID, R_N)
  ↓
llm.ts first call:
  - prev.optionsHash === FORK_SEED_SENTINEL → isForkSeed = true
  - willInject = true → previousResponseId = R_N
  - provider: continues from R_N state (no parent history resent)
  - response → C_1
  - codexSessionState updated: { responseId: C_1, optionsHash: child's real hash }
  ↓
llm.ts subsequent calls:
  - normal hash comparison
  - previousResponseId = C_N (child's own chain)
```

---

## Regression Guard

Non-Codex provider（Anthropic / Gemini）的路徑完全不變：
- `codexForkResponseId` 為 `undefined`
- `parentMessagePrefix` 正常載入
- `LLM.seedCodexForkState()` 不呼叫

Codex provider 但 parent 沒有 responseId（第一輪 session）：
- `LLM.getCodexResponseId()` 回傳 `undefined`
- `codexForkResponseId` 為 `undefined`
- 走現有 full history 路徑（現有行為）

---

## Validation

- `[CODEX-FORK]` log 出現：`codex fork: seeding child with parent responseId`
- `[WS-REQUEST]` log：child 第一 round payload 的 messages array 只有 `[separator, task_message]`，不含 parent history
- `[CODEX-DELTA]` log：`codex delta: injecting previousResponseId` 出現在 child 第一 round
- Non-Codex regression：stable prefix 仍注入（`context sharing: loaded parent messages`）
- Child R2+ cache hit rate 不受影響
