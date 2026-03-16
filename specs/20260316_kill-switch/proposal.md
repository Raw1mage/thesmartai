# Proposal: Kill-switch production hardening (phase-1)

## Why

- 目前 kill-switch 已有核心路由與服務，但規劃文件仍混有 prototype 路徑與舊假設，會讓後續執行與驗收分裂。
- 需求已從「概念驗證」提升為「可持續維運的 production contract」，需要一次性收斂為可交付規格。

## Original Requirement Wording (Baseline)

- "What did we do so far?"
- "Continue if you have next steps"
- "go"
- "要不要做一個全盤後續計畫，寫成spec再進行。這樣一回一回的問也不是辦法"

## Requirement Revision History

- 2026-03-16 / Stage 1: 從 prototype 位置（`src/server/**`）遷移到 runtime 真正入口（`packages/opencode/src/server/**`）。
- 2026-03-16 / Stage 2: 補齊 route/service/session-gate 測試，確認 kill-switch 主路徑可驗證。
- 2026-03-16 / Stage 3: 權限從 `x-user-role` header 改為 auth-bound operator gate。
- 2026-03-16 / Stage 4: 再升級為 capability gate（`kill_switch.trigger`），採 fail-fast。
- 2026-03-16 / Plan Decision: 後續改採 planner-first，一次形成全盤計畫後再進 build。

## Effective Requirement Description

1. 以 `packages/opencode/src/server` 為唯一實作面，交付可運行、可驗證、可審計的 kill-switch 控制平面。
2. Phase-1 里程碑優先完成「後端與測試收斂」；Web/TUI 介面不納入本輪 mandatory deliverable。
3. 權限模型採雙閘：auth-bound operator + capability `kill_switch.trigger`，且 capability 預設 deny（需部署顯式開啟）。
4. 基礎設施策略採 Storage-first，並保留 Redis/MinIO adapter 契約與升級路線。

## Scope

### IN

- `KillSwitchRoutes` / `KillSwitchService` 的 production 行為契約
- session scheduling gate（`/session/:id/message`, `/session/:id/prompt_async`）
- trigger/cancel/task-control 的 RBAC/MFA/audit/ACK-fallback 行為
- 後端測試與 typecheck 驗證
- 規格文件全套同步（proposal/spec/design/implementation-spec/tasks/handoff + companion）

### OUT

- Web Admin 完整操作頁（按鈕/面板/互動流程）
- TUI 操作入口與快捷鍵
- 跨 region / 多叢集一致性保證

## Non-Goals

- 不在本輪導入新的 silent fallback 機制。
- 不在本輪完成 Redis-only 或 MinIO-only 強綁定部署。

## Constraints

- 必須沿用現有 runtime 路徑與 server 掛載模型，不得回到 prototype tree。
- 必須可由測試證據驗證，不接受「規格存在但無可執行驗證」。
- 必須維持 fail-fast（權限不足、capability 未允許、ACK 失敗/逾時）。

## What Changes

- 規格重整：將所有舊路徑與模板殘留替換為當前實作真相。
- 任務切片重整：改為可委派、可驗證、可交接的 phase/task 結構。
- 明確化 capability 預設政策與部署要求（deny-by-default）。

## Capabilities

### New Capabilities

- `kill_switch.trigger`: 以 config permission 驅動的顯式控制能力閘門。

### Modified Capabilities

- Kill-switch operator control: 從 header role 模式升級為 auth+capability 雙閘。

## Impact

- 影響後端控制層：`packages/opencode/src/server/routes/killswitch.ts`, `packages/opencode/src/server/killswitch/service.ts`
- 影響 session 排程入口：`packages/opencode/src/server/routes/session.ts`
- 影響測試資產：`packages/opencode/src/server/routes/killswitch.test.ts`, `packages/opencode/src/server/routes/session.killswitch-gate.test.ts`, `packages/opencode/src/server/killswitch/service.test.ts`
- 影響規格與交接文件：`specs/20260316_kill-switch/*.md`
