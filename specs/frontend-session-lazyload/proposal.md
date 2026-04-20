# Proposal: frontend-session-lazyload

## Why

- 瀏覽器打開 opencode webapp 後，首頁自動導向最後 active session；當該 session 正在 streaming（AI SDK rebuild storm，單一 part 累積 3MB+ 文字、10000+ delta），瀏覽器 tab 直接 `Out of Memory`。使用者被鎖死在一個進不去的 session。
- 2026-04-20 觀測：`ses_25722e026ffejCoJPJAlGRt0Mc`（151 parts / 2.2MB on-disk）與 `ses_2571c40acffez7e45s03EQ4VU0` 同步 streaming；gateway/daemon 均健康。問題完全在前端。
- 真兇是 **part 層級的爆量**（單一 part streaming 時記憶體/DOM 無 cap），而非訊息數量。訊息層級分頁 **已經做完**（見 §What exists already）。

## Original Requirement Wording (Baseline)

- 「我可以理解 session 正在大量工作中。但是 web frontend 端要做 smart design，採 lazy load，不要無腦硬塞 sse」
- 「進入是用首頁網址，沒有辦法選擇不同 session；它會自動導到最後一個工作中的 session，導致被訊息塞爆。」
- 「新進來的畫面優先顯示，使用者往前捲的時候才被動載入舊的資料」
- 「你必須把現有架構已有的機制搞清楚，才不會 double work」

## Requirement Revision History

- 2026-04-20: initial draft created via plan-init.ts
- 2026-04-20: G1–G7 七個設計缺口透過 AskUserQuestion 敲定（見 §Design Decisions）
- 2026-04-20: 盤點既有機制後大幅收斂（砍掉 server pagination、降優先訊息層 virtualization）；core 改為 **part 層 cap + scroll-spy 自動載入**

## What exists already（禁止重做）

- ✅ **Server message pagination**：`GET /:sessionID/message?limit=N` ([session.ts:1595-1679](packages/opencode/src/server/routes/session.ts#L1595-L1679))，cache key `messages:{id}:{limit}`
- ✅ **SessionCache + ETag / 304**：session-poll-cache Phase 1 已合併 (`e0784efda7`)
- ✅ **Client history API**：`sync.session.history.loadMore(sessionID, count=400)` ([sync.tsx:505-520](packages/app/src/context/sync.tsx#L505-L520))；`meta.limit[key]` / `meta.complete[key]` / `meta.loading[key]`
- ✅ **MessageTimeline props**：`historyMore` / `historyLoading` / `onLoadEarlier`（手動 Load Earlier 按鈕已接好）
- ✅ **Auto-scroll**：`follow-bottom` 預設、scroll-up 自動轉 `free-reading`（[create-auto-scroll.tsx](packages/ui/src/hooks/create-auto-scroll.tsx)）
- ✅ **SSE seq ID + Last-Event-ID replay**：[global.ts:319-351](packages/opencode/src/server/routes/global.ts#L319-L351)

新 plan **沿用** 上述所有設施；不新增分頁 API、不動 SSE seq 機制。

## Design Decisions (G1–G7, 2026-04-20)

- **G1 逃生入口**：Sidebar 新對話按鈕 + `/sessions` 列表頁 + `openRootSession` 尺寸門檻（三者並做）。
- **G2 尺寸來源**：新增 `GET /session/:id/meta` 端點（part count / total bytes / last-updated）。
- **G3 Resume**：沿用既有 `Last-Event-ID` 機制 + 上方已述 `loadMore` API；不需新增 `since=` 參數。
- **G4 Large part UX**：預設收合、點開全文（直接 render full DOM，無需新 detail endpoint）。
- **G5 Feature flag**：`tweaks.cfg` 加 `frontend_session_lazyload=1`，灰度 1–2 週後移除。
- **G6 Streaming cap**：streaming 中只 render tail-window（最後 64KB），完成後才允許滾回開頭。
- **G7 Nested agent**：part 層 cap 套到頂層；subagent 內部沿用原實作。

## Effective Requirement Description

1. **逃生入口**：首頁 auto-redirect 必須可跳過；sidebar 有「新對話」鈕；大 session 不強拉。
2. **Part-level size cap**：單 part 超過 `PART_INLINE_CAP`（預設 64KB）自動收合或 tail-window。
3. **Streaming rebuild 減壓**：`event-reducer` 對 AI SDK 的 full rebuild 改走 append heuristic，減少 React re-render 次數。
4. **Scroll-spy 被動載入**：使用者往上捲到接近頂端自動 `loadMore()`，保留手動按鈕作 fallback。
5. **初始 page size 動態化**：依 `/meta` 回報的 part count 決定（小 session 載全部、中 session 載 100、大 session 載 50）。
6. **Feature flag**：`tweaks.cfg` 控制整套新行為的開關，翻車能一鍵退回。

## Scope

### IN

- `packages/opencode/src/server/routes/session.ts`：新增 `GET /:sessionID/meta`，沿用 SessionCache + ETag。
- `packages/app/src/pages/layout.tsx`：`openRootSession()` 加 meta 檢查 + `/sessions` 路由 + 「新對話」按鈕。
- `packages/app/src/pages/session/message-timeline.tsx`：頂端 IntersectionObserver 觸發 `loadMore()`。
- `packages/app/src/context/sync.tsx`：初次載入 limit 依 meta 動態決定（目前固定 `messagePageSize = 400`）。
- `packages/ui/src/components/message-part.tsx`：text / tool output / reasoning 的 size cap 折疊 UI。
- `packages/web/src/event-reducer.ts`：AI SDK full-rebuild → append heuristic；streaming tail-window。
- `/etc/opencode/tweaks.cfg`：`frontend_session_lazyload`、`part_inline_cap_kb`、`session_size_threshold_kb`、`initial_page_size_small/medium/large`。

### OUT

- Server-side message pagination（已有）。
- SessionCache 架構（已有；新端點共用）。
- SSE seq / Last-Event-ID（已有）。
- 訊息層級 virtualization（Solid `<For>` 在 100 條級別無壓力；此 plan 不做）。
- Daemon / provider 層的 delta 合併（另一 plan 範圍）。
- TUI 渲染行為。

## Non-Goals

- 不做訊息層 virtualized list（與用戶需求正交；先解部件層即可）。
- 不做無限歷史（仍受 SESSION_RECENT_LIMIT=50 上限保護）。
- 不做 part detail fetch endpoint（直接 render full part，G4）。

## Constraints

- **禁止靜默 fallback**（AGENTS.md 第一條）：meta 呼叫失敗、cap 設定缺失、flag 檔案不存在 → 必須明確報錯，不退回舊行為。
- **沿用既有 SessionCache / ETag**：meta 端點 cache key `session:{id}:meta`；invalidation 掛在同一組 Bus event。
- **tweaks.cfg**：所有閾值走 `/etc/opencode/tweaks.cfg`，附 fallback 預設值。
- **Breaking-change 控管**：`GET /:sessionID/message?limit=N` 契約不動；新端點額外加不改舊的。
- **Repo-independent**：新設定不得寫死路徑；走 XDG / tweaks.cfg。

## What Changes

### Phase 1 — Escape hatch + meta endpoint
- `GET /session/:id/meta`：回 `{ partCount, totalBytes, lastUpdated, etag }`，cache 沿用 SessionCache。
- Sidebar 常駐「新對話」按鈕 → POST `/session` → navigate。
- `/sessions` 路由：純列表頁，不 auto-redirect。
- `openRootSession()`：pre-redirect 呼 meta，超過 `session_size_threshold_kb` → `/sessions` + toast。

### Phase 2 — Part-level size cap（解 OOM 核心）
- `PART_INLINE_CAP`（tweaks.cfg，預設 64KB）。
- `MessagePart` text / tool output / reasoning：
  - 已結束 part 超過 cap → 預設收合 + 「展開 N KB」。
  - Streaming 中 part 超過 cap → tail-window（只顯示最後 N KB），streaming 完成後允許滾回開頭。
- `event-reducer` rebuild-vs-append heuristic：
  - 若 incoming payload length ≈ existing + delta 且前綴 match → append only。
  - 若真是全量替換且 ratio < 5% → skip 中間更新（以最終值為主）。

### Phase 3 — Scroll-spy 自動載入舊訊息
- `MessageTimeline` 頂端 IntersectionObserver → 接近頂時自動 `loadMore()`。
- 保留「Load Earlier」按鈕作明示 fallback。
- `sync.tsx` 初次載入 limit 改為：
  - meta.partCount ≤ 50 → 載全部
  - 51–200 → 載 100 messages
  - > 200 → 載 50 messages
  - 可由 tweaks.cfg override。

### Phase 4 — Feature flag + 驗收
- `tweaks.cfg` 加 `frontend_session_lazyload=1`。
- 建立大 session fixture（1000 msg + 3MB part）load test。
- 觀察 DELTA-PART log 壓力 / 瀏覽器 heap / Lighthouse。
- `docs/events/` 紀錄；`specs/architecture.md` 同步。

## Capabilities

### New Capabilities

- **fresh-start entry**：使用者可從 sidebar「新對話」或 `/sessions` 進入；不被 lastSession 鎖住。
- **session meta endpoint**：不拉全量訊息即可知 session 規模。
- **part-level fold / tail-window**：單 part 爆大時不把整段塞進 DOM。
- **rebuild-aware delta apply**：AI SDK rebuild 被辨識為 append，減少 re-render 風暴。
- **scroll-spy auto-load**：使用者不用按按鈕，捲上去自動補。

### Modified Capabilities

- `openRootSession()`：加入 meta 檢查 + 逃生入口。
- `MessageTimeline`：頂端 scroll-spy；初始 limit 依 meta 動態。
- `MessagePart`：新增 size cap + streaming tail-window。
- `event-reducer.ts`：新增 rebuild-vs-append heuristic。
- `sync.tsx` `messagePageSize`：從 400 固定改為依 meta 動態。

## Impact

- **Code**：§Scope IN 列出的 6 個檔案 + tweaks.cfg 模板。
- **API 契約**：新增 `GET /session/:id/meta`，不動既有端點。
- **UX**：首次進入大 session 會更快（只載 50–100 msg）；長 tool output 多一次點擊展開；streaming 中捲回去須等完成。
- **部署**：前後端同版 + tweaks.cfg 更新。Flag 控制可個別用戶先試。
- **文件**：`specs/architecture.md` 加「Session loading strategy」段；`docs/events/event_2026-04-20_frontend-lazyload.md`。
- **相關 memory**：`feedback_repo_independent_design.md`、`feedback_tweaks_cfg.md`、`project_codex_cascade_fix_and_delta.md`、`specs/session-poll-cache/`。
