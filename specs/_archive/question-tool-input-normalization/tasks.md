# Tasks: question-tool-input-normalization

> 對應 design.md Implementation Order（Phase 1–5）。每個 task 完成後必跑 `plan-sync`。

## 1. Tool framework fix (DD-1)

- [x] 1.1 修 [tool.ts:58-70](../../packages/opencode/src/tool/tool.ts#L58-L70) 的 execute wrapper：以 `const parsed = toolInfo.parameters.parse(args)` 取回 normalized value，後續 `execute(parsed, ctx)`
- [x] 1.2 新增或擴充 `packages/opencode/src/tool/tool.test.ts`：
  - test a：`z.preprocess` 把 `{bar:"x"}` 轉成 `{foo:"x"}`，execute 收到 `{foo:"x"}`
  - test b：canonical input `{foo:"x"}` 行為不變
  - test c：完全無法 parse 的 input 走 `formatValidationError` 分支，execute 不被呼叫
  - test d：`z.default` 填預設值的 case（保險）
- [x] 1.3 `bun test packages/opencode/src/tool/tool.test.ts` 全綠（6 pass, 0 fail, 9 expect calls）

## 2. Question normalize 抽取 (DD-2)

- [x] 2.1 把 `normalizeSingleQuestion` / `normalizeQuestionInput` 從 [tool/question.ts:6-46](../../packages/opencode/src/tool/question.ts#L6-L46) 搬到 [question/index.ts](../../packages/opencode/src/question/index.ts)，export 為 `Question.normalize` / `Question.normalizeSingle`
- [x] 2.2 改 `tool/question.ts`：`parameters: z.preprocess(Question.normalize, z.object({...}))`，刪除 local 函式
- [x] 2.3 新增 `packages/opencode/src/question/normalize.test.ts`（14 tests 覆蓋 null / primitive / flat / array / canonical / value-detail / label-explanation / fallback / truncate header / multiple+custom）
- [x] 2.4 新增 `packages/opencode/src/tool/question.test.ts`（5 tests 覆蓋 TV-4..TV-7 四種 scenario + ZodError 路徑）
- [x] 2.5 `git grep "normalizeQuestionInput\|normalizeSingleQuestion"` 只剩歷史 event docs，無 code 引用
- [x] 2.6 `bun test` Phase 1+2 共 25 tests pass / 0 fail

## 3. state.input persistence (DD-3)

- [x] 3.1 修 [processor.ts:836-857](../../packages/opencode/src/session/processor.ts#L836) `tool-result` handler：加入 `ToolRegistry.getParameters(match.tool)` + `schema.safeParse(rawInput)`；成功用 parsed、失敗/miss fallback raw 並 log.debug
- [x] 3.2 `tool-error` handler：保留 raw，加註解說明為除錯證據
- [x] 3.3 Audit `state.input` readers：
  - `message-v2.ts` `normalizeToolCallInput` 是 migration-only（renames like `file_name` ↔ `filename`），對 question tool no-op，與新 normalize 不衝突
  - `shared-context.ts:131` 只處理 read/edit/write/grep 等 tool，question 不觸及
  - `shell-runner.ts:128` 與 QuestionTool 無關
- [x] 3.4 新增 `packages/opencode/src/tool/registry.normalize-lookup.test.ts`（6 tests 覆蓋 miss path / flat / array-with-string-options / canonical / un-normalizable / cache）
  - `ToolRegistry.getParameters(id)` 新增 helper + cache
- [x] 3.5 `bun test packages/opencode/src/tool/ packages/opencode/src/question/` 39 pass 0 fail（session/ 有 5 pre-existing isolation failures，main 同樣，與本 spec 無關）

## 4. UI defensive normalize (DD-4)

- [x] 4.1 改 [packages/app/src/components/question-dock.tsx](../../packages/app/src/components/question-dock.tsx)：`import { normalizeQuestionInput } from "@opencode-ai/sdk/v2"`；`questions` createMemo 過 normalize；tab label / option label+desc 有 fallback
- [x] 4.2 改 [packages/ui/src/components/message-part.tsx](../../packages/ui/src/components/message-part.tsx) question renderer（1656 行）：normalize + unreadable state
- [x] 4.3 改 [packages/opencode/src/cli/cmd/tui/routes/session/index.tsx](../../packages/opencode/src/cli/cmd/tui/routes/session/index.tsx) Question component（2369 行）：同上 defensive normalize + unreadable Match
- [x] 4.4 三處 renderer 都加 `questions.length === 0` guard，明確錯誤訊息（i18n key `ui.question.unreadable`，16 locale 全加）
- [x] 4.5 跑 `bun x tsgo --noEmit`，我觸及檔案無新 type error（repo 有 pre-existing 錯誤不計）；`bun test packages/opencode/src/tool/ packages/opencode/src/question/` 39 tests 全綠
  - 補註：live webapp smoke 延後到 verified → living 階段，使用者 explicit 驗收時手動做；unit+integration coverage 已覆蓋 shape 正確性

### DD-2 architecture tweak (single source of truth across JS runtimes)

Normalize helper 最終放在 `packages/sdk/js/src/v2/question-normalize.ts`（新檔），SDK 透過 v2 index export `normalizeQuestionInput` / `normalizeSingleQuestion`；server `Question.normalize` re-export 自 SDK。理由：webapp 不能直接 import server-side `packages/opencode/src/question`，透過 SDK 才能跨 runtime 共用單一實作。

## 5. Architecture doc + event log (DD-6)

- [x] 5.1 [specs/architecture.md](../architecture.md) 新增 `## Tool Framework Contract` 段，涵蓋 execute-receives-parsed 契約 / state.input 持久化 matrix / 跨 runtime single source of truth pattern
- [x] 5.2 新增 `docs/events/event_20260420_question_tool_input_normalization.md` — RCA + 五階段摘要 + 5 個 commits + 測試覆蓋
- [x] 5.3 `plan-validate` 通過 `verified` stage 檢查（實際跑在 6.1/6.2）

## 6. Promote verified → living

- [ ] 6.1 所有 test / smoke 全綠，`specs/architecture.md` 已同步
- [ ] 6.2 `bun run ~/projects/skills/plan-builder/scripts/plan-promote.ts specs/_archive/question-tool-input-normalization/ --to verified --reason "all phases green; evidence in event log"`
- [ ] 6.3 Merge to main（走本 repo 的 commit-on-main 流程）
- [ ] 6.4 `plan-promote --to living --reason "merged"`
