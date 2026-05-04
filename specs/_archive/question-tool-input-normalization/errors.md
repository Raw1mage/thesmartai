# Errors: question-tool-input-normalization

## Error Catalogue

此 spec 不引入新的 error code；目的是**消除**一類 runtime error 並讓另一類更清楚地表達。下列為相關 error code 的契約、使用者/LLM 可見訊息與復原策略。

## ERR-QT-01: TypeError in Question.ask (PRE-EXISTING, TO BE ELIMINATED)

- **Code**：未正式編碼；症狀是 `TypeError: undefined is not an object (evaluating 'input.questions.length')`
- **Layer**：`packages/opencode/src/question/index.ts:143`（runtime 層）
- **Trigger**：LLM 以 flat shape（沒有外層 `questions` array）呼叫 question tool
- **現行使用者訊息**：webapp 紅框顯示 `Typeundefined is not an object (evaluating 'input.questions.length')`（WebKit 格式）
- **根本原因**：`Tool.define` wrapper 丟掉 `parameters.parse()` return value，`execute()` 收到 raw → `Question.ask({ questions: undefined })` 讀 `.length` 爆 TypeError
- **修後行為**：DD-1 讓 wrapper 用 parsed return value，`z.preprocess` 生效 → flat shape 自動 wrap → TypeError 不再觸發
- **Recovery（pre-fix）**：LLM 看到 tool error 後通常會重試（用不同 shape）；使用者端無法復原，只能等 AI 重試
- **Recovery（post-fix）**：不再發生；若 shape 仍完全無法辨識（TV-3 情境），走 ERR-QT-03 schema-miss 路徑

## ERR-QT-02: Blank QuestionDock (PRE-EXISTING, TO BE ELIMINATED)

- **Code**：未編碼；症狀是 UI 渲染時 tab header + option label 全部空白
- **Layer**：`packages/app/src/components/question-dock.tsx`、`packages/ui/src/components/message-part.tsx`、TUI `session/index.tsx`（UI 層）
- **Trigger**：`state.input` 是 raw shape（options 是 `string[]`、沒 `header`），UI 假設 canonical
- **現行使用者訊息**：空白按鈕、空白選項、無 console error（靜默失敗）
- **根本原因**：同 ERR-QT-01 上游未 normalize；且 UI 無 defensive fallback
- **修後行為**：
  - 新 session：processor 存 normalized，UI 讀到 canonical
  - 舊 session：UI 層 `Question.normalize` defensive 處理，header/label 有 fallback
  - 完全無法辨識的 shape：顯示明確 error UI（ERR-QT-03 的 UI 表徵）
- **Recovery（pre-fix）**：使用者只能按「忽略」→ `QuestionRejectedError` → AI 可能再問一次或改成純文字
- **Recovery（post-fix）**：新/舊 session 皆能渲染；un-normalizable 情境下使用者看到明確訊息、可 copy 回報

## ERR-QT-03: Schema-miss hint (EXISTING, CLARIFIED)

- **Code**：現行 `formatValidationError` 輸出 `[schema-miss:question] ...` 字串 → AI SDK 包成 tool error
- **Layer**：[packages/opencode/src/tool/question.ts:48-65](../../packages/opencode/src/tool/question.ts#L48-L65)
- **Trigger**：LLM 送出的 args 既不是 canonical 也不是 normalize 能救回的形狀（例如 `{baz: 1}`）
- **LLM 可見訊息**：schema-miss hint 字串，列出 canonical shape + normalize 能容忍的形狀
- **使用者可見訊息**：UI 顯示 tool error 紅框
- **本 spec 變更**：
  - DD-4 要求 UI 不再「靜默顯示空白 dialog」；若 parse 都失敗 → 永遠走 tool-error 路徑 → 紅框（已 consistent）
  - 訊息本身不改（現行 hint 已清楚）
- **Recovery**：AI 通常會讀 hint 後重送；使用者無需動作

## ERR-QT-04: ToolRegistry miss at tool-result (NEW EDGE CASE, DEFENSIVE)

- **Code**：無（silent fallback）
- **Layer**：`packages/opencode/src/session/processor.ts`（DD-3 新邏輯）
- **Trigger**：`tool-result` 事件處理時，`ToolRegistry.get(toolName)` 找不到 tool（例如 custom plugin 尚未載入、tool 被刪除等 race）
- **Behavior**：`safeParse` 沒得跑；`normalizedInput = value.input`（raw fallback）
- **側向影響**：該 tool part 的 `state.input` 退化為 raw；UI 的 defensive normalize 仍能渲染
- **Log**：DD-6 observability 要求 processor 在 registry miss 時 `log.debug("tool-result: registry lookup miss, state.input kept raw", { toolName, callID })`
- **Recovery**：無需人工介入；此 case 表徵上等同「沒有 preprocess 的 tool」，行為退化到修前的 raw-shape 存檔
- **與「禁止靜默 fallback」的區分**：AGENTS.md 第一條針對「靜默使用替代路徑**取代使用者預期**的行為」。本 case 是「無法 preprocess 就存 raw，下游 UI 仍能 render」，不是在隱藏錯誤 — 仍走明確 debug log

## ERR-QT-05: Un-normalizable input rendered as empty dialog (REGRESSION GUARD)

- **Code**：無（應被此 spec 阻擋）
- **Trigger**：UI 收到 `Question.normalize(state.input).questions.length === 0` 或 undefined
- **Expected Behavior (after fix)**：三個 UI renderer（QuestionDock / message-part / TUI）必須顯示明確錯誤 UI，例：`Question data unreadable — please report this session ID to maintainer`
- **禁止**：空白 dialog、什麼都不顯示、JS 層 try/catch 吞錯
- **Test Coverage**：tasks.md 4.4 要求此 guard；test-vectors TV-13 涵蓋 un-normalizable case 下 helper 行為
- **Why**：符合 AGENTS.md 第一條 — 查找/載入失敗必須明確報錯，不可靜默退回

## Summary Table

| ID | Severity | Pre-fix | Post-fix |
|---|---|---|---|
| ERR-QT-01 | High (crash) | TypeError bubbled to UI | Eliminated |
| ERR-QT-02 | High (UX) | Blank dialog, silent | Defensive render with fallbacks |
| ERR-QT-03 | Low (informational) | LLM-facing hint | Same (unchanged) |
| ERR-QT-04 | Debug | N/A | Log + raw fallback, UI still renders |
| ERR-QT-05 | Regression guard | N/A | Explicit error UI required |
