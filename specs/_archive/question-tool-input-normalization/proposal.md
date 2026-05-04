# Proposal: question-tool-input-normalization

## Why

2026-04-20 在 cisopro session `ses_25b16719fffejShr48aGTkRcEk` 上連續兩次 `question` tool call 都壞了：

1. **Call #1** — Codex (gpt-5.4) 用 flat shape `{question, options:[string], multiple}` 呼叫（沒有外層 `questions` array）→ 3ms 內爆 `TypeError: undefined is not an object (evaluating 'input.questions.length')`，來自 [question/index.ts:143](../../packages/opencode/src/question/index.ts#L143) 的 `input.questions.length`。這就是截圖上那條紅字錯誤訊息。
2. **Call #2** — Codex 改送 `{questions:[{question, options:[string], multiple}]}`（有 array 但 options 是 bare strings、沒有 `header`）→ 沒爆 error，但 UI 渲染出 4 個空白 tab 按鈕（`q.header` undefined）+ 3 個空白選項按鈕（`opt.label` undefined）→ 使用者無法作答、按「忽略」→ `QuestionRejectedError`。

兩個表象、一個 root cause：

### Root Cause

[packages/opencode/src/tool/tool.ts:58-70](../../packages/opencode/src/tool/tool.ts#L58-L70) 的 `Tool.define` wrapper：

```ts
toolInfo.execute = async (args, ctx) => {
  try {
    toolInfo.parameters.parse(args)   // ← parse 只當成 validation 做，return value 被丟掉
  } catch (error) { ... }
  const result = await execute(args, ctx)   // ← 傳進去的是「原始 args」而不是 parse 後的
  ...
}
```

[QuestionTool](../../packages/opencode/src/tool/question.ts#L67-L74) 的 `parameters` 用 `z.preprocess(normalizeQuestionInput, ...)` 做三件事：

1. flat `{question,...}` 包成 `{questions:[...]}`
2. `options: string[]` 轉 `[{label, description}]`
3. 自動補 `header = question.slice(0, 30)`

`z.preprocess` 在 `.parse()` 時跑 transform、回傳 normalized value。但 tool.ts 把 return 丟掉、把未 normalize 的原始 args 餵給 `execute()`。於是：

- Call #1：`args.questions` 是 undefined → `Question.ask` 在 index.ts:143 讀 `.length` 爆 TypeError。
- Call #2：`args.questions` 是 array 但裡面沒有 header、options 是字串 → tool 執行成功，但 state.input 存的是 raw shape，[QuestionDock](../../packages/app/src/components/question-dock.tsx#L176) 讀 `q.header` / `opt.label` 全是 undefined → blank UI。

### 為什麼是「tool 框架」層問題而不是「question tool」層問題

這個 bug 影響**任何**使用 `z.preprocess` 或 `z.transform` 做 input coercion 的 tool。今天只有 question tool 在用，所以只有它顯現；但只要未來任何 tool 想用 zod 的 transform 做防呆（例如把 camelCase/snake_case 統一、把 string 轉 number），都會踩到同一個洞。

此外，即使修好 runtime 用 normalized args，**session 存檔的 `state.input` 仍然是 raw 形狀**（session runloop 直接把 LLM tool-call arguments 存下來）。舊 session 打開會繼續空白，UI 需要自己有 belt-and-suspenders。

## Original Requirement Wording (Baseline)

使用者於 2026-04-20 提出：

- 「不行，question tool 修壞了。沒有字」（附截圖：紅框 Typeundefined error + 空白選項）
- 「去查一下 RCA」
- 「走 plan 修，不要最小修法，可以做完整一點」

## Requirement Revision History

- 2026-04-20: initial draft created via plan-init.ts
- 2026-04-20: proposal 首稿；scope 鎖定 (a)/(b)/(c)/(d) 四塊

## Effective Requirement Description

**(a) Tool framework fix — 系統性**

`Tool.define` 執行 `parameters.parse(args)` 時必須把 parsed result 實際用起來，作為 `execute(...)` 的實際輸入。任何使用 `z.preprocess` / `z.transform` 的 tool 從此直接受益。失敗 case 保留現有 `formatValidationError` 路徑。

**(b) Persisted state.input 用 normalized 形狀**

Tool part 寫進 session 存檔的 `state.input` 必須是 parse 之後的值，不是 LLM 的 raw arguments。這樣：

- UI 渲染（QuestionDock / message-part / TUI Question）直接讀 normalized 形狀，不需要 reverse-engineer 原始 shape。
- Session replay、telemetry、audit trail 全部看到同樣一致的形狀。
- 只 normalize `success` 的 call；validation error 的 call 仍保留 raw（作為除錯證據）。

**(c) Defensive normalization in renderers**

為處理 **已存在** 的舊 session（state.input 仍是 raw），QuestionDock、`message-part.tsx` 的 question renderer、TUI `session/index.tsx` 的 Question component 各自加一層 defensive normalize：

- 若 options 是 `string[]` → 視為 `{label: s, description: s}`
- 若 `header` missing → fallback 到 `question.slice(0, 30)`
- 若 input 是 flat `{question, options, ...}` → 視為 `{questions: [normalizeSingleQuestion(input)]}`

這層 normalize 從 `packages/opencode/src/tool/question.ts` 抽出來共用（或移到 `packages/opencode/src/question/index.ts` 作為 namespace export），前端與 TUI 共用同一份邏輯。

**(d) Regression tests**

- `tool.ts` 一般化 test：任一 tool 用 `z.preprocess` 會收到 normalized args
- `question` tool：
  - flat `{question, options, multiple}` 單題輸入
  - `{questions: [{question, options:[string]}]}` 多題輸入
  - missing `header` 自動補
  - `multiple: true`
  - 已是 canonical shape（無需 transform）仍正確通過
- UI：QuestionDock 用 raw-shape 與 normalized-shape 都能渲染（snapshot / behavior test 皆可）

## Scope

### IN

- [packages/opencode/src/tool/tool.ts](../../packages/opencode/src/tool/tool.ts) — 改用 `parse(args)` 的 return value
- [packages/opencode/src/tool/question.ts](../../packages/opencode/src/tool/question.ts) — 把 `normalizeSingleQuestion` / `normalizeQuestionInput` export 出去供前端/TUI 重用，或搬到 `packages/opencode/src/question/index.ts`
- Session runloop 寫入 `state.input` 的路徑（processor 或 tool part builder）— 把 normalized args 寫進去而不是 raw
- [packages/app/src/components/question-dock.tsx](../../packages/app/src/components/question-dock.tsx) — import defensive normalize
- [packages/ui/src/components/message-part.tsx](../../packages/ui/src/components/message-part.tsx) question renderer（約 1656 起）— import defensive normalize
- [packages/opencode/src/cli/cmd/tui/routes/session/index.tsx](../../packages/opencode/src/cli/cmd/tui/routes/session/index.tsx) Question component（約 2368 起）— import defensive normalize
- Tests：
  - `packages/opencode/src/tool/tool.test.ts` 或 `question.test.ts`：tool-framework preprocess 覆蓋
  - `packages/opencode/src/tool/question.test.ts`：四種輸入形狀覆蓋
  - `packages/opencode/src/question/normalize.test.ts`：單測 normalize 本身
- [specs/architecture.md](../architecture.md) — 在 Tool Framework 段加一句：`Tool.define` 保證 `execute()` 收到 parse/preprocess 後的 args；該成為所有 tool 寫作的默認契約。

### OUT

- **AskUserQuestion (Claude Code SDK 的 deferred tool)** 本身 — 它跟 opencode 內建 `question` tool 是不同 code path，此次不動。
- **Schema 本身重新設計** — `Option` 仍是 `{label, description}`；`Info` 仍有 `header/question/options/multiple/custom`。這次只修 normalize pipeline，不改 contract。
- **回填既有 session 存檔** — 不跑 migration 把歷史 tool part 的 raw input 改成 normalized。舊 session 由 (c) 的 defensive normalize 解決，不動 on-disk 資料。
- **其他 tool 的重新驗證** — 只針對 question 做 regression；其他 tool 不用 preprocess 所以零影響，但不主動再跑一輪 smoke。

### Non-Goals

- 修 Codex 的 tool-call schema 遵循問題（OpenAI function-calling 本來就會偶爾亂來，我們只負責 server 端 robust normalize）。
- 改 tool-call 的錯誤回報 UX（紅框顯示方式）— 那屬於 message rendering 的另一議題。
- 整合 `question-tool-abort-fix` 的任何範圍 — 那個 spec 在 `living`，這裡不碰 abort lifecycle。

## Constraints

- **不得讓原本沒用 preprocess 的 tool 行為改變**。`parse(args)` 對純 `z.object` 會回傳 structurally identical 的物件（或 reference-equal if no optional defaults），但仍需確認。
- **AGENTS.md 第一條：禁止靜默 fallback**。若 normalize 在 UI 層失敗（例如 raw shape 完全無法辨識），要明確 render error，不可顯示空白 dialog 假裝沒事。現行空白 UI 就是「靜默失敗」的反面教材。
- `state.input` 的形狀變更可能影響 telemetry / replay 的下游 reader — 需要 audit 所有讀 `state.input` 的路徑（搜 `state.input` / `part.state.input`）。
- 不在 beta workspace 做；本 repo 測試會直接讀寫 `~/.config/opencode/`，XDG backup 已在 scaffold 前完成（`~/.config/opencode.bak-20260420-0115-question-tool-input-normalization/`）。

## What Changes

- `Tool.define` wrapper 行為改變：`execute()` 收到 parsed 而非 raw。
- Tool part 的 `state.input` 在 session 存檔中從 raw 變 normalized（成功 call）。
- 三個 UI 點（QuestionDock / message-part / TUI Question）從 `props.input` 取值前先過一次 defensive normalize。
- 新增共用 normalize helper、測試。
- `specs/architecture.md` 加入 Tool Framework 契約說明。

## Capabilities

### New Capabilities

- **Tool framework: preprocess-aware execution** — 所有 `z.preprocess` / `z.transform` 的 tool schema 自動生效，未來 tool 作者可放心用 transform 做 input 防呆。
- **Shared question-shape normalizer** — 可供前端 / TUI / server runtime 重用的單一 normalize 函式。

### Modified Capabilities

- **Question tool** — runtime 實際收到 normalized args（而不只是通過 validation）；session 存檔的 state.input 形狀一致化；UI 渲染新舊 session 都穩定。
- **Tool persistence** — tool part 的 `state.input` 契約升級為 parsed-shape。

## Impact

### Code

- `packages/opencode/src/tool/tool.ts`（execute wrapper）
- `packages/opencode/src/tool/question.ts`（export normalize helpers）
- `packages/opencode/src/question/index.ts`（可能新增 `normalize` export，或單獨檔）
- `packages/opencode/src/session/processor.ts`（tool part persistence — 待 design phase 確認實際 write path）
- `packages/app/src/components/question-dock.tsx`
- `packages/ui/src/components/message-part.tsx`
- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`
- 新增測試檔

### APIs

- `Tool.Info.execute()` 的 args 形狀：從「LLM raw」變「schema parsed」。對 tool 作者是 backward-compatible 放鬆（raw 仍 parseable 時行為不變）。

### Systems

- Session storage on-disk 形狀微變（新 session 的 tool part state.input 是 normalized）。舊 session 不動。Telemetry / replay 下游需確認。

### Operators

- 無直接影響。

### Docs

- `specs/architecture.md` Tool Framework 段
- `specs/_archive/question-tool-input-normalization/` 全套 artifacts
- `docs/events/event_<YYYYMMDD>_question-tool-input-normalization.md`（verified 時寫）

### Related Specs

- `specs/_archive/question-tool-abort-fix/`（living）— 範圍完全不同（abort lifecycle vs input normalization），無重疊。
