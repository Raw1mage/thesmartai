# Proposal: Mobile Tail-First Session Simplification

**Slug:** `mobile-tail-first-simplification`
**State:** `proposed`
**Created:** 2026-04-24
**Supersedes (partial):** `frontend-session-lazyload` R1 (SSE bounded replay) / R2 (cursor pagination) — to be marked `[SUPERSEDED]` on promote.

---

## Why

手機 tab 在 cisopro 這類長 session 下穩定 OOM（iOS Safari 顯示「無法開啟這個網頁」），即使把 on-disk `FileDiff.before/after` 拆掉、把 force-refetch 在 hydrated 時 demote 仍無法解決。近一週連續堆疊的「continuity 機制」：

- `R1` SSE bounded replay（60s / 100 events 窗口）
- `R2` cursor-based `beforeMessageID` pagination
- `force-refetch`（visibility / online / SSE reconnect → `force:true` 全量 resync）
- `Last-Event-ID` resume
- incremental tail fetch for force-resync
- `FoldableMarkdown` truncation + `expand` 呼叫 `syncSession()` 重新全量抓取

每一條單看都合理，疊在一起在 mobile 記憶體壓力下變成**多路徑重複載入** + **無上限累積**。使用者明確表態：「**手機不在意斷點，永遠 tail first 就好**」，「**不能把命運賭在縮小 session 大小**」，「**廢掉那些繁複的 continuity 機制**」。

---

## What Changes

Initial session load collapses to one path (tail-first); continuity mechanisms are removed; store gains a hard cap with LRU.

## Capabilities

- Mobile tab survives long session reopen without OOM
- Session page memory is a function of `cap`, not session length
- Single, simple client ↔ server contract for messages

## Impact

- Desktop users: session reopen shows last 200 instead of full history (scroll-up to load older)
- API consumers: `Last-Event-ID`, `beforeMessageID` cursor protocol removed
- Server memory: SSE replay buffer freed

## Scope

### 必做

1. **Tail-first 為唯一初始載入路徑**
   - 開 session 時一律只拉最後 N 則（mobile N=30，desktop N=200；皆由 tweaks.cfg 控制）
   - 不再嘗試從上次斷點 resume
   - 不再嘗試把中間缺失的訊息補齊

2. **拆掉的東西**（完全移除，不留 feature flag）
   - SSE bounded replay 窗口（R1）— server 端 replay buffer 直接移除
   - `Last-Event-ID` header resume 協議
   - `beforeMessageID` cursor 協議（R2）— 保留 `limit` tail query 即可
   - `force:true` 全量 refetch 路徑（包括 visibility / online / SSE reconnect / 所有呼叫端）
   - `incremental tail fetch for force-resync` 分支
   - `FoldableMarkdown.expand` 的 `syncSession()` full refetch（改成 load-more 模式，只加載被截斷的那一段）

3. **保留 / 強化**
   - SSE live streaming（新 part 進來就 patch-in-place）
   - 使用者主動上捲載舊（load-more；明確手勢觸發）
   - 訊息上限護欄：store 至多保留 N 則（mobile 200 / desktop 500）、超過 LRU 丟最舊（無論是載進來的還是新來的）
   - 單 part 硬上限：500 KB，超過就截斷並記 `truncatedPrefix`（現行機制維持）

### 不做

- 不做斷線補缺（如果使用者真的要看中間某段，自己 scroll-up 載）
- 不做 SSE 補播
- 不做 client-side cache 保留上次的 store 當「斷點」

---

## Constraints

- **絕不保留舊設計作為 fallback**（使用者 2026-04-22 原話：「不保留錯誤設計」）
- Desktop 行為改變（原本會 full-hydrate）需在 event log 明確說明
- 新 session / 短 session（<30 則）行為不變
- Live streaming reply **絕不**被 tail 截掉 — 目前訊息如果還在串流中，視為 "current" 不被 LRU
- beta-workflow 下實作；完成 fetch-back test branch → main merge → `frontend-session-lazyload` 對應 section 標 `[SUPERSEDED]`

---

## Revision History

| Date | Version | Change | Reason |
|------|---------|--------|--------|
| 2026-04-24 | v1 | initial proposal | mobile OOM crisis after diff-strip proved insufficient |
