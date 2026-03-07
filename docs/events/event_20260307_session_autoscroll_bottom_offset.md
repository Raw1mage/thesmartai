# Event: session autoscroll bottom offset respects composer height

Date: 2026-03-07
Status: In Progress

## 需求

- 修正 session 視窗往下新增訊息時的觸底判定
- 真正底部必須考慮對話輸入框（composer / prompt dock）高度，避免最後內容被輸入框蓋住

## 範圍

### IN

- `packages/app/src/pages/session/index.tsx`
- session autoscroll / prompt-height stickiness 判定

### OUT

- 不改動整個 auto-scroll hook 架構
- 不調整 review/file panel 捲動邏輯

## 任務清單

- [x] 定位 autoscroll 與 promptHeight 互動位置
- [x] 修正 bottom/stick 判定把 composer 高度算進去
- [x] 驗證 typecheck
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- `session/index.tsx` 已有 `store.promptHeight` 與 `--prompt-height` CSS 變數。
- 但 prompt dock resize 時的 stick 判定仍使用 `el.scrollHeight - el.clientHeight - el.scrollTop < 10`，未將 prompt/composer 佔據的可視空間算入。
- 結果是：畫面看似捲到底，實際最後幾行仍可能落在 composer 後面。

### Execution

- `packages/app/src/pages/session/index.tsx` 的 prompt dock resize handler 已改為把 `promptHeight` 納入 stick 判定：
  - 由原本的 `scrollHeight - clientHeight - scrollTop < 10`
  - 改為扣除 `bottomInset = max(previousPromptHeight, nextPromptHeight)` 後再判定是否仍貼底。
- 當 stick 成立時，自動滾到底部的目標也改為：
  - `scrollHeight - clientHeight + nextPromptHeight`
  - 而非單純 `scrollHeight`
- 效果是「真正的底部」會預留 composer/prompt dock 佔據的可視空間，不再讓最後內容被輸入框遮住。

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅修正 session 視窗 autoscroll 與 composer 高度的互動，未改動 runtime / provider / session persistence 架構邊界。
