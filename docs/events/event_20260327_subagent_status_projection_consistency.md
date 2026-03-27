# Event: Subagent Status Projection Consistency Fix

**Date**: 2026-03-27

## Requirement

使用者回報三個相關症狀：

1. 委派 subagent 時，底部 subagent status bar 偶發不顯示
2. session list 偶發出現兩個 running subsession，疑似違反 single-child invariant
3. 某些 child session 頁面停在中途步驟，看起來像 subagent 當掉，但實際 transcript 事後可讀到完整完成輸出

## Scope

### IN
- 釐清 runtime 是否真的同時跑兩個 subagent
- 修正 session list / active-child / status surface 的 running projection 一致性
- 保持 single-child runtime gate，不新增 fallback

### OUT
- 不重做 task dispatch 架構
- 不重做 SSE / bridge protocol
- 不重構整個 session monitor / telemetry 系統

## Task List

1. 讀取 architecture 與既有 subagent 事件，建立 debug baseline
2. 釐清兩個 running subsession 是真雙跑還是狀態誤報
3. 以最小修改修正 running projection / active-child 一致性
4. 驗證並同步 event / architecture

## Debug Checkpoints

### Baseline
- 使用者在 web/mobile 觀察到 status bar 偶發不顯示
- session list 一度顯示兩個 running subsession
- 另有 child session transcript UI 停在某一步，但匯出 transcript 後可見完整最終回報

### Instrumentation Plan
- 檢查 `specs/architecture.md` 中的 Subagent IO Visibility / Continuous Orchestration Control Surface / Worker Lifecycle 契約
- 對照 `task.ts` single-child gate、`task-worker-continuation.ts` cleanup 路徑與 session monitor 的 running projection
- 釐清 session list 的 running 顯示是否使用 stale child session 狀態，而未跟隨 parent active-child authority 收斂

### Execution
- 實際再派 subagent 時，runtime 直接回 `active_child_dispatch_blocked: ... : running`
- 證明 single-child runtime gate 真實存在，不是只有 prompt soft rule
- 匯出早先被使用者認為「卡住」的 child session transcript，確認子 session 實際已完成並有最終回報
- 因此將問題定性為前端/session monitor projection stale，而非真雙跑或 worker crash

### Root Cause
- `SessionMonitor` 在投影 child session 的 active/running 狀態時，過度依賴 child session 本身殘留的 process/tool running 訊號。
- 當 parent 的 authoritative `active-child` 已經轉移/清除，但 child session 的局部狀態尚未完全收斂時，session list 仍可能把該 child 投影成 running。
- 這造成：
  1. session list 看起來像有兩個 running subsession
  2. active-child/status bar 的來源與 session list 不一致
  3. child transcript 頁面可能停在中途畫面，直到後續同步才顯示完成結果

## Changes

- `packages/opencode/src/session/monitor.ts`
  - 引入 `SessionActiveChild` 作為 parent → child authoritative active 判斷來源
  - 對 child session 投影加入額外守門：若該 session 已不是 parent 的 authoritative active child，且 process 也不再 active，則不再投影為 running，而改為 idle
  - 將 session-level 與 agent-level monitor row 都套用相同收斂規則，避免 stale running child 殘留在 session list

## Verification

- `git diff -- packages/opencode/src/session packages/app/src/context/sync.tsx packages/app/src/pages/session`
  - 變更集中於 `packages/opencode/src/session/monitor.ts`
- `bun test packages/opencode/src/bus/subscribers/task-worker-continuation.test.ts`
  - 2 tests passed
- Runtime evidence
  - `active_child_dispatch_blocked` 證明 single-child gate 存在
  - 匯出 `ses_2d2dbaef8ffe6Wy21B7gdgLh69` transcript，證明被使用者視為「卡住」的 child 實際已完成

## Key Decisions

1. 將本問題定性為 **projection inconsistency / stale running state**，不是 runtime 真雙跑。
2. 修復優先放在 `SessionMonitor` 的投影邊界，而不是重做 task dispatch / worker lifecycle。
3. 以 parent `active-child` 作為 child running 可見性的 authoritative guard；未被 parent 認可的 child，不應只靠殘留局部 state 繼續顯示為 running。

## Architecture Sync

Architecture Sync: Verified (No doc changes)

Basis:
- `specs/architecture.md` 已明確記載 single-child invariant、active-child 為 session-global control-plane concept，以及 cleanup order 的 authority。
- 本次修復是在既有 architecture 之內，將 session monitor projection 對齊既有 authority，未新增模組邊界或資料流。

## Remaining

- 建議後續補一個直接覆蓋 `SessionMonitor` child projection stale-state 的針對性測試，避免 regression。
- 若 web/mobile 仍偶發停在舊 transcript 步驟，下一輪需再查 SSE/store refresh 是否還有獨立 race。
