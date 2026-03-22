# Proposal

## Why

- 長時間 session 中 compaction 導致 LLM server-side cache 完全失效，造成大量 input tokens 浪費
- 實測數據：130 rounds 的 session 發生 229 次 compaction（每 0.6 round 一次），14 個 cache-miss rounds 佔 61.7% total input tokens（2.4M tokens）
- System prompt 每次 ~7.7k tokens，在 cache miss 時全額重送
- Global AGENTS.md (13KB) 與 Project AGENTS.md (15KB) 有大量重複內容

## Original Requirement Wording (Baseline)

- "global和project agents.md去冗餘。同意方案A, B。方案C其實是優化compaction的結構，我覺得同意。基本上全都可以做。"

## Requirement Revision History

- 2026-03-23: 初始需求建立

## Effective Requirement Description

1. 降低 compaction 頻率，減少 cache invalidation 次數
2. 在 compaction 後盡量保留 LLM cache prefix
3. 精簡 Global/Project AGENTS.md 與 SYSTEM.md 的冗餘內容

## Scope

### IN

- Compaction 觸發閾值調整（方案 A）
- Compaction 冷卻期機制（方案 B）
- Prefix-preserving compaction 結構優化（方案 C）
- Global AGENTS.md / Project AGENTS.md / SYSTEM.md 去冗餘（方案 D）

### OUT

- Provider-level cache API 介入（如 Anthropic explicit cache breakpoints）
- 改變 session lifecycle（如強制拆分 session）
- 新增 config UI

## Non-Goals

- 改變 compaction summary 的品質或格式
- 改變 pruning 機制（PRUNE_MINIMUM / PRUNE_PROTECT）

## Constraints

- 必須向後相容現有 `opencode.json` 的 `compaction` config 欄位
- 不能增加 compaction 後 context 丟失的風險
- AGENTS.md 精簡後不能遺失任何有效指令

## What Changes

- `compaction.ts`：觸發閾值邏輯、冷卻期機制、message 壓縮結構
- `prompt.ts`：overflow 檢查增加冷卻期判斷
- `llm.ts`：可能調整 system block 組裝以支援 prefix-preserving
- Global AGENTS.md：去除與 Project AGENTS.md / SYSTEM.md 重複的指令
- Project AGENTS.md：去除與 Global AGENTS.md / SYSTEM.md 重複的指令
- SYSTEM.md：檢查可精簡內容

## Capabilities

### New Capabilities

- **Compaction cooldown**: compaction 完成後有最小 round 間隔，避免振盪
- **Prefix-preserving compaction**: 壓縮中間 messages 而非全部替換，保留 cache prefix

### Modified Capabilities

- **Compaction threshold**: 觸發閾值從 ~93% 調整至更高比例，降低觸發頻率
- **System prompt size**: 精簡後預期從 ~7.7k tokens 降至 ~5k tokens

## Impact

- 直接影響所有長 session 的 token 效率
- 影響 `compaction.ts`、`prompt.ts`、`llm.ts` 三個核心 session 模組
- 影響兩份 AGENTS.md 和 SYSTEM.md 的內容（跨 config/template）
