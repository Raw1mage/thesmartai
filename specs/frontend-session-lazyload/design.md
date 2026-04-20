# Design: frontend-session-lazyload

## Context

OpenCode 的 web frontend 目前在開啟大 session 時會 OOM：首頁 auto-redirect 直接把使用者丟進最後 active session；REST 雖已支援 `?limit=N` 分頁與 SessionCache ETag，但首屏 page size 固定 400 且 part 層無任何 size cap；AI SDK 的 rebuild storm 透過 SSE `message.part.updated` 直接觸發 React 每次 re-render。

## Goals / Non-Goals

### Goals

- 不重做既有設施（session-poll-cache Phase 1 cache / ETag、message pagination、auto-scroll follow-bottom、Last-Event-ID replay 都沿用）。
- 把「新進來的訊息優先、舊訊息被動補」變成預設行為而非需要使用者手動點按鈕。
- 讓瀏覽器對超大 part 永遠有可控的 DOM 上限。
- 可秒退：所有變更由 `tweaks.cfg` flag 控制。

### Non-Goals

- 訊息層 virtualized list（Solid `<For>` 在 50–200 級別無壓力）。
- Server pagination API（已存在）。
- 改 SSE 事件 schema。
- 改 daemon / provider 對 AI SDK 的 delta 合併策略（屬 codex-cascade 範圍）。

## Decisions

- **DD-1** 新增 `GET /session/:id/meta` 端點，沿用 SessionCache。Cache key `session:{id}:meta`，與既有 `session:{id}` / `messages:{id}:{limit}` 並存；invalidation 掛在同一組 Bus event，任何 session 變更都 bump 所有三類 key 的 version。
- **DD-2** 首頁 `openRootSession()` 在 redirect 前一律呼 meta；任何錯誤（包含 404、500、網路）一律改走 `/sessions`，不退回「直接載」。
- **DD-3** `PART_INLINE_CAP` 預設 64KB，由 `tweaks.cfg` 的 `part_inline_cap_kb` 控制；`fold_preview_lines` 預設 20；streaming `tail_window_kb` 預設同 `PART_INLINE_CAP`。缺項走 default + console warn（但不 crash）— 例外於 R2.S4（runtime 可用 default，不像 meta 呼叫失敗那樣必須中斷）。
- **DD-4** 「Streaming 中是否超 cap」的判斷在 `event-reducer` 做，不在 MessagePart 做：reducer 把 `store.part[id].text` 收敛到 `tail_window_kb`（只保最後 N KB + 標記 `truncatedPrefix: K`）；MessagePart 只負責 render + 收合。這樣做的原因是讓 DOM 從源頭就沒有完整 3MB。
- **DD-5** Rebuild 判斷採「length match + prefix match」兩步驗證；match 失敗才走 replace（R4.S3）。Prefix match 只比對前 1024 字元，避免每次 delta 都 O(n) 比對。
- **DD-6** Scroll-spy 用 IntersectionObserver 綁在 MessageTimeline 最上方的 hidden sentinel；rootMargin `"400px 0px 0px 0px"` 讓使用者還有 2 ~ 3 畫面距頂就開始載。loading 期間 sentinel 不 observe。
- **DD-7** 初始 page size 分三檔（50/100/all），門檻 `partCount ≤ 50` 全載、`≤ 200` 載 100、否則 50；皆可由 tweaks.cfg override。採 partCount 而非 byteCount 是因為 meta 端點必回 partCount，而 byteCount 可能延遲。
- **DD-8** Feature flag `frontend_session_lazyload` 預設 **關**。Rollout 階段手動打開；穩定 1–2 週後改預設 **開**；4 週後移除 flag。
- **DD-9** 不在 client 做 meta 呼叫的 retry：失敗就走 `/sessions`。理由：這是打開頁面瞬間的決定，retry 會卡住 UI；走 `/sessions` 已是安全退路。
- **DD-10** Sidebar 新對話按鈕直接呼現有 `POST /session` API，不需改 server。

## Risks / Trade-offs

- **R-1 rebuild 判斷誤判**：若 AI SDK 未來改變 rebuild 行為（例如中間插一段而非 append），R4 的 prefix match 可能錯把真替換當 append。緩解：失敗時 log `[lazyload] rebuild-mismatch partId=X`；fixture 測試覆蓋至少 3 種已知 rebuild 模式。
- **R-2 streaming tail-window 丟失捲回觀看**：使用者可能在 streaming 中想看前段。緩解：畫面頂部明確提示「暫顯示最後 64KB」+ 「完成後可看全文」；若真有需求再做「streaming 中 toggle full view」。
- **R-3 meta 呼叫延遲拖慢首屏**：多一次 round-trip。緩解：meta endpoint 回傳極小（<1KB），走 SessionCache ETag，cache hit 時 < 10ms。
- **R-4 flag 關閉期間 bug 只在 flag 開時出現**：雙路徑維護期 1–4 週；必須每個 PR 同時跑 flag on/off 兩組 test。
- **R-5 scroll-spy 與 auto-scroll 互相干擾**：`follow-bottom` 往下捲的同時 top-sentinel 不該觸發 load。緩解：top-sentinel observer 僅在 `autoScroll.mode === "free-reading"` 時啟用。

## Critical Files

- `packages/opencode/src/server/routes/session.ts` — 新增 `/:sessionID/meta` handler
- `packages/opencode/src/server/session-cache.ts` — 新增 `meta` cache key 命名空間
- `packages/app/src/pages/layout.tsx` — `openRootSession` 重寫 + sidebar 新對話按鈕
- `packages/app/src/pages/sessions.tsx` — 新路由頁（若已有 session list UI 則改）
- `packages/app/src/pages/session/message-timeline.tsx` — 頂端 sentinel + IntersectionObserver
- `packages/app/src/context/sync.tsx` — `messagePageSize` 改為 `pageSizeFor(partCount)`
- `packages/ui/src/components/message-part.tsx` — size cap fold UI + streaming 提示
- `packages/web/src/event-reducer.ts` — rebuild heuristic + tail-window 截斷
- `packages/opencode/src/config/tweaks.ts` — 新 key 讀取 + fallback
- `/etc/opencode/tweaks.cfg`（template 同步）— 新增預設值
- `docs/events/event_2026-04-20_frontend-lazyload.md` — 變更紀錄

## Rollout

- **Week 1** Phase 1 + 2 ship with flag=0；少數內部帳號手動 flag=1 驗證。
- **Week 2** Phase 3 + 4 ship；flag=1 擴到全部內部帳號。
- **Week 3** 觀察 daemon log DELTA-PART / 瀏覽器 heap / Lighthouse；無 regression 則 tweaks.cfg 預設值改 flag=1。
- **Week 5** 移除 flag 與舊路徑 code。
