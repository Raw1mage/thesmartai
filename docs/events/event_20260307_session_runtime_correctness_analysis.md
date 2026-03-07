# Event: session runtime correctness analysis

Date: 2026-03-07
Status: Done

## 需求

- 分析 session runtime correctness 類剩餘功能價值項目
- 聚焦：queued messages / deeper retry / usage-limit orchestration
- 只在存在明確且安全的 first slice 時實作

## 範圍

### IN

- upstream commits:
  - `bf2cc3aa2` queued messages
  - `438610aa6` usage-limit / retry card
  - 其他相關 retry / pending 行為比對
- cms 當前 `session-turn` / `message-part` / `session status` runtime 行為

### OUT

- 不做大型 session message model 重構
- 不做超出 app/ui runtime correctness 的 unrelated refactor

## 任務清單

- [x] 建立 session runtime correctness event
- [x] 盤點 queued / retry / usage-limit 現況
- [x] 標記已 ported / partial / missing
- [x] 定義 highest-value safe first slice（若存在）
- [x] 決定：實作 / 延後
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- portability analysis 已標記 queued / retry / usage-limit 為高價值方向，但其中部分 UI 子集先前已 partial port。
- 需重新確認 cms 當前 `session-turn` / `session-retry` 是否已吸收 upstream 行為，避免重複 patch。

### Execution

- Current classification:
  - upstream `438610aa6` usage-limit / retry card is already effectively present in cms via existing `session-retry.tsx` + `session-turn.tsx` wiring; no additional first slice needed there.
  - upstream `bf2cc3aa2` queued messages is still missing in cms UI.
- Safe first slice selected:
  - add queued-user-message visual state in `packages/ui/src/components/session-turn.tsx`
  - pass queued state through `message-part.tsx`
  - dim queued user attachments/text and show localized `Queued / 排隊中` indicator
  - suppress active spinner/status text for queued turns so only the actually running turn shows live progress
- Implementation landed:
  - `session-turn.tsx` now distinguishes the active in-flight parent turn from later queued user turns.
  - `message-part.tsx` accepts queued state for user messages.
  - `message-part.css` dims queued attachments/text and renders a queued hint.
  - `en.ts` / `zht.ts` add queued indicator copy.

### Validation

- `bun run typecheck` 通過（repo-wide）。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅補齊 session UI 對 queued user messages 的呈現與既有 retry/runtime 狀態的可視化差異，未改動 session persistence、API schema、或 runtime ownership 邊界。
