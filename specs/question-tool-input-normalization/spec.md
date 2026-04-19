# Spec: question-tool-input-normalization

## Purpose

讓 opencode tool framework 的 input normalization pipeline 從頭到尾貫通：tool 執行時收到 zod preprocess 後的 args、session 存檔記錄 normalized shape、所有 UI renderer 在讀到 raw 或 normalized 任一形狀時都能正確渲染。具體修掉 2026-04-20 在 cisopro session 上觀察到的 `TypeError` + 空白 QuestionDock 故障。

## Requirements

### Requirement: Tool.define guarantees execute receives parsed args

`Tool.define` wrapper 執行 `parameters.parse(args)` 成功時，必須將 return value 實際傳給內部 `execute(parsed, ctx)`。任何使用 `z.preprocess` / `z.transform` / `z.default` 的 parameter schema 從此 runtime 生效。

#### Scenario: z.preprocess transform is honored

- **GIVEN** 一個用 `Tool.define` 建立的 tool，其 `parameters` 是 `z.preprocess(normalize, z.object({ foo: z.string() }))`，且 `normalize` 會把 `{bar: "x"}` 轉成 `{foo: "x"}`
- **WHEN** LLM 呼叫該 tool 時傳入 `{bar: "x"}`
- **THEN** tool 的 `execute()` 收到的 args 是 `{foo: "x"}`（normalized），不是 `{bar: "x"}`（raw）

#### Scenario: canonical input passes through unchanged

- **GIVEN** 同上 tool
- **WHEN** LLM 傳入已是 canonical shape 的 `{foo: "x"}`
- **THEN** `execute()` 收到的 args 結構上等於 `{foo: "x"}`，行為與修前一致

#### Scenario: validation error path preserved

- **GIVEN** 同上 tool
- **WHEN** LLM 傳入完全無法 parse 的 `{baz: 123}`（normalize 也救不回來）
- **THEN** `parse(args)` 丟出 `ZodError`
- **AND** 若 tool 有 `formatValidationError`，包成 human-readable error
- **AND** `execute()` **不**被呼叫
- **AND** 錯誤路徑與修前完全一致（no regression）

### Requirement: QuestionTool normalizes flat and string-option inputs

Question tool 的 `normalizeQuestionInput` 現有邏輯在 runtime 真的生效，涵蓋 Codex 常見的兩種 noncompliant shape。

#### Scenario: flat single-question input wraps into questions array

- **GIVEN** LLM 呼叫 question tool，input 為 `{ question: "X?", options: ["A","B","C"], multiple: false }`（沒有外層 `questions`）
- **WHEN** tool 執行
- **THEN** `Question.ask` 收到的 `questions` 是一個長度 1 的 array
- **AND** array[0] 有 `question: "X?"`、`header: "X?"`（自動 slice 到前 30 字）、`options: [{label:"A",description:"A"}, {label:"B",description:"B"}, {label:"C",description:"C"}]`、`multiple: false`
- **AND** 不爆 `TypeError: undefined is not an object (evaluating 'input.questions.length')`

#### Scenario: string options coerced into {label, description}

- **GIVEN** input 為 `{ questions: [{ question: "X?", options: ["A","B"], multiple: false }] }`
- **WHEN** tool 執行
- **THEN** 每個 option 變成 `{label: s, description: s}`
- **AND** `header` 若 missing，自動補 `question.slice(0, 30)`

#### Scenario: already-canonical input passes through unchanged

- **GIVEN** input 為 `{ questions: [{ question:"X?", header:"X", options:[{label:"A",description:"desc"}], multiple:false }] }`
- **WHEN** tool 執行
- **THEN** `Question.ask` 收到的 questions 結構上等於輸入（deep equal，無意外欄位增刪）

#### Scenario: multi-question with multiple=true

- **GIVEN** input 有兩題，第一題 `multiple: true`，options 是 `["A","B","C"]`
- **WHEN** tool 執行並正常 resolve
- **THEN** 每題都完成 normalize，`multiple: true` 保留

### Requirement: state.input persisted as normalized shape for successful calls

`tool-result`（status `completed`）寫入 session 存檔的 `state.input` 必須是 normalized shape。`tool-error`（status `error`）保留 raw（為除錯證據）。

#### Scenario: successful tool call persists normalized input

- **GIVEN** LLM 用 flat shape 呼叫 question tool 且使用者正常作答、tool resolve 成功
- **WHEN** processor 處理 `tool-result` 事件
- **THEN** session 存檔的 tool part `state.input` 是 `{ questions: [{question, header, options: [{label, description}], multiple}] }`
- **AND** 不是原始 flat shape

#### Scenario: failed tool call preserves raw input

- **GIVEN** LLM 用無法 normalize 的形狀呼叫（例如 `{baz: 1}`）
- **WHEN** processor 處理 `tool-error`
- **THEN** state.input 保留 raw（用於除錯）
- **AND** state.status = "error"

#### Scenario: other tools unaffected

- **GIVEN** 一個沒用 `z.preprocess` 的 tool（如 BashTool），LLM 送 canonical input
- **WHEN** processor 處理 `tool-result`
- **THEN** `state.input` 與修前相同（behavior-identical for pure `z.object` schemas）

### Requirement: UI renderers defensively normalize legacy raw shape

QuestionDock、message-part.tsx question renderer、TUI session Question component 在讀 `state.input` 時，必須能處理 raw shape（舊 session）與 normalized shape（新 session）兩者。

#### Scenario: QuestionDock renders raw-shape message from legacy session

- **GIVEN** 一個舊 session，tool part `state.input` 是 `{ questions: [{question:"X?", options:["A","B"], multiple:false}] }`（沒 header、options 是 string[]）
- **WHEN** 使用者打開該 session，QuestionDock render
- **THEN** tab 顯示 `"X?".slice(0,30)` 作 fallback header
- **AND** 每個 option 按鈕顯示字串本身作 label
- **AND** 無 console error、無 undefined render

#### Scenario: QuestionDock renders normalized-shape message from new session

- **GIVEN** 新 session，state.input 是 normalized
- **WHEN** render
- **THEN** tab 用 `q.header`，option 用 `opt.label` / `opt.description`，行為與修前一致

#### Scenario: message-part.tsx question renderer mirrors QuestionDock behavior

- **GIVEN** 同上兩種 shape
- **WHEN** webapp 歷史訊息列表 render 該 tool part
- **THEN** question 與 answers 正常顯示，header / label 有 fallback

#### Scenario: TUI Question component mirrors behavior

- **GIVEN** 同上兩種 shape
- **WHEN** TUI session route render 該 tool part
- **THEN** question 與 answers 正常顯示

### Requirement: Shared normalize helper is the single source of truth

`normalizeQuestionInput` / `normalizeSingleQuestion` 必須從 `packages/opencode/src/tool/question.ts` 搬到 `packages/opencode/src/question/index.ts` 作為 `Question.normalize` / `Question.normalizeSingle` namespace export。Tool、前端 QuestionDock、message-part、TUI session 都 import 同一份。

#### Scenario: single source of truth

- **GIVEN** helper 實作被搬至 `Question` namespace
- **WHEN** 任何一處消費端（tool/question.ts、question-dock.tsx、message-part.tsx、tui session/index.tsx）import 並呼叫
- **THEN** 呼叫的是同一份 implementation
- **AND** 沒有 copy-paste 複本在其他檔案

#### Scenario: no silent fallback on un-normalizable input

- **GIVEN** helper 收到一個完全無法辨識的 shape（例如 `null`、`42`、`{}`）
- **WHEN** 呼叫 helper
- **THEN** 回傳值保留原樣 / 空結構，由消費端自行決定如何顯示（但不得吞錯）
- **AND** 消費端收到 questions.length === 0 時必須 render 明確 error UI，不可呈現空白 dialog 假裝沒事（符合 AGENTS.md 第一條：禁止靜默 fallback）

### Requirement: architecture.md documents Tool Framework contract

`specs/architecture.md` 新增或更新一段 Tool Framework 契約文件，明列：

- `Tool.define` 保證 `execute(args, ctx)` 收到的 `args` 是 `parameters.parse()` 後的值
- `z.preprocess` / `z.transform` / `z.default` 於 runtime 生效
- Tool 作者不得自行 re-parse args（否則 double-parse 可能重覆執行 side-effect transform）
- `state.input` 於 `completed` 狀態記錄 normalized shape、`error` 狀態保留 raw shape

#### Scenario: contract section present

- **GIVEN** spec 進入 `verified` state 前
- **WHEN** 讀 `specs/architecture.md`
- **THEN** 有一段明確標題（例如 `### Tool Framework: execute() receives parsed args`）
- **AND** 鏈到本 spec 的路徑 `specs/question-tool-input-normalization/`

## Acceptance Checks

1. `bun test packages/opencode/src/tool/question.test.ts` 全綠，涵蓋四種輸入形狀
2. `bun test packages/opencode/src/tool/tool.test.ts` 包含新增的 preprocess-aware execute 覆蓋
3. `bun test packages/opencode/src/question/normalize.test.ts` 或等價檔覆蓋 helper 本身
4. Smoke：在 beta worktree 跑起 webapp，人為重現 flat shape 輸入、字串 options 輸入，各渲染正常
5. 檢查 `git grep normalizeQuestionInput | grep -v test` 只剩 `packages/opencode/src/question/index.ts`（單一來源）
6. `specs/architecture.md` 存在 Tool Framework 契約段落並鏈到本 spec
