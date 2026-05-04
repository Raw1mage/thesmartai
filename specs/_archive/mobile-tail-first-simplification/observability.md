# Observability

## Events

- `session.tail_load.requested` — `{ sessionID, platform, limit }`; emitted when initial tail fetch starts
- `session.tail_load.completed` — `{ sessionID, count, elapsedMs }`; success path
- `session.tail_load.failed` — `{ sessionID, status, elapsedMs }`; maps to `TAIL_FETCH_FAILED`
- `session.loadmore.requested` — `{ sessionID, beforeID, limit }`; user scroll-up triggered
- `session.loadmore.completed` — `{ sessionID, count, elapsedMs }`
- `session.loadmore.failed` — `{ sessionID, beforeID, status }`
- `session.part_expand.requested` — `{ sessionID, msgID, partID }`
- `session.part_expand.completed` — `{ bytes, elapsedMs }`
- `session.part_expand.failed` — `{ sessionID, msgID, partID, status }`
- `session.store.evicted` — `{ sessionID, evictedCount, reason: "cap" }`; fired when `evictToCap` removes messages
- `session.live_set.demoted` — `{ sessionID, msgID, sinceLastUpdateMs }`; 5min watchdog fires
- `sse.reconnect.silent` — `{ sessionID, dropDurationMs }`; confirms no resync triggered (contrast with pre-change behavior)

## Metrics

- `session_tail_load_duration_ms` — histogram, tagged by platform (mobile/desktop)
- `session_store_size` — gauge, sampled per session; asserts ≤ cap
- `session_live_set_size` — gauge
- `session_loadmore_count` — counter, tagged by platform; expect low on mobile, higher on desktop
- `session_part_expand_count` — counter
- `sse_reconnect_count` — counter; confirms reconnects happen (to prove SSE still works) but no refetch side effects
- `session_oom_suspected` — (optional, if server sees unusual session-close patterns per platform/user)

## Logs

- Server:
  - `service=session.route` on every `/message` request with `{limit, before?, elapsedMs, resultCount}`
  - `service=session.part.route` on every part-scoped fetch
  - Replay buffer / Last-Event-ID log entries **removed** (they no longer exist)
- Client (via existing beacon channel if kept, else console):
  - Tail-load + load-more duration
  - Evict events summary (periodic, not per-mutation)

## Alerts

- **`session_tail_load_duration_ms{p95} > 2000`** on mobile → investigate server-side query perf
- **`session_store_size{max} > cap * 1.5`** sustained > 5min → liveSet leak; watchdog not firing
- **`session.loadmore.failed{rate} > 5%`** → server-side `before=` query regression

## Verification Probes

- Post-merge mobile smoke: manually trigger each of 5 forbidden paths (background/foreground, offline/online, SSE drop, send-while-hidden) and confirm gateway log shows NO `/message?` hits (only new message POSTs + SSE subscribe).
- Chrome DevTools Memory snapshot on cisopro session: heap reasonable (< 50MB target).
