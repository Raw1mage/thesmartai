# Handoff: question-tool-input-normalization

## Execution Contract

接此 handoff 的 build agent（自己或 subagent）必須遵守：

- 按 [tasks.md](tasks.md) 的 Phase 1 → 2 → 3 → 4 → 5 順序執行；Phase 1 與 2 可並行但 Phase 3 / 4 依賴 Phase 2 的 `Question.normalize` export
- 每打勾一個 task 就跑 `bun run ~/projects/skills/plan-builder/scripts/plan-sync.ts specs/_archive/question-tool-input-normalization/`
- 每跑完一個 Phase 就更新 `specs/_archive/question-tool-input-normalization/handoff.md` 的 Progress 段（或寫入 event log 的 phase-summary block）
- 不動 `specs/_archive/question-tool-abort-fix/` 的任何檔案（scope 明確區分）
- 不跑 on-disk session migration（out-of-scope）
- 所有 runtime behavior change 都要對應 scenario 的 test 覆蓋（spec.md Acceptance Checks 是 target）
- 禁止在 UI 層用 try/catch 吞錯後 render 空白 dialog — 若 normalize 輸出 `questions.length === 0`，顯式 error UI（AGENTS.md 第一條）

## Required Reads

1. [proposal.md](proposal.md) — 為何做這件事 + 完整 scope
2. [spec.md](spec.md) — 六個 Requirement 的 GIVEN/WHEN/THEN scenarios
3. [design.md](design.md) — 六個 Decision（DD-1..DD-6）+ Risks + Critical Files + Implementation Order
4. [data-schema.json](data-schema.json) — 各種 shape 的契約（canonical / flat / array raw / state.input / normalizer）
5. [idef0.json](idef0.json) + [grafcet.json](grafcet.json) — A1–A5 功能分解 + S0–S7 狀態機（含 A2 子圖展開 normalize helper 內部）
6. [c4.json](c4.json) + [sequence.json](sequence.json) — CP1–CP7 元件 + P1–P4 四種流程（canonical / flat-fix / legacy defensive / un-normalizable error）
7. [test-vectors.json](test-vectors.json) — 各 scenario 的具體 input / expected output pairs
8. [errors.md](errors.md) — 錯誤代碼與復原建議
9. [observability.md](observability.md) — log / metric / alert 覆蓋
10. 主要 code entry points：
    - [tool.ts](../../packages/opencode/src/tool/tool.ts)（DD-1 改動點）
    - [question.ts](../../packages/opencode/src/tool/question.ts)（DD-2 normalize 搬走後變 thin wrapper）
    - [question/index.ts](../../packages/opencode/src/question/index.ts)（DD-2 新增 Question.normalize）
    - [processor.ts:835-856](../../packages/opencode/src/session/processor.ts#L835-L856)（DD-3 tool-result handler）
    - [question-dock.tsx](../../packages/app/src/components/question-dock.tsx)（DD-4 webapp defensive）
    - [message-part.tsx:1656](../../packages/ui/src/components/message-part.tsx#L1656)（DD-4 history renderer）
    - [session/index.tsx:2368](../../packages/opencode/src/cli/cmd/tui/routes/session/index.tsx#L2368)（DD-4 TUI）

## Stop Gates In Force

必須暫停、詢問使用者的情況：

- **Phase 3 Audit 結果發現 `normalizeToolCallInput` 與新 normalize 行為衝突**（例如 message-v2.ts 已經做了某種 input shaping）— 停下來討論要不要合併
- **Phase 4 發現三個 UI renderer 實際用的 Question type 不一致**（webapp 用 `@opencode-ai/sdk/v2`、TUI 用 internal type）— 停下來決定 import 路徑
- **任一 test 失敗無法用小改動修好**（不是 flake）— 停下來對齊
- **smoke test 發現新 session 渲染壞掉**（例如 z.preprocess 本身 bug）— 停下來
- **scope 飄移**：發現修這個的過程暴露其他 pre-existing bug（例如 AskUserQuestion 也壞） — 停下來；若要擴 scope 走 `extend` mode 建新 spec
- **destructive op**：任何會 rm tracked file、force-push、動 `~/.config/opencode/` 的動作

## Execution-Ready Checklist

開始 Phase 1 前確認：

- [ ] XDG backup 已存在：`~/.config/opencode.bak-20260420-0115-question-tool-input-normalization/`
- [ ] 本 spec 處於 `planned` 狀態（`.state.json.state === "planned"`）
- [ ] `specs/_archive/question-tool-abort-fix/` 狀態是 `living`，不會被本次工作改動
- [ ] `git status` 乾淨或只有本 spec 的 artifact 未 commit
- [ ] 跑 `bun test` 基線一次，確認既有 test 綠（作為 regression baseline）

## Progress Log

<!-- build-mode 執行時在此補：`Phase N complete YYYY-MM-DD — <summary>` -->

## Validation Evidence (由 build agent 進入 verified 前填寫)

- [ ] Phase 1 test 綠：`bun test packages/opencode/src/tool/tool.test.ts` 輸出
- [ ] Phase 2 test 綠：`bun test packages/opencode/src/question/` + `tool/question.test.ts` 輸出
- [ ] Phase 3 test 綠：`bun test packages/opencode/src/session/` 輸出
- [ ] Phase 4 smoke：手動 reload legacy session 的截圖 / log
- [ ] Phase 5：`specs/architecture.md` diff + `docs/events/event_*.md` 連結
- [ ] `git grep "normalizeQuestionInput\|normalizeSingleQuestion"` 輸出（應只剩 normalize.ts + test）

## Notes

- QuestionDock 的 `request.questions` 與 tool part 的 `state.input.questions` 不是同一個 object — request 是 Bus 事件上的 payload、state.input 是 session 存檔。兩者最終都需要 normalize 處理（request 在 publish 前透過 `Question.ask` 內部 `info.questions = input.questions` 已是 normalized；state.input 靠 DD-3 normalize）。前端 defensive normalize 是 belt-and-suspenders，正式情況新 session 不需要 fallback 才對。
- 不確定 `packages/opencode/src/session/message-v2.ts` 的 `normalizeToolCallInput` 做什麼；Phase 3.3 audit 時讀清楚再決定要不要合併或保留。
