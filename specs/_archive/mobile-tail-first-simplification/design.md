# Design: Mobile Tail-First Session Simplification

## Context

After `mobile-session-restructure` shipped (FileDiff slim + diff viewer deletion), mobile OOM persists. Gateway log of a reproduced crash shows NO beacon + NO JS-driven reload — the tab is killed by iOS WebKit for memory pressure before any JS handler runs. Root cause is not one commit; it is the *sum* of continuity mechanisms added across 2026-04-19 to 2026-04-23:

- Apr 20: part-level tail-window (lazyload Phase 3)
- Apr 20: scroll-spy sentinel + meta-driven initial page size (Phase 4)
- Apr 21: incremental tail fetch for force-resync
- Apr 22: cursor-based `beforeMessageID` pagination (R2 revise)
- Apr 22: SSE bounded replay window (R1 revise)
- Apr 22: skill-layer status panel (new persistent SSE subscription)
- Apr 23: responsive-orchestrator Phase 1-9 (PendingSubagentNotice + new event types)
- Apr 23: force-refetch stacking bug lived from Apr 19 hotfix until Apr 23

Each was locally defensible; the aggregate exceeds the memory budget iOS gives a single tab on a long session.

---

## Goals / Non-Goals

### Goals

- Exactly one initial-load path (tail-first)
- Exactly one live path (SSE patch-in-place)
- Exactly one on-demand path (user-scrolled load-more)
- Zero feature flags, zero fallback retention
- Bounded memory: store size is a function of cap, not session length

### Non-Goals

- Preserve any form of continuity across tab-eviction or SSE drop
- Client-side persistence of previous store
- Progressive enhancement for desktop (one policy, two size constants)
- Chase the specific commit that "caused" this — the whole continuity design is wrong

---

## Decisions

### DD-1 — Tail sizes are tweak-controlled, hard-coded defaults

- `session_tail_mobile = 30`
- `session_tail_desktop = 200`
- `session_store_cap_mobile = 200`
- `session_store_cap_desktop = 500`

**Why:** Mobile 30 ≈ last 2-3 user/assistant rounds visible; 200 cap gives headroom for a session's worth of scroll-up. Desktop 200 initial covers typical usage without paging; 500 cap still bounded.
**How to apply:** All four values go in `tweaks.cfg`; read via existing `frontend-tweaks.ts`. Hard-coded defaults in the reader survive tweak fetch failure (fail-safe = small numbers, never unlimited).

### DD-2 — Server messages endpoint: single contract

`GET /session/:id/message?limit=N[&before=<messageID>]`

- No `beforeMessageID` (rename/remove); unified to `before`
- No cursor state, no ETag/304 dance, no Last-Event-ID
- Response: chronologically-ordered array of ≤ N messages

**Why:** One query param shape; server is stateless per request.
**How to apply:** Delete the cursor-bypass branch in the route; keep only the two-mode read (tail / before-cursor).

### DD-3 — SSE is live-only; no replay buffer

Server removes:
- Ring buffer of past events per session
- `Last-Event-ID` handler
- Any "replay events since X" code path

**Why:** Replay buffer consumed server memory AND encouraged client-side "catch up" paths. Client contract now says: missed events are lost; user re-triggers load-more if they care.
**How to apply:** SSE writer writes to live subscribers only; subscription timestamp is the epoch. No storage.

### DD-4 — Client store has a hard cap with LRU

Store is a chronologically-ordered list with max size = cap. On insert-beyond-cap:
1. Identify eviction candidates = all messages NOT in live-streaming set
2. Sort by position in list (oldest first)
3. Evict from head until size ≤ cap

**Why:** Bounded memory without complex tiered cache.
**How to apply:** New helper `evictToCap(store, cap, liveSet)` in `global-sync`. Called on every store mutation. Live-streaming set is a `Set<messageID>` maintained by the event-reducer (add on part.updated for streaming message, remove on message.updated with final flag).

### DD-5 — Load-more is explicit-gesture-only

The scroll-spy sentinel fires load-more only when intersecting via real scroll event. Programmatic scrollers (scroll-restore, scroll-to-bottom on new message) do NOT fire load-more.

**Why:** Without this, any programmatic scroll becomes a load-more trigger, defeating the point.
**How to apply:** IntersectionObserver callback checks `document.visibilityState === "visible"` AND a recent user-scroll marker (set in `scroll` listener, cleared after 500ms of idle). Both must be true.

### DD-6 — Truncated-part expand is part-scoped, not session-scoped

`FoldableMarkdown.expand` for a truncated completed part calls a NEW endpoint:

`GET /session/:id/message/:msgID/part/:partID` → returns the single part's full bytes.

**Why:** Replaces current behavior where expand calls `syncSession()` and pulls the entire session back.
**How to apply:** Add minimal route on server; client reducer patches just that part.

### DD-7 — No feature flag, no rollback

The removal is atomic on merge. If mobile breaks in new ways post-merge, we fix forward; we do not revert to the stacked-continuity state.

**Why:** User explicit: 「不保留錯誤設計」.
**How to apply:** Delete code, don't comment out. CI grep-check (DD-9) enforces.

### DD-8 — Removal inventory (authoritative)

Server:
- `packages/opencode/src/server/routes/session.ts`: remove `Last-Event-ID` handling, remove `beforeMessageID` alias (keep `before`), remove force-resync incremental tail branch
- `packages/opencode/src/session/sse-*` (wherever replay buffer lives): delete buffer + retention config
- Server SSE subscription code: strip "events since timestamp"

Client:
- `packages/app/src/context/sync.tsx`: delete `force:true` demote branch + every `force` path; unify to single tail-first load
- `packages/app/src/hooks/use-session-resume-sync.ts`: delete entire file (its job disappears)
- `packages/app/src/context/global-sync/event-reducer.ts`: remove replay/resume branches
- `packages/ui/src/components/message-part.tsx` (FoldableMarkdown): `expand` → part-scoped fetch
- `packages/app/src/entry.tsx`: remove reload-beacon diagnostic (diagnostic-only, no longer needed)

### DD-9 — CI grep-check

Post-implementation, add a one-line test that greps the bundle for forbidden symbols:

```
Last-Event-ID | beforeMessageID | force:true | forceRefetch | SSEReplayBuffer
```

Zero hits required. Run in `bun test` suite.

### DD-10 — Desktop UX change is accepted

Previously desktop full-hydrated. Now desktop shows last 200 + scroll-up loads older. User explicitly signed off on uniform policy.
**How to apply:** docs/events entry documents this as breaking UX change; no migration needed (session data untouched).

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| iOS WebKit OOM persists even at 200-cap (maybe DOM itself is the hog, not store) | R4 cap + bundle-level message virtualization might still be needed. If post-merge OOM recurs, open follow-up spec `mobile-message-virtualization` |
| User confused "why doesn't middle of session appear" | UI hint at top of list: "Scroll up to load older" |
| Live-streaming set leaks (message never marked complete) | Audit `message.updated` event firing; add watchdog to auto-demote after 5min of no updates |
| Removed replay buffer breaks TUI / CLI clients that relied on it | Verify TUI uses `/message?limit` only (it does, per code read); CLI doesn't use SSE |
| Third-party API consumers depended on `Last-Event-ID` | None known; internal-only protocol |

---

## Critical Files

- `packages/opencode/src/server/routes/session.ts` — route contract
- `packages/opencode/src/session/` — SSE subscription + reducer on server (replay buffer)
- `packages/app/src/context/sync.tsx` — client load orchestration
- `packages/app/src/context/global-sync/event-reducer.ts` — event application
- `packages/app/src/hooks/use-session-resume-sync.ts` — **to delete**
- `packages/ui/src/components/message-part.tsx` — FoldableMarkdown
- `packages/ui/src/hooks/create-auto-scroll.tsx` — scroll-spy integration
- `/etc/opencode/tweaks.cfg` — four new tweak keys
