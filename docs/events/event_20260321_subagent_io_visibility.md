# Event: Subagent IO Visibility

**Date**: 2026-03-21
**Scope**: Frontend UI + Prompt engineering

## 需求

使用者在 web UI delegate subagent 後完全看不到子代理的工作內容。三個並行 subagent 全部 timeout（600s），且主 session 只顯示 "思考 · 17分鐘"。

使用者明確要求：
1. 一次一個 subagent，做完再派下一個
2. delegate 出去要有畫面顯示工作內容

## 範圍

### IN
- SubagentActivityCard 組件：即時顯示子代理 tool calls + 文字輸出
- task tool 專屬渲染（取代通用 MCP catch-all）
- SYSTEM.md §2.3 sequential delegation rule
- Error state rendering for task tool

### OUT
- Hard runtime enforcement of sequential dispatch
- Nested subagent activity display
- Worker pool size adjustment

## 變更清單

### Frontend
- `packages/app/src/pages/session/components/message-tool-invocation.tsx`
  - 新增 `SubagentActivityCard` 組件（~200 行）
  - 新增 task tool error match（優先於通用 error）
  - 新增 task tool running/completed match
  - 新增 imports: `For`, `Spinner`, `Part as PartType`

### Prompt
- `~/.config/opencode/prompts/SYSTEM.md` §2.3
  - "parallel when no dependencies" → "sequential, one at a time"
  - 已同步 `templates/prompts/SYSTEM.md`

### Specs
- `specs/20260321_subagent-io-visibility/` — spec, design, tasks
- `specs/architecture.md` — 新增 "Subagent IO Visibility" 段落

## Key Decisions

1. **不需 backend 改動**：`ctx.metadata({ sessionId })` 已在 running 狀態寫入 tool part metadata，frontend 直接讀取
2. **Polling + Event hybrid**：bridge events 即時推送子 session 資料，但 `sync.session.sync()` 需 HTTP fetch 初始化，故每 3 秒 re-sync while running
3. **Sequential 為 soft enforcement**：透過 SYSTEM.md prompt 規則引導，無 runtime task() 並行阻擋

## Verification

- [x] `bun run build` — 全平台成功
- [x] `packages/app` frontend build — 成功（12.64s）
- [x] `webctl.sh dev-refresh` — server running, HTTP health OK
- [ ] 實際 delegation 測試（待使用者確認）

## Architecture Sync

Architecture Sync: Updated — `specs/architecture.md` 新增 "Subagent IO Visibility" 段落，描述 data flow、組件結構、dispatch 規則。
