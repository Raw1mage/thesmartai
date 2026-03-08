# Event: session scroll force RCA

Date: 2026-03-09
Status: Completed

## 需求

- 追查為何 webapp 對話頁在使用者已上捲後，仍存在不受控的強制貼底/拉回行為。
- 釐清 page-level、reasoning stream、toolcall stream 之間是哪一條 scroll path 重新奪回控制權。

## 範圍 (IN / OUT)

### IN

- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/use-session-hash-scroll.ts`
- `packages/ui/src/hooks/create-auto-scroll.tsx`
- `packages/ui/src/components/message-part.tsx`
- 必要的 RCA event 記錄

### OUT

- 本輪先不直接修改行為
- 不重構 shell / reasoning renderer

## 任務清單

- [x] 盤點使用者上捲後理應解除 auto-follow 的現行機制
- [x] 找出何處仍會在特定事件下 force scroll
- [x] 輸出最可疑 root cause 與後續修正方向
- [x] 記錄 Architecture Sync 判定

## Debug Checkpoints

### Baseline

- 使用者已觀察到：思考鏈中穿插文字輸出時，畫面像同時受到「保留原位置」與「貼底追最新」兩股力量拉扯。
- 現有理解：系統理論上已有「使用者上捲就解除強制貼底」的保護，但實際上仍出現不受控回拉，表示解除條件未完全覆蓋真實互動路徑。

### Execution

- 先確認「使用者上捲就解除強制貼底」機制確實存在：
  - `packages/ui/src/hooks/create-auto-scroll.tsx` 中，`stop()` 會把 `userScrolled=true`。
  - `MessageTimeline` 在根 scroller 收到向上 wheel 時會呼叫 `autoScroll.pause`。
  - `handleScroll()` 也會在離底部超過 threshold 時將狀態切到 `userScrolled=true`。
- 但追查後發現：這個解除機制**不是絕對的**，因為同一個 hook 裡的 `forceScrollToBottom()` 會在 `scrollToBottom(true)` 路徑中直接把 `userScrolled` 清回 `false`：
  - `packages/ui/src/hooks/create-auto-scroll.tsx`
  - 關鍵行為：`if (force && store.userScrolled) setStore("userScrolled", false)`
- 換句話說，系統目前存在「使用者可暫停 auto-follow」與「其他路徑可無條件把暫停狀態重新打開」兩套邏輯；這正符合使用者觀察到的兩股力量互相拉扯。
- 已定位到的 page-level 強制貼底呼叫源：
  1. `packages/app/src/pages/session.tsx`
     - `resumeScroll()` → `autoScroll.forceScrollToBottom()`
     - prompt dock resize 時若判定 `stick` → `autoScroll.forceScrollToBottom()`
  2. `packages/app/src/pages/session/use-session-hash-scroll.ts`
     - 無 hash 時 `applyHash()` 直接 `forceScrollToBottom()`
     - session 初次 ready 時也直接 `forceScrollToBottom()`
     - 找不到 hash target 時 fallback 再次 `forceScrollToBottom()`
- Tool/task 內層也仍有獨立 auto-scroll：
  - `packages/ui/src/components/message-part.tsx` 的 task/child tool wrapper 仍建立 `createAutoScroll({ working: () => true })`
  - 這不一定是主因，但表示內外兩層 scroll policy 都仍存在。
- 目前最可疑的 root cause 不是「單純 auto-follow 沒有 pause 機制」，而是：
  - pause 機制存在，
  - 但 **多個 `forceScrollToBottom()` caller 仍可在某些 state transition / layout event 中把 `userScrolled` 重設回 false**，
  - 使得後續 reasoning/tool streaming 一更新，`ResizeObserver -> scrollToBottom(false)` 又重新接管畫面。
- 本輪最小修正：
  - 保留只有 `resumeScroll()`（使用者按下回到底部）才會呼叫 `autoScroll.resume()`，明確覆寫 user pause。
  - 其餘原本的 page-level force source 全部降級為尊重 `userScrolled` 的 `scrollToBottom()`：
    - `use-session-hash-scroll.ts`：無 hash fallback、hash miss fallback、session 初次 ready
    - `session.tsx`：prompt dock resize stick 情境
  - 等於把「強制貼底權限」收斂到真正的使用者明確操作，而不是一般 lifecycle / layout 事件。

### Validation

- 檢查依據：
  - `packages/ui/src/hooks/create-auto-scroll.tsx`
  - `packages/app/src/pages/session.tsx`
  - `packages/app/src/pages/session/use-session-hash-scroll.ts`
  - `packages/ui/src/components/message-part.tsx`
- 驗證指令：`bun turbo typecheck --filter @opencode-ai/ui --filter @opencode-ai/app`
- 結果：passed
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅收斂 session auto-scroll 呼叫時機與測試命名，未改變架構邊界、API contract 或模組責任。
