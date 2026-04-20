# Spec: frontend-session-lazyload

## Purpose

為 opencode webapp 定義 **前端懶載入與部件層保護** 的行為契約。保證：

- 使用者打開首頁時不會被一個過大的 session 鎖死
- 單一 part 無論多大，瀏覽器 tab 都不 OOM
- 捲動觀看歷史訊息時資料「用到才載」
- AI SDK 的 rebuild storm 不會被直接轉成 React re-render storm

## Scope

Client 層（`packages/app/`、`packages/web/`、`packages/ui/`）與 server 新增的 `GET /session/:id/meta` 端點。其他既有 API 契約不變。

---

## Requirements

### Requirement: R1 — 首頁大 session 逃生機制

防止 `openRootSession` 強制拖入一個已知過大的 session。

#### Scenario: R1.S1 — 小 session 照常 auto-redirect
- **GIVEN** `lastSession[directory] = X` 存在
- **AND** `GET /session/X/meta` 回 `{ partCount: 30, totalBytes: 120KB }`
- **AND** tweaks.cfg 設 `session_size_threshold_kb=512` `session_size_threshold_parts=80`
- **WHEN** 使用者瀏覽 `/`（或對應 project 根目錄）
- **THEN** 直接 navigate 到 `/<dir>/session/X`

#### Scenario: R1.S2 — 超過門檻改進 /sessions 列表
- **GIVEN** `lastSession[directory] = Y` 存在
- **AND** `GET /session/Y/meta` 回 `{ partCount: 151, totalBytes: 2300000 }`
- **AND** 同上門檻
- **WHEN** 使用者瀏覽 `/`
- **THEN** navigate 到 `/<dir>/sessions`
- **AND** 顯示 toast「最後 session 較大，改顯示列表」
- **AND** console log `[lazyload] threshold-exceeded sessionID=Y parts=151 bytes=2300000`

#### Scenario: R1.S3 — meta 端點失敗明確報錯，不退回舊行為
- **GIVEN** `lastSession[directory] = Z` 存在
- **AND** `GET /session/Z/meta` 回 500
- **WHEN** 使用者瀏覽 `/`
- **THEN** navigate 到 `/<dir>/sessions` 並顯示錯誤 banner「無法判斷最後 session 狀態」
- **AND** **不得** fallback 到「直接載該 session」（AGENTS.md 第一條）

#### Scenario: R1.S4 — Sidebar 新對話按鈕
- **GIVEN** 使用者在任一頁面
- **WHEN** 點擊 sidebar 的「新對話」按鈕
- **THEN** POST `/session` 建立新 session
- **AND** navigate 到新 session 頁，不經過 `lastSession` 邏輯

---

### Requirement: R2 — Part-level size cap（已結束 part）

單一 part 大小超過 `PART_INLINE_CAP`（預設 64KB）時，預設收合。

#### Scenario: R2.S1 — 小 part 照常全文顯示
- **GIVEN** part.text.length = 10KB
- **AND** `PART_INLINE_CAP = 64KB`
- **WHEN** MessagePart mount
- **THEN** 完整 render text

#### Scenario: R2.S2 — 大 part 預設收合
- **GIVEN** part.text.length = 500KB
- **AND** part 的 message.status = "completed"（非 streaming）
- **WHEN** MessagePart mount
- **THEN** 只 render 前 N 行（由 `part_fold_preview_lines` 控制，預設 20）
- **AND** 顯示按鈕「展開全文 (500 KB)」
- **AND** DOM 字元數 ≤ `part_fold_preview_lines × 200`

#### Scenario: R2.S3 — 展開後完整顯示
- **GIVEN** R2.S2 的狀態
- **WHEN** 使用者點「展開全文」
- **THEN** 完整 render part.text 於 DOM
- **AND** 按鈕改為「收合」

#### Scenario: R2.S4 — cap 設定缺失時明確報錯
- **GIVEN** tweaks.cfg 缺少 `part_inline_cap_kb`
- **AND** runtime fallback 預設為 64KB
- **WHEN** 任一 MessagePart mount
- **THEN** console warn `[lazyload] part_inline_cap_kb missing in tweaks.cfg, using default 64KB` 一次
- **AND** 仍正常 render（使用 default，不 crash）

---

### Requirement: R3 — Streaming part tail-window

Streaming 中且超過 cap 的 part 只 render tail-window，避免 rebuild storm 累積 DOM。

#### Scenario: R3.S1 — streaming 中超 cap 只顯示尾段
- **GIVEN** part.status = "streaming"
- **AND** part.text.length = 200KB
- **AND** `PART_INLINE_CAP = 64KB`
- **WHEN** event-reducer 處理 `message.part.updated`
- **THEN** MessagePart 只 render 最後 64KB
- **AND** 畫面頂部顯示提示「streaming 中，暫顯示最後 64 KB」

#### Scenario: R3.S2 — streaming 完成後允許展開
- **GIVEN** R3.S1 的狀態
- **WHEN** 該 message.status 從 streaming 轉為 completed
- **THEN** MessagePart 轉為 R2.S2 的「收合 + 展開鈕」狀態
- **AND** 使用者可展開看完整文字

---

### Requirement: R4 — Rebuild-vs-append heuristic

`event-reducer.ts` 辨識 AI SDK 全量 rebuild，降低 React re-render。

#### Scenario: R4.S1 — 真 delta（append 模式）
- **GIVEN** 既有 part.text 長度 L
- **AND** incoming `message.part.updated` 的 `delta` 欄位有值、incoming `textLength` = L + delta.length
- **WHEN** event-reducer 處理該事件
- **THEN** `store.part[partId].text = existing + delta`
- **AND** 不觸發 reconcile 整段

#### Scenario: R4.S2 — 全量 rebuild 前綴 match
- **GIVEN** 既有 part.text 長度 L，內容 T
- **AND** incoming payload 無 delta 欄位，完整 text 長度 L+k，前 L 字元 === T
- **WHEN** event-reducer 處理該事件
- **THEN** 視同 append，`store.part[partId].text = incoming.text`
- **AND** 記錄 `[lazyload] rebuild-detected partId=X delta=k`

#### Scenario: R4.S3 — 真全量替換（非 append 模式）
- **GIVEN** 既有 part.text 與 incoming payload 前綴不 match
- **WHEN** event-reducer 處理該事件
- **THEN** 正常 replace
- **AND** 若 incoming.text.length > `PART_INLINE_CAP` 且距上次 replace < 100ms，skip 此次（以下次為主）

---

### Requirement: R5 — Scroll-spy 自動載入舊訊息

MessageTimeline 頂端 IntersectionObserver 自動觸發 `loadMore()`。

#### Scenario: R5.S1 — 捲到頂自動載入
- **GIVEN** `sync.session.history.more(sessionID) === true`
- **AND** `sync.session.history.loading(sessionID) === false`
- **WHEN** MessageTimeline 的 top-sentinel 進入 viewport
- **THEN** 呼 `sync.session.history.loadMore(sessionID)`
- **AND** 顯示 loading spinner 於頂端

#### Scenario: R5.S2 — 正在載入時不重複觸發
- **GIVEN** R5.S1 已觸發
- **AND** `sync.session.history.loading(sessionID) === true`
- **WHEN** top-sentinel 再次進入 viewport
- **THEN** 不再呼 `loadMore()`

#### Scenario: R5.S3 — 手動按鈕保留 fallback
- **GIVEN** IntersectionObserver 不支援（舊瀏覽器）
- **WHEN** MessageTimeline render
- **THEN** 顯示「Load Earlier」按鈕作手動 fallback

---

### Requirement: R6 — 初始 page size 動態化

依 meta.partCount 決定初次載入的 message 數。

#### Scenario: R6.S1 — 小 session 載全部
- **GIVEN** `GET /session/X/meta` 回 `partCount: 30`
- **WHEN** 首次開啟該 session
- **THEN** 呼 `session.messages({ limit: Infinity })`（或不帶 limit，等價全載）

#### Scenario: R6.S2 — 中 session 載 100
- **GIVEN** `partCount: 120`
- **WHEN** 首次開啟
- **THEN** 呼 `session.messages({ limit: initial_page_size_medium })`（預設 100）

#### Scenario: R6.S3 — 大 session 載 50
- **GIVEN** `partCount: 400`
- **WHEN** 首次開啟
- **THEN** 呼 `session.messages({ limit: initial_page_size_large })`（預設 50）

---

### Requirement: R7 — Feature flag 切換

`frontend_session_lazyload=0` 時完全退回目前行為。

#### Scenario: R7.S1 — Flag off
- **GIVEN** tweaks.cfg 設 `frontend_session_lazyload=0`
- **WHEN** 任何頁面載入
- **THEN** R1–R6 全部停用，行為同主線現狀（messagePageSize=400、無 part cap、無 scroll-spy、無 meta 呼叫）

#### Scenario: R7.S2 — Flag on
- **GIVEN** tweaks.cfg 設 `frontend_session_lazyload=1`
- **WHEN** 任何頁面載入
- **THEN** R1–R6 全部啟用

---

## Acceptance Checks

- 建一個有 1000 messages + 單 part 3MB 的 fixture session。
- Flag on + 首頁進入 → 導向 `/sessions`（R1.S2）。
- 點 session → 5 秒內首屏顯示最後 50 messages（R6.S3）。
- 捲到頂自動補資料（R5.S1），全程無 Layout Shift 超過 50ms。
- 大 part 預設收合，展開後可閱讀（R2.S2/S3）。
- Streaming 中 tail-window 正確顯示，completed 後可展開（R3.S1/S2）。
- DELTA-PART log 頻率與 flag off 對照 → re-render 次數減少至少 50%（R4）。
- Flag off 行為與主線 hash `<TBD>` 一致（R7.S1）。
