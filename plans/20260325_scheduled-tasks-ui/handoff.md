# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding
- 遵循 thin client 原則：前端不直接操作 cron store，一律走 REST API
- Task card 三區式佈局是核心 UI 契約，不可簡化為單一欄位

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State

- Cron 後端完整（store, types, heartbeat, delivery, run-log, session, light-context）
- 無 REST API 路由
- 無前端 UI
- Plan artifacts 已建立（R1 revision）

## Stop Gates In Force

- CronStore API 簽名不符 → 先對齊
- light-context 是否載入 MCP managed app tools → 需確認，影響 Gmail/Calendar 在 cron 中的可用性
- LINE Bot push API 需 channel access token → Phase 2 才需要
- Heartbeat isolated session 是否能存取 managed app tools → 關鍵驗證點

## Build Entry Recommendation

- 從 Phase 1（REST API）開始
- 先讀 `packages/opencode/src/cron/store.ts` 和 `types.ts` 了解 API
- 先讀 `packages/opencode/src/cron/light-context.ts` 確認 MCP tools 可用性
- 參考 `packages/opencode/src/server/routes/mcp.ts` 了解路由 pattern
- 參考 `packages/app/src/pages/layout/sidebar-shell.tsx` 了解 sidebar 入口 pattern

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
- [ ] light-context MCP tool availability confirmed (stop gate)
