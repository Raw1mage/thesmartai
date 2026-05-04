# Error Catalogue

## Error Catalogue

| Code | User-visible message | Trigger | Recovery | Responsible layer |
|------|---------------------|---------|----------|-------------------|
| `TAIL_FETCH_FAILED` | "Couldn't load messages. Retry?" | Tail-first `GET /message?limit=N` returns non-2xx or network error on session open | Retry button; on second failure show fallback empty state with retry action | `sync.tsx` |
| `LOADMORE_FETCH_FAILED` | "Couldn't load older messages." (toast) | `GET /message?limit=N&before=<id>` fails during scroll-up | Toast with retry; user can re-scroll to re-trigger | `sync.tsx` + scroll-spy |
| `PART_EXPAND_FAILED` | "Couldn't load full content." (inline error) | `GET /message/:mid/part/:pid` fails | Inline error replaces spinner; truncated view preserved so user can re-click expand | `FoldableMarkdown` |
| `PART_NOT_FOUND` | "That message part is no longer available." | 404 from part endpoint (message compacted or deleted) | Inline error; do not retry | server `session.ts` → client `FoldableMarkdown` |
| `SSE_UNAVAILABLE` | (silent; log only) | EventSource fails to connect or repeatedly errors | Exponential backoff via EventSource default; no user notification unless sustained > 1min | `event-source` wrapper |
| `STORE_CAP_EXCEEDED_LIVE_PROTECTED` | (no user message; internal warn) | Store is at cap AND all remaining messages are live-streaming (cannot evict) | Allow store to exceed cap temporarily; log warn with liveSet size + cap | `evictToCap` |
| `LIVE_SET_WATCHDOG_DEMOTE` | (no user message; internal info) | A messageID in live-streaming set received no update for 5min | Auto-remove from live-set; make LRU-eligible | reducer watchdog |
| `TWEAK_FETCH_FAILED` | (silent; use defaults) | `GET /config/tweaks/frontend` fails | Hard-coded defaults (DD-1 values) take effect; retry silently | `frontend-tweaks.ts` |
| `INVALID_QUERY_BEFORE` | "Bad request" (400) | Client sends `before=<malformed>` | Server 400 with body `{error: "invalid before id"}`; client toast + fail-safe stops load-more | server `session.ts` route |

## Error Flow Notes

- **No error covers SSE drop.** SSE drop is intentional silent behavior per R2 — missed events are lost; user recovers via scroll-up if they care.
- **No error covers "session changed server-side during tab background".** The user's tail-first refetch on next route entry naturally fetches latest state; no diff/reconcile error possible.
- **`PART_NOT_FOUND` replaces the previous `expand → syncSession → session missing` cascade.** Old behavior would nuke the whole store on a missing part; new behavior confines the failure to that part.
