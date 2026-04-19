# Design: question-tool-input-normalization

## Context

Opencode 的 tool framework 使用 zod schema 宣告 tool parameters。`Tool.define` wrapper 在 [packages/opencode/src/tool/tool.ts:58-85](../../packages/opencode/src/tool/tool.ts#L58-L85) 接住 LLM 的 raw args 做 validation，成功後呼叫 tool 的 `execute(args, ctx)`。QuestionTool 利用 `z.preprocess(normalizeQuestionInput, ...)` 試圖把 Codex/OpenAI 常見的幾種不合規形狀（flat 單題、options 是 string[]、缺 header）coerce 回 canonical shape。

但 wrapper 只呼叫 `.parse(args)` 做 validation，丟掉 return value；`execute()` 收到的仍是 raw。而 session runloop [packages/opencode/src/session/processor.ts:758-766](../../packages/opencode/src/session/processor.ts#L758-L766) 也把 `value.input`（LLM raw）直接寫入 tool part `state.input`，UI 渲染 (`QuestionDock`、`message-part.tsx`、TUI `session/index.tsx`) 又假設讀到的一定是 canonical shape — 三層都不做 normalize，zod preprocess 白寫。

## Goals / Non-Goals

### Goals

- `Tool.define` wrapper 保證 `execute()` 收到 parsed 後的 args，從根本讓 `z.preprocess` / `z.transform` / `z.default` 生效
- Session 存檔的 `state.input` 對 `completed` 的 tool call 一律紀錄 normalized shape
- 三處 UI renderer 以單一共用 normalize helper 處理 raw 與 normalized 兩種 shape，向前兼容舊 session
- Tests 覆蓋四種 question 輸入形狀 + tool-framework preprocess 泛型情境
- `specs/architecture.md` 留下 Tool Framework 契約段

### Non-Goals

- 不重新設計 `Question.Option` / `Question.Info` 的 zod schema 本身
- 不碰 AskUserQuestion（Claude Code SDK deferred tool，另一 code path）
- 不跑 migration 改寫歷史 session 存檔
- 不動 `question-tool-abort-fix` 的 abort lifecycle

## Decisions

- **DD-1** `Tool.define` wrapper 改成 `const parsed = toolInfo.parameters.parse(args)`、後續傳 `parsed` 進 `execute(parsed, ctx)`。Validation error 路徑保持現行行為（`formatValidationError` / invalid-argument fallback message 不變）。
- **DD-2** Normalize helper 搬到 `packages/opencode/src/question/index.ts` 作為 `Question.normalize(input)` / `Question.normalizeSingle(q)` namespace export。`packages/opencode/src/tool/question.ts` 不再自訂 normalize，直接用 `z.preprocess(Question.normalize, ...)`。前端 `packages/app/src/components/question-dock.tsx` / `packages/ui/src/components/message-part.tsx` / TUI `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` 各自 import `Question.normalize` 做 defensive normalize。
- **DD-3** `state.input` 於 processor 寫入 `completed`/`error` tool part 時的處理：
  - `tool-result`（成功）→ 使用 registry 查回 tool 的 `parameters`，`safeParse(value.input)`，成功用 parsed、失敗 fallback 到 raw（理論上不可能，因為已 success，但 defensive）
  - `tool-error` → 保留 raw（除錯證據）
  - `tool-call`（running）→ **不改**，仍寫 raw。理由：running 狀態短暫、僅在少數 race 下被 UI 看到；避免額外 async registry lookup 拖慢 streaming。UI 本身已有 defensive normalize 能 handle。
- **DD-4** Normalize helper 契約：
  - Input 為 `null` / non-object → 原樣返回，消費端自行決定怎麼處理
  - Input 是 flat `{question: string, ...}` → 包成 `{questions: [normalizeSingle(input)]}`
  - Input 已有 `questions: array` → map 每個元素過 `normalizeSingle`
  - `normalizeSingle`：補 header（若缺，`question.slice(0, 30)`）；options 是 `string[]` → `[{label:s, description:s}]`；options 是 `[{label|value, description|detail|explanation}]` → 保留 label/description，缺 description 時 fallback 到 label
  - 絕不吞錯：helper 純資料轉換，失敗讓消費端看到原資料（符合 AGENTS.md 第一條）
- **DD-5** 新增測試檔策略：
  - `packages/opencode/src/tool/tool.test.ts` 新增（若不存在）— 覆蓋 `Tool.define` preprocess/transform/default 的 runtime 生效、canonical 行為不變、ZodError 路徑不變
  - `packages/opencode/src/question/normalize.test.ts` 新檔 — 覆蓋 `Question.normalize` 純函式
  - `packages/opencode/src/tool/question.test.ts` 新增或擴充 — 覆蓋四種實際輸入形狀走完 QuestionTool 流程
- **DD-6** `specs/architecture.md` 在既有 Tool Framework 相關段下新增子段 `#### Tool.define contract: execute receives parsed args`，並在 `state.input` 相關段落（若有）註記 completed 存 normalized、error 存 raw。若無對應段，於文末開一段 `## Tool Framework Contract` 並鏈本 spec。

## Decision Rationale (DD-1 deep dive)

替代方案：

- **(A) 讓每個 tool 自己在 execute 裡再 parse 一次**
  問題：重複 parse 對有 side-effect 的 preprocess 會執行兩次；不同 tool 作者可能忘記做；違反 DRY。否決。
- **(B) 改 `z.preprocess` 為 pre-call normalize 函式直接在 tool 寫明**
  問題：放棄 zod transform 的宣告式優勢；未來新 tool 要繼續複製樣板。否決。
- **(C) 目前方案 — wrapper 改用 parsed return value**
  優點：一行修正，所有現有 + 未來 tool 自動受益；與 zod semantic 一致；formatValidationError 路徑不變。**採用。**

## Decision Rationale (DD-3 deep dive)

替代方案：

- **(A) 在 tool.ts wrapper 裡把 parsed 塞回 ctx 某欄位**
  問題：processor 拿 tool 結果時讀不到；要另外設計通訊管道。複雜。否決。
- **(B) execute 回傳新增欄位 `normalizedInput`**
  問題：破壞現有 `{title, output, metadata}` 契約；所有 tool handler 要改。否決。
- **(C) Processor 自己用 ToolRegistry 查 schema 重 parse**
  優點：完全 decoupled；tool handler 零改動；registry lookup 已被其他 processor 路徑使用（例如 doom-loop narration）。成本是一次 `safeParse`，但 tool-result 本來就在 async boundary，延遲可忽略。**採用。**
- **(D) 加 cache**（`Map<toolName, zodSchema>`）
  若效能需要可作為後續優化，但目前 tool 數量 ~20，處理 tool-result 頻率遠低於 message token streaming，不先做。

## Risks / Trade-offs

- **R-1: `.parse()` 對某些 zod 版本可能回傳 reference-equal 或 structurally 不同的物件**
  Mitigation：test 覆蓋「canonical 輸入行為不變」情境；若 deep-equal 不成立但行為正確，接受。
- **R-2: 其他 tool 若之前誤用了 raw args 與 parsed args 行為差異（例如忽略 optional default）而依賴 raw 形狀**
  Mitigation：grep 掃所有 `Tool.define(..., { parameters: z.preprocess|z.transform`，確認除 QuestionTool 外無其他預處理；若有，逐一複核（目前已知只有 QuestionTool 在用）。
- **R-3: `state.input` 形狀變更影響 telemetry / replay / shared-context 下游 reader**
  Mitigation：grep `state.input` / `part.state.input` 所有 reader，確認讀取方式能接受 normalized（多半是 serialize 給 UI 或 shared-context，直接用 normalized 更一致）。已知 `packages/opencode/src/session/message-v2.ts`、`shared-context.ts`、`shell-runner.ts` 會讀，需檢查。
- **R-4: 舊 session 存檔的 raw shape 在 QuestionDock 如果有不合預期 shape（例如 `null`、`undefined`、`[]`）**
  Mitigation：UI 層 normalize helper 的契約明確（DD-4）— 無法辨識時讓消費端看到 empty / raw，UI 層再 fallback 到 error UI。
- **R-5: 修 Tool.define 時不小心讓 formatValidationError 的訊息變成 generic**
  Mitigation：spec.md Scenario「validation error path preserved」由 test 顯式覆蓋。
- **R-6: Processor 加 ToolRegistry lookup 在 tool-result 處理時可能遇到 custom / plugin tool 尚未載入的 race**
  Mitigation：`safeParse` 失敗 fallback raw，狀態仍可寫入；這是罕見 edge case，raw 存檔不會比現狀差。

## Critical Files

### Tool framework core

- [packages/opencode/src/tool/tool.ts](../../packages/opencode/src/tool/tool.ts) — `Tool.define` wrapper execute；**DD-1 改動點**
- [packages/opencode/src/tool/registry.ts](../../packages/opencode/src/tool/registry.ts) — tool registry，供 processor 查 schema
- [packages/opencode/src/tool/question.ts](../../packages/opencode/src/tool/question.ts) — QuestionTool，移除 local normalize、改 import `Question.normalize`

### Question namespace

- [packages/opencode/src/question/index.ts](../../packages/opencode/src/question/index.ts) — 新增 `Question.normalize` / `Question.normalizeSingle` export（DD-2）

### Session processor

- [packages/opencode/src/session/processor.ts](../../packages/opencode/src/session/processor.ts) — `tool-result` handler 加 ToolRegistry lookup + safeParse（DD-3）

### UI renderers

- [packages/app/src/components/question-dock.tsx](../../packages/app/src/components/question-dock.tsx) — import `Question.normalize`，defensive 展開
- [packages/ui/src/components/message-part.tsx](../../packages/ui/src/components/message-part.tsx) question renderer（約 1656 起） — 同上
- [packages/opencode/src/cli/cmd/tui/routes/session/index.tsx](../../packages/opencode/src/cli/cmd/tui/routes/session/index.tsx) Question component（約 2368 起） — 同上

### State.input readers (audit, possibly no-change)

- [packages/opencode/src/session/message-v2.ts](../../packages/opencode/src/session/message-v2.ts):829/839/850 — already passes through `normalizeToolCallInput`；需確認該函式與新 normalize 的關係
- [packages/opencode/src/session/shared-context.ts](../../packages/opencode/src/session/shared-context.ts):131 — 讀 completed 的 `state.input` 進 shared-context；normalized 對 context 更乾淨
- [packages/opencode/src/session/shell-runner.ts](../../packages/opencode/src/session/shell-runner.ts):128 — 讀 `part.state.input`；與 QuestionTool 無關

### Architecture doc

- [specs/architecture.md](../architecture.md) — 新增 Tool Framework contract 段（DD-6）

### Tests

- `packages/opencode/src/tool/tool.test.ts` — **新增或擴充**
- `packages/opencode/src/question/normalize.test.ts` — **新檔**
- `packages/opencode/src/tool/question.test.ts` — **新增或擴充**

### Prior related spec

- [specs/question-tool-abort-fix/](../question-tool-abort-fix/) — `living`，abort lifecycle + cache key + reason telemetry；本 spec 不碰重疊範圍

## Implementation Order (建議 build-mode 遵循)

1. **Phase 1: Tool framework fix (DD-1)**
   - 改 `Tool.define` execute wrapper 用 parsed return value
   - 新增 `tool.test.ts` 覆蓋 preprocess/transform/default 生效、canonical 不變、ZodError 不變
   - 驗：跑 `bun test packages/opencode/src/tool/tool.test.ts` 全綠
2. **Phase 2: Question normalize 抽取（DD-2）**
   - 把 `normalizeQuestionInput` / `normalizeSingleQuestion` 搬到 `question/index.ts` 作為 `Question.normalize` / `Question.normalizeSingle`
   - 改 `tool/question.ts` import 新 export
   - 新檔 `question/normalize.test.ts` 單測 helper
   - 驗：grep 確認 normalize 函式單一來源；`bun test question/normalize.test.ts`、`tool/question.test.ts`（四種形狀）全綠
3. **Phase 3: state.input persistence (DD-3)**
   - 改 processor tool-result handler，加 ToolRegistry lookup + safeParse
   - 擴充 processor 或 question tool 整合測試驗證存檔形狀
   - 驗：mock processor stream 餵 flat shape → 存檔 state.input 是 normalized
4. **Phase 4: UI defensive normalize (DD-4)**
   - `question-dock.tsx` import 並用 `Question.normalize`
   - `message-part.tsx` question renderer 同上
   - TUI `session/index.tsx` Question 同上
   - 驗：snapshot 或 behavior test；或 webapp smoke：手動編輯一個 tool part state.input 回到 raw shape，reload 能正常 render
5. **Phase 5: architecture.md + docs/events (DD-6)**
   - 補 architecture.md Tool Framework contract 段
   - 寫 `docs/events/event_<YYYYMMDD>_question-tool-input-normalization.md`
   - 驗：文字 review

Phase 1–2 可並行做；Phase 3 依賴 Phase 2；Phase 4 依賴 Phase 2；Phase 5 最後。
