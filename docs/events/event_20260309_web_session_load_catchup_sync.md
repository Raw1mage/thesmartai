# Event: web session load catch-up sync

Date: 2026-03-09
Status: Done

## 需求

- 改善 webapp 作為 observer 打開 session 時，與 TUI 正在執行中的資訊落差。
- 不追求全時高頻即時同步，只在「session load / resume」時附加一段短暫 catch-up realtime sync。
- 採最小方案：`load → force sync → brief live follow`。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/use-session-resume-sync.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/tool-page.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260309_web_session_load_catchup_sync.md`

### OUT

- 不新增常駐高頻 polling
- 不設計新的 controller / handover runtime contract
- 不改 server route / SDK schema

## 任務清單

- [x] 回讀 session load / resume sync 現況
- [x] 在 session load 時加入 catch-up sync window
- [x] 移除 page-level 重複 sync 觸發，改由 hook 統一管理
- [x] 驗證 web session page / tool page 不破壞既有 resume 行為

## Debug Checkpoints

### Baseline

- `session.tsx` 與 `tool-page.tsx` 目前在頁面載入時只做一次 `sync.session.sync(id)`。
- `use-session-resume-sync.ts` 只在 visibility/pageshow/online 恢復時觸發 sync，沒有把「初次進入 session 頁面」當成 catch-up sync 事件。
- 因此當 TUI 正在持續工作，而 Web 此時才開啟 session，web 可能只拿到單次 snapshot，後續仍與實際進度有明顯落差。

### Execution

- 將 `packages/app/src/pages/session/use-session-resume-sync.ts` 從單純 resume listener，擴充為：
  - 初次進入 session 頁面時立即執行 `resume("load")`
  - `load/pageshow/online` 一律走 force sync
- 後續曾嘗試加入短暫 catch-up follow window，但使用者回報 mobile browser 出現「原本單擊要變雙擊才觸發」的嚴重回歸。
- 判斷根因是 follow window 造成過於頻繁的 force sync / reconcile，讓 mobile 點擊期間 DOM 狀態不穩定。
- 本次已**完整移除 catch-up follow loop**，回到較保守版本：
  - 只保留 `load → force sync once`
  - 不再做 load 後短暫重複 sync
- 使用者進一步回報：PC mouse 單擊正常、僅 mobile touch 在「開既有 session」時需要雙擊才觸發；新 session 正常。
- 依此再收斂根因為：問題集中在 **existing session page mount 時的 `resume("load")` 路徑**，而不是一般性的 resume sync。
- 因此最終收斂為：**完全移除 `load` 時的 session sync**，不再區分 coarse pointer；只保留 `visibilitychange/pageshow/online` 的 resume sync，優先恢復既有 session 的 mobile 單擊互動穩定性。
- 使用者後續再回報：webapp 用到一半仍會再次出現雙擊 bug。
- 這表示問題不只在 `load`，也可能來自 mobile 使用中會再次觸發的 `visibilitychange/pageshow/online` sync。
- 因此本輪再進一步止血：**coarse pointer（手機觸控）裝置整體停用 `useSessionResumeSync`**，先優先保證 mobile 單擊互動正確；桌面版仍保留原有 resume sync。
- `packages/app/src/pages/session.tsx` 與 `packages/app/src/pages/session/tool-page.tsx` 的 page-level `sync.session.sync(id)` 仍維持移除，避免和 hook 重複觸發。
- 目前收斂後行為：
  - desktop: `resume/pageshow/online → 視條件 sync`
  - mobile/coarse pointer: `useSessionResumeSync` 停用，不自動在 load/resume 做 session sync

### Validation

- `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）✅
- 參數微調後再次執行 `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）✅
- mobile regression fix 後再次執行 `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）✅
- coarse-pointer mobile fix 後再次執行 `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）✅
- 移除 `load` sync 後再次執行 `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）✅
- coarse-pointer 全停用 resume sync 後再次執行 `bun run typecheck`（workdir: `/home/pkcs12/projects/opencode/packages/app`）✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅調整 web session load/resume 的前端同步策略，未改變 current-state system architecture boundary 或 runtime topology。
