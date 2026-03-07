# Event: web session autoscroll opt-out

Date: 2026-03-08
Status: In Progress

## 需求

- 在 web session 閱讀 AI 文字輸出時，不要再強制貼底
- 使用者往上閱讀後，新訊息應保留位置，讓使用者自行決定何時回到底部
- mobile / desktop web session 一併停用自動跟隨新訊息

## 範圍

### IN

- `packages/app/src/pages/session/index.tsx`
- web session auto-scroll 啟用條件

### OUT

- 不修改 review/file panel 捲動邏輯
- 不引入新的 web runtime API

## 任務清單

- [x] 定位 web session auto-scroll 啟用點
- [x] 將 web session 改為預設不自動跟隨新訊息
- [ ] 驗證並 commit

## Debug Checkpoints

### Baseline

- `packages/app/src/pages/session/index.tsx` 原本使用 `createAutoScroll({ working: () => true })`，之後先縮成 desktop-only。
- 進一步使用者回饋顯示 desktop web 同樣不需要強制貼底；閱讀中的視角應一律被保留。

### Execution

- Changed session auto-scroll activation from desktop-only (`working: () => isDesktop()`) to fully disabled (`working: () => false`).
- Resulting behavior:
  - web session no longer auto-follows new content by default on either mobile or desktop
  - the existing "scroll to latest" floating button remains the explicit way to jump back down
- Follow-up issue found after visual use:
  - even with auto-follow disabled, `useSessionHashScroll` still called `forceScrollToBottom()` during initial ready / no-hash flows
  - this caused the viewport to bounce between the preserved reading position and the bottom
- Mitigation landed:
  - web session now disables that implicit hash-scroll bottom jump path as well
  - only explicit user action (the jump-to-latest button / direct navigation intent) should move the viewport to bottom

### Validation

- `bun run typecheck` passed in `/home/pkcs12/projects/opencode` after broadening the opt-out to all web sessions (`Tasks: 16 successful, 16 total`).
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅調整 web session auto-scroll 啟用條件，不改動 session persistence、runtime、或 API architecture 邊界。
- Follow-up validation after disabling the hash-scroll layer's implicit `forceScrollToBottom()` path also passed via `bun run typecheck` (`Tasks: 16 successful, 16 total`).
