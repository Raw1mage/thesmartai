# Design

## Context

- OpenCode 使用 LLM API（主要是 OpenAI gpt-5.4）進行多輪對話
- OpenAI 提供 server-side prompt caching：相同 message prefix 的部分走 cache（50% 折扣或免費）
- 當 context 接近 model limit 時，系統觸發 compaction（壓縮歷史 messages 為 summary）
- Compaction 替換所有舊 messages → cache prefix 完全改變 → cache 失效 → 下一輪全額重送
- 觀測數據：130 rounds session 中 229 次 compaction，14 次完全 cache miss 佔 61.7% input tokens

## Goals / Non-Goals

**Goals:**

- 降低 compaction 頻率（減少 cache invalidation）
- 在 compaction 後保留 cache prefix（減少 cache miss 代價）
- 降低 system prompt 固定開銷

**Non-Goals:**

- 利用 Anthropic explicit cache breakpoints（僅 Anthropic API 支援）
- 改變 session 生命週期或 session 拆分策略
- 改變 pruning 機制

## Decisions

### DD-1: 閾值調整策略

使用 configurable `compaction.headroom` 取代固定 `COMPACTION_BUFFER`。

現有邏輯：
```typescript
const reserved = config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, maxOutputTokens)
const usable = input.model.limit.input - reserved
overflow = count >= usable
```

新邏輯：引入 `headroom` 概念，讓大 context 模型有更小的 buffer 比例：
```typescript
const headroom = config.compaction?.headroom ?? 8_000
const reserved = Math.max(headroom, config.compaction?.reserved ?? COMPACTION_BUFFER)
```

Rationale: 對 272k context 的 gpt-5.4，20k buffer 意味著 252k 就觸發（93%）。改為 8k headroom 則 264k 才觸發（97%），每個 cycle 多跑約 12k tokens 的對話空間。但仍然保留 `reserved` 作為 user override。

### DD-2: 冷卻期機制

在 `SessionCompaction` namespace 中維護 per-session 的 `lastCompactionRound` 記錄。

```typescript
const MIN_ROUNDS_BETWEEN_COMPACTION = 8

// In isOverflow:
if (roundsSinceLastCompaction < MIN_ROUNDS_BETWEEN_COMPACTION) {
  return false  // 即使 overflow 也不觸發
}
```

冷卻期間如果 context 繼續增長超過 hard limit，需要一個 **hard ceiling**（如 context limit - 2000）作為 emergency compaction 閾值，避免 API error。

### DD-3: Prefix-preserving compaction 結構

**核心改動**：compaction 不再替換所有 messages，而是：

1. 保留 system prompt（不動，由 LLM 框架自動處理）
2. 壓縮「前面的對話歷史」為 summary message
3. 保留最近 N 個 messages 原樣（N 根據 token budget 動態決定）

Implementation approach:
- `MessageV2.toModelMessages()` 已經將 messages 序列化為 model 格式
- Compaction 時，把 messages 分成三段：`[system] [old → summary] [recent N]`
- Summary message 使用 `assistant` role with `summary: true` 標記（沿用現有機制）
- Recent messages 保留原始 content，不做任何修改

保留多少 recent messages：
- 目標：保留足夠的「最近上下文」讓 LLM 能延續工作
- 策略：從最新 message 往回走，累計 token 不超過 `usable * 0.3`（約 30% 給 recent）
- Fallback：至少保留最近 2 個 user-assistant turns

### DD-4: AGENTS.md 去冗餘分層策略

三層文件的定位：
- **SYSTEM.md**：操作規則的最高權威（角色偵測、工具治理、紅線規則）
- **Global AGENTS.md**：指揮官戰術（skill routing、MCP 整合、resource dispatch）
- **Project AGENTS.md**：專案特有規範（cms 分支特色、部署架構、provider 拆分）

去冗餘原則：
1. 任何在 SYSTEM.md 已定義的規則，從 AGENTS.md 中移除（如 delegation rules、tool governance）
2. Global 和 Project 重複的內容，保留在最適合的層級，另一層引用
3. 預估可去除的重複區塊：
   - 「開發任務預設工作流」：Global 和 Project 幾乎完全重複 → 保留 Global，Project 引用
   - 「核心文件責任分工」「Debug 契約」：兩處完全重複 → 保留 Project，Global 引用
   - 「Plan/Spec Lifecycle Contract」：兩處完全重複 → 保留 Project，Global 引用
   - 「禁止 fallback」：三處都有 → 保留 SYSTEM.md + Project，Global 刪除
   - 「Token 最佳化協議」：SYSTEM.md §8 和 Global §7 重複 → 保留 SYSTEM.md，Global 刪除
   - 「驗證基準排除」：兩處都是空的 → 統一刪除或保留一處

## Data / State / Control Flow

### Compaction 觸發流程（改動後）

```
prompt.ts loop:
  → lastFinished 完成
  → check isOverflow(tokens, model)
    → inspectBudget: count >= usable?
    → NEW: check cooldown: roundsSinceLastCompaction >= MIN_ROUNDS?
    → NEW: if in cooldown but count >= hardCeiling: emergency compaction
  → if overflow && !cooldown:
    → SessionCompaction.create()
    → compaction.ts process():
      → NEW: split messages into [old | recent]
      → summarize only [old] portion
      → keep [recent] as-is
      → summary message placed before [recent]
    → update lastCompactionRound
  → continue loop
```

### Cache prefix 保留機制

```
Before compaction:
  [system 7.7k] [msg1] [msg2] ... [msg50] [msg51] ... [msg80]
  cache prefix: [system + msg1..msg50]

After current compaction:
  [system 7.7k] [summary]  ← prefix completely different → cache miss

After prefix-preserving compaction:
  [system 7.7k] [summary of msg1..msg50] [msg51..msg80 unchanged]
  ← system prefix matches → partial cache hit
  ← if summary is stable → even deeper cache hit
```

## Risks / Trade-offs

- **方案 A 風險**：閾值太高 → context overflow API error。Mitigation: 保留 hard ceiling emergency compaction。
- **方案 B 風險**：冷卻期太長 → context 在冷卻期內超出 API limit。Mitigation: emergency compaction hard ceiling 不受冷卻期限制。
- **方案 C 風險**：summary 品質下降（只看到部分歷史）。Mitigation: summary prompt 仍然收到所有 old messages 作為 input。
- **方案 C 風險**：recent messages 佔比不當。Mitigation: 動態計算 + 至少 2 turns 保底。
- **方案 D 風險**：去冗餘時誤刪有效指令。Mitigation: 逐條比對 checklist。

## Critical Files

- `packages/opencode/src/session/compaction.ts` — 主要改動：閾值、冷卻期、prefix-preserving 邏輯
- `packages/opencode/src/session/prompt.ts:854-866` — overflow 檢查位置
- `packages/opencode/src/session/llm.ts:320-371` — system block 組裝
- `packages/opencode/src/session/message-v2.ts` — toModelMessages() 可能需要支援 partial compaction
- `packages/opencode/src/config/config.ts` — compaction config schema 擴展
- `/home/pkcs12/.config/opencode/AGENTS.md` — Global AGENTS.md 精簡
- `/home/pkcs12/projects/opencode/AGENTS.md` — Project AGENTS.md 精簡
- `/home/pkcs12/.config/opencode/prompts/SYSTEM.md` — SYSTEM.md 檢查
- `/home/pkcs12/projects/opencode/templates/AGENTS.md` — template 同步
