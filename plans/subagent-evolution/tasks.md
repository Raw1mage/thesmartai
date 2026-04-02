# Tasks

## 1. Codex Fork Dispatch

- [ ] 1.1 在 `llm.ts` 暴露 `LLM.getCodexResponseId(sessionID): string | undefined`（從 codexSessionState 讀取）
- [ ] 1.2 在 `task.ts` dispatch 時，若 `model.providerId === "codex"`，讀取 parent responseId
- [ ] 1.3 child session 建立時，將 parent responseId 注入 child 的 codexSessionState 作為初始種子
- [ ] 1.4 在 `prompt.ts` child session startup，偵測 codexForkSeed 存在時跳過 parentMessagePrefix 注入
- [ ] 1.5 `llm.ts` first-call hash bypass：seeded responseId 的第一次呼叫不做 optionsHash 比對，直接注入；同時設定 child 自己的 optionsHash 作為後續比對基準
- [ ] 1.6 驗證：Codex subagent 第一 round `[WS-REQUEST]` log 不含 parent history；non-Codex dispatch 行為不變

## 2. Checkpoint-Based Dispatch

- [ ] 2.1 在 `task.ts` non-Codex dispatch 路徑，呼叫 `SessionCompaction.loadRebindCheckpoint(parentSessionID)`
- [ ] 2.2 若 checkpoint 存在，組合 `[synthetic summary message + messages after lastMessageId]` 作為 parentMessagePrefix
- [ ] 2.3 若 checkpoint 不存在，靜默 fallback 到 full history（現有行為，log 記錄原因）
- [ ] 2.4 驗證：有 checkpoint 時 child first-round token count 大幅縮減；無 checkpoint 時行為不變

## 3. Subagent Taxonomy Formalization

- [ ] 3.1 在 `task.ts` 的 subagent_type 說明中正式記錄四種類型語意：executor / researcher / cron（外部）/ daemon
- [ ] 3.2 Executor 類型：dispatch 時優先使用 spec/plan 內容作為 context，而非完整 parent history
- [ ] 3.3 更新 `specs/architecture.md`：新增 Subagent Taxonomy 章節，記錄四種類型的 lifecycle、dispatch 合約、回報機制
- [ ] 3.4 撰寫 parallel subagent 可行性評估 addendum（design.md 附錄）

## 3.5 Subagent Model Tier Routing

- [ ] 3.5.1 定義 model tier 對應表：`explorer` / `researcher` → small model（`resolveSmallModel()`）；`coding` / `executor` → parent model（現有行為）；`daemon` → small model（長期常駐，省成本）
- [ ] 3.5.2 在 `task.ts` 的 model 解析段（lines ~1333–1393）加入 tier 路由：`params.model` 明確指定時優先，否則按 subagent_type 查 tier 表自動選擇
- [ ] 3.5.3 tier 表設計為可配置（`~/.config/opencode/config.json` 的 `subagent.modelTiers` 欄位），允許 user 覆寫預設
- [ ] 3.5.4 log 記錄 tier routing 決策：`[SUBAGENT-MODEL]` 顯示 type、selected model、reason（explicit / tier-default / parent-inherit）
- [ ] 3.5.5 驗證：researcher 類型 dispatch 自動使用 small model；coding 類型繼續使用 parent model；`params.model` 指定時仍優先

## 4. Daemon Agent Implementation

- [ ] 4.1 確認 `ProcessSupervisor` kind 列表，新增 `"daemon"` kind（或確認現有 kind 可複用）
- [ ] 4.2 建立 `packages/opencode/src/daemon/agent-daemon.ts`：DaemonStore（JSON persistence）、register / recover / unregister
- [ ] 4.3 Daemon condition loop：初期支援 file watch（fs.watch）和 log pattern match（tail + regex）
- [ ] 4.4 條件觸發時 `Bus.publish(DaemonAgentEvent.Triggered, { sessionID, condition, detail })`
- [ ] 4.5 複用 `cron/delivery.ts` announce 路徑將 DaemonAgentEvent 通知送達 operator
- [ ] 4.6 在 `daemon/index.ts` startup 加入 `DaemonStore.recover()` —— re-spawn 已登記的 daemon sessions
- [ ] 4.7 在 `task-worker-continuation.ts` 加入 daemon kind guard：kind="daemon" 的 session 不走 completion handoff，不觸發 parent resume
- [ ] 4.8 驗證：daemon session 在 ProcessSupervisor snapshot 中持續存在；restart 後自動恢復；條件觸發後 5 秒內通知送達
