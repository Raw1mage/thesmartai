# Tasks: Subagent IO Visibility

## Completed

- [x] T1: 調查 child sessionID 在 frontend 的可用性
  - 確認 `ctx.metadata()` → `onMetadata` → `Session.updatePart()` 在 running 狀態即寫入 `metadata.sessionId`
  - 確認 bridge events 將子 session messages/parts 推送到 frontend sync store

- [x] T2: 建立 SubagentActivityCard 組件
  - 位置：`packages/app/src/pages/session/components/message-tool-invocation.tsx`
  - 功能：即時顯示子代理 tool calls（含狀態 icon）、文字輸出、elapsed time
  - 支援 running/completed/error 三種狀態

- [x] T3: 在 MessageToolInvocation Switch 中加入 task tool match
  - error + task → SubagentActivityCard (with errorText)
  - task (running/completed) → SubagentActivityCard
  - 優先於 catch-all match

- [x] T4: 更新 SYSTEM.md §2.3 Dispatch Rules
  - 從 "parallel when no dependencies" → "sequential, one at a time"
  - 明確禁止並行 `task()` calls
  - 已同步 runtime + templates

- [x] T5: Frontend 重建與 web server 重啟
  - `bun run build` 成功（全平台）
  - `packages/app` frontend build 成功
  - `webctl.sh dev-refresh` 完成

- [x] T6: Subagent 方法論注入（Prompt 層）
  - 5 個 subagent prompt（coding/explore/testing/review/docs）加入方法論段落
  - 同步到 `templates/prompts/agents/`

- [x] T7: Subagent Skill Injection 機制
  - `task.ts` 所有 subagent whitelist 加入 `"skill"` tool
  - SYSTEM.md 新增 §2.4 Skill Injection for Subagents（含編號修正）
  - AGENTS.md 新增 Subagent Skill Mapping 對照表（coding→code-thinker, testing→webapp-testing, review→code-review, docs→doc-coauthoring+miatdiagram, explore→無）
  - 同步 runtime + templates SYSTEM.md
  - Backend rebuild 完成

## Pending

- [~] T8: Orchestrator Tool Permission Enforcement（程式層）— **已回退**
  - 結論：prompt 層明令委派即可解決，不需限制 Orchestrator 工具能力
  - agent.ts 已恢復原始 permission（build/plan 均為 `"*": "allow"`）
  - 保留為備選方案，若 prompt compliance 再次不足可重啟

- [ ] T9: 實際 delegation 測試驗證
  - 觸發一個 subagent delegation，確認 SubagentActivityCard 正常顯示
  - 確認子代理 tool calls 即時更新
  - 確認 elapsed time 計時器運作
  - 確認 completed 狀態顯示最終輸出
  - 確認 Orchestrator 無法直接呼叫 edit/write（被 deny）

- [ ] T10: Architecture sync
  - 更新 `specs/architecture.md` 加入 subagent IO visibility + tool enforcement 段落
  - 記錄 SubagentActivityCard data flow
  - 記錄 Orchestrator permission model

- [ ] T11: Event log
  - 建立/更新 `docs/events/event_20260321_subagent_io_visibility.md`
