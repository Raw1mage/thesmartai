# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md
- `packages/opencode/src/tool/task.ts` — dispatch 邏輯全覽
- `packages/opencode/src/session/llm.ts` — codexSessionState 結構（lines 113–121, 572–685）
- `packages/opencode/src/session/prompt.ts` — parentMessagePrefix 注入（lines 497–511, 1156–1172）
- `packages/opencode/src/session/compaction.ts` — loadRebindCheckpoint（lines 213–228）
- `packages/opencode/src/cron/delivery.ts` — announce 模式（複用參考）
- `packages/opencode/src/daemon/index.ts` — startup / recovery 整合點

## Current State

- Phase 1-4 尚未開始
- `REBIND_BUDGET_TOKEN_THRESHOLD` 已從 1000 改為 40_000（2026-04-01）
- Codex delta `previousResponseId` 機制已在 `llm.ts` 實作並運作中
- V2 context sharing 已穩定運作（Anthropic/Gemini cache hit 92-99%）
- Cron 子系統穩定，不在本 plan 範圍內

## Stop Gates In Force

- Codex fork 實作前：audit `llm.ts:586–616` hash bypass 不造成 stale responseId
- Daemon 實作前：確認 ProcessSupervisor kind 列表相容
- Parallel subagent 任何實作前：Phase 3 的 design addendum（race condition audit）必須完成

## Build Entry Recommendation

從 Phase 1（Codex Fork Dispatch）開始，改動最小且收益最大。Phase 1 完成後 Phase 2 可獨立進行。Phase 4（Daemon）是最大的新增模組，建議 Phase 1+2 完成並驗證後再開始。

## Execution-Ready Checklist

- [ ] Implementation spec 完整，無 placeholder
- [ ] Companion artifacts 對齊
- [ ] Validation plan 明確（每個 phase 有可量測的 log/metric check）
- [ ] Runtime todo 從 tasks.md 初始化
- [ ] Stop gates 已確認（`llm.ts` hash bypass 策略、ProcessSupervisor kind）
