# Implementation Spec

## Goal

- 優化 Codex subagent context dispatch（fork + checkpoint），正式化四種 agent taxonomy，並實作 Daemon agent 架構。

## Scope

### IN

- Codex fork dispatch：`task.ts` 傳遞 parent responseId，`prompt.ts` 條件跳過 parentMessagePrefix，`llm.ts` 暴露 getCodexResponseId
- Checkpoint-based dispatch：`task.ts` 在 non-Codex dispatch 時嘗試讀取 parent checkpoint 作為 prefix base
- Subagent taxonomy 文件化：Executor / Researcher / Cron / Daemon 四種類型的語意與合約
- Subagent model tier routing：根據 subagent_type 自動選擇 model 等級（small / parent-inherit），可配置
- Daemon agent 實作：DaemonStore、condition loop、Bus event 發布、daemon restart recovery
- task-worker-continuation.ts：daemon kind 排除在 completion handoff 之外
- Parallel subagent 可行性評估文件（design addendum）

### OUT

- 修改 Cron 排程機制
- 修改 task() tool 的外部 schema（不破壞現有呼叫）
- Anthropic/Gemini context dispatch 路徑
- Parallel subagent 完整實作

## Assumptions

- `codexSessionState` 在 `llm.ts` 中是 module-level Map，可安全暴露 getter
- Daemon session 的條件評估可以不依賴 LLM（native watch + pattern match）作為初期實作
- DaemonStore 的 recovery 可以沿用 cron 的 `recoverSchedules()` 模式

## Stop Gates

- Codex fork 實作前必須確認 hash bypass 策略不會造成 stale responseId 注入（audit `llm.ts:586-616`）
- Daemon 實作前必須確認 ProcessSupervisor 支援 `kind="daemon"` 不衝突現有 kind 列表
- Parallel subagent 任何實作前必須完成 race condition audit（design addendum 完成才能解鎖）

## Critical Files

- `packages/opencode/src/tool/task.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/compaction.ts`
- `packages/opencode/src/daemon/index.ts`
- `packages/opencode/src/bus/subscribers/task-worker-continuation.ts`
- `packages/opencode/src/process/supervisor.ts`
- New: `packages/opencode/src/daemon/agent-daemon.ts`
- `specs/architecture.md`

## Structured Execution Phases

- **Phase 1: Codex Fork Dispatch** — 暴露 `LLM.getCodexResponseId()`，在 `task.ts` 讀取並傳遞給 child session，`prompt.ts` 條件跳過 parentMessagePrefix，`llm.ts` first-call hash bypass
- **Phase 2: Checkpoint-Based Dispatch** — 在 `task.ts` dispatch 時呼叫 `loadRebindCheckpoint(parentSessionID)`，有則組合成精簡 prefix，無則 fallback
- **Phase 3: Subagent Taxonomy Formalization** — 在 `task.ts` schema 中正式標記四種類型語意，更新 `specs/architecture.md`；加入 model tier routing（researcher/daemon → small model，coding/executor → parent model，可配置覆寫）
- **Phase 4: Daemon Agent Implementation** — 實作 `agent-daemon.ts`（DaemonStore + condition loop + Bus publish），整合 `daemon/index.ts` recovery，更新 `task-worker-continuation.ts` 排除 daemon kind
- **Phase 5: Parallel Subagent Feasibility** — 完成 race condition audit，寫成 design addendum，決定是否及如何放寬 single-child invariant

## Validation

- Phase 1：`[WS-REQUEST]` log 顯示 Codex subagent 第一 round payload 不含 parent history messages
- Phase 1：non-Codex dispatch 行為不變（regression：stable prefix 仍然注入）
- Phase 2：有 checkpoint 時，child first-round input token count < 10K（log 確認）
- Phase 2：無 checkpoint 時，fallback 到 full history，行為與現有一致
- Phase 3：`specs/architecture.md` 更新後與實際 module 結構一致
- Phase 4：`ProcessSupervisor.snapshot()` 在 daemon 執行中包含 daemon session entry
- Phase 4：Bus event 在條件觸發後 5 秒內送達 operator
- Phase 4：daemon restart 後 daemon session 自動恢復，無需手動干預
- Phase 5：design addendum 記錄明確的 go/no-go 決定與理由

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
