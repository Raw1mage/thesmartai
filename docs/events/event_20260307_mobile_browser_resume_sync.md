# Event: mobile browser resume sync recovery

Date: 2026-03-07
Status: In Progress

## 需求

- 修正手機 browser 將頁面切到背景後，回到前景仍停留在舊資料、必須 reload page 才恢復同步的問題
- 讓 web realtime sync 在 background → foreground 後可自動恢復
- 儘量沿用 cms 既有 SSE + fallback hydration 架構，不做高風險協議重寫

## 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/context/global-sdk.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/context/global-sync.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/context/sync.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/*`

### OUT

- 不修改 backend SSE protocol
- 不更動 TUI runtime
- 不處理與 foreground resume 無關的 UI 視覺問題

## 任務清單

- [ ] 追查 web SSE / foreground resume 失同步來源
- [ ] 補上 foreground resume 後的 reconnect / rehydrate 策略
- [ ] 驗證手機背景切回前景後不需 reload 即可恢復同步
- [ ] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- `global-sdk` 目前會自動重試 SSE，但沒有明確的 foreground/pageshow/focus resume 鉤子。
- `use-status-monitor.ts` / `use-status-todo-sync.ts` 雖然有 `visibilitychange` refresh，但只涵蓋 monitor / todo，不保證 session message hydration 與 global bootstrap 同步恢復。
- `pages/session/index.tsx` 初始只在 route/session id 變更時呼叫 `sync.session.sync(params.id)`；foreground resume 並不會強制 rehydrate。
- 推測 mobile browser 背景後 SSE 連線可能已失效或停滯，但前端未主動做 reconnect + store rebootstrap，因此使用者需要整頁 reload 才回到正確狀態。

### Execution

- `packages/app/src/context/global-sdk.tsx`
  - 新增 foreground resume reconnect 鉤子：`visibilitychange` / `pageshow` / `online`。
  - SSE stream loop 改為可被局部 `AbortController` 中斷並重建，foreground 回來時會主動切斷舊 stream 並重連，而不是只被動等待底層 reconnect。
- `packages/app/src/context/global-sync.tsx`
  - 新增 `refreshVisibleState()`，foreground resume 時優先 refresh queue；僅在真正 resume / pageshow 時才補 bootstrap 活躍 directory stores，避免每次 focus 都做重操作。
  - `online` 才重新 bootstrap global store，將重操作限縮到真正的 network resume 場景。
- `packages/app/src/pages/session/use-session-resume-sync.ts`
  - 新增 session resume heuristic hook。
  - foreground resume 時不再一律 `force: true`，而是先判斷目前 session 是否疑似 stale：
    - session 缺資料
    - messages 尚未 hydration
    - session status 仍為 busy/working/retry/compacting/pending
    - 最後一則 message 仍停在 user（代表 assistant 回覆可能漏掉）
  - 只有命中上述條件，或發生 `pageshow` / `online` 時，才做 `sync.session.sync(id, { force: true })`；否則只做普通 sync。
- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/index.tsx`
- `packages/app/src/pages/session/tool-page.tsx`
  - 三個 session route 統一改用 `useSessionResumeSync(...)`，避免同一問題在 desktop/mobile/status 子頁各自漂移。

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Targeted diff confirms this round changed:
  - `/home/pkcs12/projects/opencode/packages/app/src/context/global-sdk.tsx`
  - `/home/pkcs12/projects/opencode/packages/app/src/context/global-sync.tsx`
  - `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
  - `/home/pkcs12/projects/opencode/packages/app/src/pages/session/index.tsx`
  - `/home/pkcs12/projects/opencode/packages/app/src/pages/session/tool-page.tsx`
  - `/home/pkcs12/projects/opencode/packages/app/src/pages/session/use-session-resume-sync.ts`
  - `/home/pkcs12/projects/opencode/docs/events/event_20260307_mobile_browser_resume_sync.md`
- Browser validation attempt:
  - 透過 Playwright 成功到達 web login page，確認 app 仍受 web auth gate 保護。
  - 以 `.env` 中 legacy server credentials（`opencode` / `Ne20240Wsl!`）測試 `POST /global/auth/login`，收到 `401 AUTH_INVALID`。
  - `GET /global/auth/session` 回傳 `usernameHint: "pkcs12"`，表示目前 web auth runtime 已不是單純使用 `.env` 內 legacy username/password，而是走到不同 auth source（可能為 PAM / htpasswd / runtime override）。
  - 因缺少可登入 web auth 的有效前端帳密，無法在 session page 內完成真實 foreground-resume E2E 驗證；目前僅完成 code-path/typecheck 驗證與 login-gate 探勘。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅補強 web foreground resume 時的 reconnect / rehydrate 策略，未變更 backend API contract、ownership model、provider/session/runtime 架構邊界。
