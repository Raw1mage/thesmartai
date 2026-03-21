# Event: Telemetry Implementation

**Date**: 2026-03-21
**Scope**: Session telemetry transport / SDK contract / app monitor sync / P2 UI surfaces
**Status**: Completed and closed after final green validation

## 需求

完成 telemetry implementation 與 authoritative A112 payload slice 後，將主事件文件同步為可獨立閱讀的最終狀態：說明 server route、SDK 型別、app hydration/read model、A111/A112/P2c UI surface，以及剩餘 closeout 項目。

## 範圍

### IN

- `packages/opencode/src/server/routes/session.ts` 的 `GET /session/top` transport contract
- `packages/opencode/src/session/monitor.ts` monitor projection 邊界與 nested telemetry payload
- SDK `SessionMonitorInfo` 型別契約
- `packages/app/src/pages/session/use-status-monitor.ts` monitor hydration
- `packages/app/src/context/{global-sync/types.ts,sync.tsx}` 的 `session_telemetry` read model
- `packages/app/src/pages/session/{session-telemetry-ui.ts,session-telemetry-cards.tsx,session-side-panel.tsx,tool-page.tsx}`
- `packages/app/src/components/session/session-context-tab.tsx`
- authoritative A112 request / round / compaction slice (`roundIndex`, `requestId`, `compactionResult`, `compactionDraftTokens`, `compactionCount`)

### OUT

- Runtime telemetry capture ownership 調整
- 新增 UI write path / mutation path
- 重新定義 base `session_status` sync contract

## 變更清單

### Transport / Projection

- `packages/opencode/src/server/routes/session.ts`
  - `GET /session/top` 已作為 session monitor / telemetry snapshot transport，查詢鍵為 `sessionID`、`includeDescendants`、`maxMessages`。
- `packages/opencode/src/session/monitor.ts`
  - monitor projection 持續以 active session / agent / tool row 形式輸出 `SessionMonitor.Info[]`。
  - 聚合來源為 session status、assistant/tool message activity、process state；屬 downstream projection，不是 telemetry capture owner。
  - `telemetry` nested payload 已承載 authoritative A112 request / round / compaction 欄位：`roundIndex`、`requestId`、`compactionResult`、`compactionDraftTokens`、`compactionCount`。
- `packages/sdk/js/src/v2/gen/types.gen.ts`
  - SDK 已對齊 `SessionMonitorInfo[]` 與 nested telemetry 回應型別，server 與 consumer 共享同一個 typed contract。
- `packages/app/src/pages/session/use-status-monitor.ts`
  - app 透過 `sdk.client.session.top()` 讀取 monitor snapshot，並以 event-driven refresh + fallback polling 維持資料新鮮度。

### App Hydration / UI Surfaces

- `packages/app/src/context/{global-sync/types.ts,sync.tsx}`
  - `session_telemetry` 已作為 app-side read model 落地；由既有 session/message state 與 monitor rows 建立 projection，不回寫 runtime。
- `packages/app/src/pages/session/monitor-helper.ts`
  - A112 round / session projection 現在優先讀取 `SessionMonitor.Info.telemetry` 的 authoritative 欄位，僅在 monitor 缺席時保留 legacy fallback。
- `packages/app/src/pages/session/session-telemetry-ui.ts`
  - shared hydration helper 讓 telemetry refresh 不再被 status-mode 入口綁定；context-first surface 也能先建立 projection。
- `packages/app/src/pages/session/session-telemetry-cards.tsx`
  - 已落地 Prompt telemetry（A111）、Round / Session telemetry（A112）、Quota pressure compact callout 三個 read-only card surface。
- `packages/app/src/pages/session/{session-side-panel.tsx,tool-page.tsx}`
  - sidebar/status surface 已接入 telemetry cards，並共用 account label resolution / hydration 路徑。
- `packages/app/src/components/session/session-context-tab.tsx`
  - Account / quota reuse 已作為 context tab primary card 落地；status/sidebar surface 則只在高壓時顯示 compact callout。

## Key Decisions

1. **Transport 與 base status 分離**：`session_status` 繼續負責 session liveness；較重的 monitor/telemetry snapshot 走 `session.top`，避免把 rich payload 灌進全域 sync status slice。
2. **Projection 不是 sink**：`session/monitor.ts` 與 app `session_telemetry` 都只負責讀取既有 runtime 訊號並輸出 UI 可消費 projection；prompt/round telemetry 的 capture ownership 不下沉到 UI。
3. **A112 authoritative slice 已落地**：request / round / compaction 關鍵欄位已經透過 monitor payload 對 app 暴露；app helper 在正常 `session.top` 路徑不再以 heuristic 作為主要資料來源。
4. **P2 UI 維持 read-only**：A111/A112/P2c 都是 downstream consumer surface；沒有新增 UI bypass 或 mutation path。
5. **Hydration 子事件保留**：`event_20260321_session_telemetry_context_hydration.md` 保留作為 focused sub-event，但主事件文件已可獨立描述完整 implementation 結果。

## Final Validation Summary

- [x] 程式碼比對：`session.top` route、`SessionMonitor.Info`、SDK `SessionMonitorInfo`、app `use-status-monitor.ts` 呼叫鏈路一致。
- [x] 程式碼比對：`SessionMonitor.Info.telemetry` 與 `monitor-helper.ts` 已對齊 authoritative A112 payload 欄位。
- [x] 程式碼比對：A111 prompt telemetry、A112 round/session telemetry、P2c account/quota reuse UI 均已落地於既有 sidebar/status/context surfaces。
- [x] 程式碼比對：`packages/app/src/pages/session/monitor-helper.test.ts` 已覆蓋 backend telemetry 優先於 fallback 的情境。
- [x] 執行驗證：最終 green validation 已完成。先前 `packages/opencode/src/server/routes/session.ts` 的 async mismatch（`KillSwitchService.listBusySessionIDs()` 需 `await`）已於 closeout 前修正；最終成功命令確認 telemetry-touched runtime/app/test/build 驗證為綠燈，主事件可正式關閉。
- [x] Architecture sync：`specs/architecture.md` 已更新為長期資料流，納入 authoritative A112 monitor payload 與 fallback-only 限制描述。

## Remaining Known Limitations

- legacy app-side fallback 邏輯仍存在，但只用於 monitor-unavailable / degraded 路徑；正常 `session.top` snapshot path 以 backend telemetry 為主。
- Quota/account surface 仍沿用既有 quota telemetry、issue history、account family label resolver；目前未暴露剩餘 token 等更細額度欄位。
- `session/monitor.ts` 仍是 monitor snapshot projection，不承擔完整 prompt/round telemetry capture；runtime ownership 仍在 processor / runtime-event emission 側。

## A112 Field Alignment Audit

- **已透過 authoritative monitor telemetry 對齊的欄位**
  - `roundIndex`
  - `requestId`
  - `compactionResult`
  - `compactionDraftTokens`
  - `compactionCount`
- **持續由既有 session/message/model state 提供的欄位**
  - `sessionId`
  - `providerId` / `accountId` / `modelId`
  - `promptTokens` / `inputTokens` / `responseTokens` / `reasoningTokens`
  - `cacheReadTokens` / `cacheWriteTokens` / `totalTokens`
  - `sessionDurationMs`（由 `session.time.created/updated` 推得）
  - `cumulativeTokens` / `totalRequests`（優先讀 `session.stats`）
- **Residual fallback boundary**
  - `monitor-helper.ts` 仍保留 fallback 計算，以處理 monitor row 暫不可用或降級情境。
  - 這些 fallback 不再代表主路徑 authority，也不應被描述為當前 implementation blocker。
- **結論**
  - A112 authoritative payload slice 已完成並接入現有 `session.top` / app projection 邊界。
- telemetry slice 的 targeted validation evidence 已補齊，且最終 green validation 已完成；本次 telemetry A112 slice 已無未結 blocker。

## Architecture Sync

Architecture Sync: Updated — `specs/architecture.md` 已改為記錄完整長期資料流：`session_status`（base liveness） + `session.top` / `SessionMonitor.Info[]`（rich monitor snapshot，含 A112 telemetry payload） + app `session_telemetry` read model（surface-specific telemetry projection） + sidebar/status/context read-only cards。
