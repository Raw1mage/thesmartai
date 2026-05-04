# Tasks

## Phase 1 — Server: remove continuity machinery

- [ ] 1.1 Remove SSE replay buffer implementation (find via grep `replay|Last-Event-ID` in `packages/opencode/src/session/` + `server/sse*.ts`); delete buffer storage + retention config
- [ ] 1.2 Remove `Last-Event-ID` header handling in SSE subscribe endpoint
- [ ] 1.3 Remove `beforeMessageID` query param alias in `packages/opencode/src/server/routes/session.ts`; rename to `before` only
- [ ] 1.4 Remove `/session/:id/message` force-resync incremental-tail branch (the one introduced by `424266316`)
- [ ] 1.5 Confirm `GET /session/:id/message?limit=N[&before=<id>]` is the only remaining path; remove cursor-bypass-ETag branch
- [ ] 1.6 Unit: server test for new contract — `limit=N` returns last N chrono; `limit=N&before=X` returns N older-than-X chrono; no other params accepted

## Phase 2 — Server: add part-scoped endpoint

- [ ] 2.1 New route: `GET /session/:id/message/:msgID/part/:partID` returns `{ part }` (full part, no truncation)
- [ ] 2.2 404 if msg/part not found; 400 if IDs malformed
- [ ] 2.3 Unit: returns untruncated part regardless of size (this endpoint bypasses `session_part_cap_bytes` — cap is wire/store concern, not fetch)

## Phase 3 — Client: delete force-refetch paths

- [ ] 3.1 Delete `packages/app/src/hooks/use-session-resume-sync.ts` entirely
- [ ] 3.2 Remove import + call sites (grep `use-session-resume-sync` / `useSessionResumeSync`)
- [ ] 3.3 In `packages/app/src/context/sync.tsx`: delete `force:true` parameter + all branches reading it; `syncSession()` signature drops `force` option
- [ ] 3.4 In `packages/app/src/context/global-sync/event-reducer.ts`: delete any replay/resume branches
- [ ] 3.5 Remove `visibilitychange`, `online`, `opencode:sse_reconnect`, `pageshow` dispatch sites that called `syncSession({force:true})`
- [ ] 3.6 Remove reload-beacon diagnostic code from `packages/app/src/entry.tsx` (added in `3a3d347c7` + `6b4829e57` — diagnostic only)
- [ ] 3.7 Remove server-side `/api/v2/global/debug/reload-beacon` route

## Phase 4 — Client: tail-first single path + store cap

- [ ] 4.1 `sync.tsx`: `syncSession()` always fetches `?limit=N` where N = `session_tail_mobile` (if mobile) or `session_tail_desktop` (desktop); no other call shapes
- [ ] 4.2 Platform detection helper: `isMobile()` based on viewport + UA (existing util if any; otherwise add small one)
- [ ] 4.3 Route-change handler: on leave `/session/:id`, discard store (no cache retention)
- [ ] 4.4 On re-enter: fresh tail-first fetch (no delta merge against stale store)
- [ ] 4.5 New helper `evictToCap(messages, cap, liveStreamingSet)` in `global-sync/`: returns pruned list, keeps newest + all live-streaming, evicts oldest non-streaming
- [ ] 4.6 Wire `evictToCap` into every store-mutation path (tail load, load-more prepend, SSE insert/update)
- [ ] 4.7 `liveStreamingSet: Set<messageID>` maintained in reducer: add on first streaming part.updated for a message; remove on message.updated with final flag
- [ ] 4.8 Watchdog: if a messageID stays in liveStreamingSet > 5min without update, auto-demote (guards against event loss)

## Phase 5 — Client: gesture-gated load-more

- [ ] 5.1 `packages/ui/src/hooks/create-auto-scroll.tsx`: ensure scroll-spy intersection handler reads user-gesture marker set by `scroll` / `wheel` / `touchmove` listeners (set on event, clear after 500ms idle)
- [ ] 5.2 Both conditions required before firing load-more: sentinel intersecting AND marker fresh AND `document.visibilityState === "visible"`
- [ ] 5.3 `syncSession()` load-more branch: `GET /message?limit=N&before=<oldestID>`; prepend result; call `evictToCap`
- [ ] 5.4 UI hint at top of list: "Scroll up to load older" (i18n en + zh)

## Phase 6 — Client: part-scoped expand

- [ ] 6.1 `packages/ui/src/components/message-part.tsx` (FoldableMarkdown): `expand` handler calls new endpoint `/session/:id/message/:mid/part/:pid`, NOT `syncSession()`
- [ ] 6.2 Add reducer action `patchPart(msgID, partID, fullPart)` that replaces just that part, clears `truncatedPrefix`
- [ ] 6.3 Progress + error UI: spinner while fetching; error toast on failure, keep truncated view

## Phase 7 — Tweaks + config

- [ ] 7.1 Add keys to `/etc/opencode/tweaks.cfg`: `session_tail_mobile=30`, `session_tail_desktop=200`, `session_store_cap_mobile=200`, `session_store_cap_desktop=500`, `session_part_cap_bytes=512000`
- [ ] 7.2 `packages/app/src/context/frontend-tweaks.ts`: expose all 5 keys with hard-coded safe defaults (same values); fail-safe on fetch failure
- [ ] 7.3 Update templates: `templates/opencode.cfg` or equivalent — document the 5 keys

## Phase 8 — CI guard + docs

- [ ] 8.1 Add test `packages/opencode/src/session/tail-first-guard.test.ts`: greps built bundle + source tree for forbidden symbols: `Last-Event-ID`, `beforeMessageID`, `force:\\s*true`, `forceRefetch`, `SSEReplayBuffer`, `use-session-resume-sync`. Zero hits required (skip spec/docs dirs)
- [ ] 8.2 `docs/events/event_2026-04-24_mobile-tail-first-simplification.md`: record architectural decision + desktop UX change
- [ ] 8.3 `specs/architecture.md`: update session-data-flow section to reflect new one-path model
- [ ] 8.4 Promote `specs/_archive/frontend-session-lazyload` via plan-builder amend mode: mark R1 + R2 + cursor/pagination sections `[SUPERSEDED by mobile-tail-first-simplification]`

## Phase 9 — Validation

- [ ] 9.1 Desktop smoke: open long session (cisopro), verify 200 most recent shown, scroll-up loads 200 older batch
- [ ] 9.2 Mobile smoke: open cisopro on iOS Safari, leave tab 30min, foreground, send message — no reload, no OOM
- [ ] 9.3 DevTools Memory tab: session page heap stays < 50MB on mobile profile
- [ ] 9.4 SSE drop test: toggle network offline 10s, back online — no HTTP fetch fires, SSE reconnects, live events resume
- [ ] 9.5 Run grep-check from 8.1 against final beta bundle
- [ ] 9.6 beta-workflow fetch-back: `test/mobile-tail-first-simplification` branch merged into test, all tests pass
- [ ] 9.7 Finalize: merge test branch → main, delete test branch + beta branch
