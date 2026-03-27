# Implementation Spec

## Goal

- 將目前 in-process heartbeat polling cron 升級為可跨 daemon 重啟持續恢復的 durable scheduler MVP，確保單 daemon 情境下 schedule 不會因 restart 而失去持續守時能力。

## Scope

### IN

- 建立單 daemon durable cron scheduler MVP
- daemon 啟動後可從持久化 state recovery，重新接手排程
- 明確定義並實作 missed-run policy：**全部跳過，對齊下一個 future slot**
- 補強 persisted scheduler state，不只依賴脆弱的 `nextRunAtMs`
- 將 reconcile / recover / next-slot ownership 思維落入 cron runtime
- 補 runtime validation 與 planner artifacts

### OUT

- 不依賴 Linux system cron / systemd timer
- 不做 multi-daemon lease / distributed ownership
- 不做 missed-run catch-up replay
- 不做秒級精準 scheduler
- 不重做 scheduled tasks UI

## Assumptions

- 近期產品目標是單一 per-user daemon 常駐模型，而非多實例競爭式 scheduler。
- MVP 階段可以接受 restart 期間錯過的 slots 被 skip-to-next，而不是補跑。
- cron job execution 仍沿用既有 `CronSession.resolve()` + `SessionPrompt.prompt()` 執行管線。

## Stop Gates

- 若要支援 multi-daemon / HA / 多實例同時啟動，需要回 planning 補 lease/claim 設計。
- 若 product 改為要求 missed runs 補跑，而不是 skip-to-next，需要回 planning 重定義 persistence 與 replay contract。
- 若 runtime smoke test 顯示目前 server lifecycle 仍有雙啟動/雙 shutdown 風險，停止並補 lifecycle state diagram。

## Critical Files

- packages/opencode/src/cron/heartbeat.ts
- packages/opencode/src/cron/store.ts
- packages/opencode/src/cron/schedule.ts
- packages/opencode/src/cron/types.ts
- packages/opencode/src/cron/run-log.ts
- packages/opencode/src/daemon/index.ts
- packages/opencode/src/server/server.ts
- packages/opencode/src/scheduler/index.ts

## Structured Execution Phases

- Phase 1: 盤點目前 cron state model 與 restart 缺口，定義 durable MVP 的 persisted scheduler contract
- Phase 2: 實作 daemon boot reconciliation / next-slot recomputation / skip-to-next policy
- Phase 3: 強化 execution journal 與 validation，確認 restart 後 scheduler 會持續守時執行

## Validation

- 單元測試：create/update/recover/restart 後的 next slot 計算與 state persistence
- integration / smoke：restart daemon 後 due job 仍會在下一個 future slot 自動執行並寫入 run log
- 驗證 missed slot 不補跑，而是對齊下一個 future slot
- 驗證 schedule state 不因 daemon restart 消失或停擺

## Handoff

- Build agent must read this spec first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md / handoff.md before coding.
- Build agent must preserve the MVP boundary: single-daemon durable scheduler only.
- Build agent must not introduce silent fallback to OS cron or ad-hoc catch-up hacks.