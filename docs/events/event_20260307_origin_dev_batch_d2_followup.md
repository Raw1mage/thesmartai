# Event: origin/dev Batch D2 follow-up

Date: 2026-03-07
Status: In Progress

## 需求

- 延續 `origin/dev` → `cms` 的 low-risk / high-value refactor-port
- 在 Batch D1 完成後，優先挑選仍未落地且可對應現況結構的 app/ui 細修

## 範圍

### IN

- `packages/app/src/pages/session/message-timeline.tsx`
- `packages/app/src/pages/session/terminal-panel.tsx`
- `packages/app/src/pages/session/index.tsx`
- 載入 session 時的初始滾動位置修正
- terminal tab close 穩定性補強
- split-route regression 修補（tab reorder guard / autoCreated reset）
- event / validation / architecture sync 紀錄

### OUT

- 不碰 provider/runtime 核心流程
- 不做更深的 monitor/event routing 重構
- 不直接 cherry-pick / merge upstream patch

## 任務清單

- [x] 重新盤點 D1 後剩餘 low-risk 候選
- [x] 確認 `2ba1ecabc` 等候選是否已在 cms 落地
- [x] 移植 loading session 初始捲動到底部的等價修正
- [x] 執行 typecheck 驗證
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- `2ba1ecabc`（open file 時 active tab）已在 cms 落地，不再重複 patch。
- `6c9ae5ce9`（session turn path truncation）已被目前 css 結構吸收，無需重做。
- `4c185c70f`（provider settings consistency）在 cms 現況會牽涉缺失的 provider i18n key，並非最小風險項。
- `2ccf21de9` 仍未落地：`message-timeline.tsx` 目前把 `setContentRef` 掛在 message log 容器，sticky header 不在量測範圍內，載入時可能導致初始 bottom-scroll 偏差。

### Execution

- 重新確認 D2 候選後，跳過已 ported/no-op 的項目：
  - `2ba1ecabc` 已在 `createOpenReviewFile(... setActive ...)` 落地。
  - `6c9ae5ce9` 的 path truncation 已被目前 `session-turn` 版型吸收。
- 對 `2ccf21de9` 採取 cms 等價修正：
  - 將 `/packages/app/src/pages/session/message-timeline.tsx` 的 `setContentRef` 從純 message log 容器提升到包住 sticky header + log 的外層 wrapper。
  - 這樣初次載入 session 時，auto-scroll / content height 量測會把 header 一併計入，避免 session 還在 loading/hydrating 時 bottom-scroll 偏上。
- 保持現有 header / log 內部結構與樣式 class 不變，避免擴大滾動副作用。
- 對 terminal tab close 補入 cms-safe 小修：
  - `/packages/app/src/pages/session/terminal-panel.tsx` 的 tab 渲染改為 `ids() -> byId()`，並在 `byId` 中 clone pty snapshot。
  - 避免 terminal 關閉/重排時直接迭代即時 `all()` 造成引用抖動，對齊 upstream `d7569a562` 的較穩定渲染方式。
- 補上 split-route 遺漏的低風險回歸修正：
  - `/packages/app/src/pages/session/index.tsx` 的 file tab drag reorder 改回使用已存在且有測試的 `getTabReorderIndex(...)` helper，避免未知 droppable 導致 `move(..., -1)`。
  - 同檔補回 session 切換時的 `setUi("autoCreated", false)` reset，避免新 session 繼承上一個 session 的 terminal auto-create 狀態。

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Targeted diff confirms this round changed:
  - `packages/app/src/pages/session/message-timeline.tsx`
  - `packages/app/src/pages/session/terminal-panel.tsx`
  - `packages/app/src/pages/session/index.tsx`
  - `docs/events/event_20260307_origin_dev_batch_d2_followup.md`
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅修正 app session timeline 的量測/ref 掛載範圍，未改動 provider/account/session/runtime 架構邊界。
