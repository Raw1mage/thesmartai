# 2026-04-19 — Question Tool Schema Relax (Hotfix)

## Problem

LLM 呼叫 `question` tool 時常送錯 shape，紅色 zod 錯誤外顯到對話：

```
The question tool was called with invalid arguments: [
  { path: ["questions"], expected: "array", received: "undefined", ... },
  ...
]. Please rewrite the input so it satisfies the expected schema.
```

重現於今日多次 session，AI 每輪照不同偏好 retry，最差要 3 輪才中。

## AI 偏好格式 vs 標準 schema

**Canonical schema**（`packages/opencode/src/question/index.ts:21`）：

```
questions: [
  { question: string, header: string (≤30 chars),
    options: [{ label: string, description: string }, ...],
    multiple?: bool, custom?: bool }
]
```

**AI 實際送的兩種 pattern**（錯誤 log 反推）：

- `{ question, options }` 扁平單題（沒 `questions` wrapper）
- `{ questions: [{ question, options: string[] }] }` wrapper 有，但 options 是字串陣列、無 `header`

這兩種是通用 LLM ask-user tool 的 default pattern（OpenAI function-call demo / ChatGPT plugin / Anthropic tool-use docs 的 user-choice 例子都這樣），對 opencode 的嚴格 schema 不自然。

## Hotfix（兩層）

### Layer 1 — `question.ts` 自動正規化 AI 偏好格式

- `z.preprocess(normalizeQuestionInput, ...)` 把以下變體吃掉：
  - 扁平單題 → 自動包 `questions: [...]`
  - `options: string[]` → `[{label: s, description: s}]`
  - `options: [{label, ...}]`（缺 description） → `description = label`
  - `options: [{value, ...}]`（用 value 不用 label） → 映射成 `label`
  - 缺 `header` → 從 `question` 截前 30 字

### Layer 2 — 正規化後仍失敗，靜默 retry

- `formatValidationError` 回傳以 `[schema-miss:question]` prefix 開頭的 pseudo-code schema 教程
- `processor.ts` `RETRYABLE_TOOL_ERRORS` 加 `"[schema-miss:"` pattern → UI 顯示為 `[skip] ...`（completed, muted），不渲染紅框
- 下輪 AI 看到 schema 模板就能對

## Scope

- [packages/opencode/src/tool/question.ts](packages/opencode/src/tool/question.ts) — preprocess + formatValidationError
- [packages/opencode/src/session/processor.ts](packages/opencode/src/session/processor.ts#L84) — retryable pattern 加 `"[schema-miss:"`

其他 tool 的 schema 錯誤行為**不變**（仍走紅框路徑）。只有顯式設 `formatValidationError` 並以 `[schema-miss:<tool>]` 開頭的 tool 才會走 muted/retryable 路徑。將來若有其他 tool 也想享用可個別 opt-in。

## Why not universal

- 其他 tool 的 schema 錯誤可能代表真實 bug（tool 呼叫資料錯亂、provider rewrite 失敗等），需要紅框讓開發者看到
- Question tool 是人機互動 UX 工具，比其他 tool 更常被 AI 嘗試變形格式；這是 self-heal 成本最低、效益最高的點

## Backup

依 AGENTS.md 第二條：`~/.config/opencode.bak-20260419-2226-question-tool-schema-relax/`（58M）

## Related

- Memory: `feedback_lazy_loader_schema_miss.md` — LLM↔tool 協商層 self-heal 的通用原則
- 本次是該原則在 question tool 的落地範例；未來其他 tool 如有類似 UX 問題可 copy 此模式
