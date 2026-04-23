# event: mobile-tail-first-simplification — architectural deletion of session continuity machinery

**Date**: 2026-04-24
**Spec**: `specs/mobile-tail-first-simplification/` (state: planned → verified after fetch-back)
**Supersedes (partial)**: `specs/frontend-session-lazyload` R1 (SSE bounded replay) / R2 (cursor pagination on cold open)
**Branch**: `beta/mobile-tail-first-simplification`
**Stop gate released by**: user ("手機永遠tail first這件事先做。然後廢掉那些繁複的continuity機制")

---

## Why

Mobile iOS Safari tabs on long sessions (cisopro, 600+ messages) were OOM-killed by WebKit, showing "無法開啟這個網頁". Prior work — `mobile-session-restructure` stripping `FileDiff.before/after` from on-disk + wire — slimmed persistent state but did NOT fix the crash. Reproduction confirmed: no JS-driven reload fires (`window.location.reload` monkey-patch beacon sees nothing), no `vite:preloadError`, no `unhandledrejection` — the tab is evicted by the OS before any handler runs.

Root cause is the aggregate memory pressure of continuity mechanisms added between 2026-04-19 and 2026-04-23:

- Apr 20 — part-level tail-window + scroll-spy sentinel + meta-driven initial page size (lazyload Phase 3-4)
- Apr 21 — incremental tail fetch for force-resync (`since` param)
- Apr 22 — cursor-based `beforeMessageID` pagination (R2)
- Apr 22 — SSE bounded replay window (R1)
- Apr 22 — skill-layer status panel (new persistent SSE subscription)
- Apr 23 — responsive-orchestrator phases 1-9 (new event types, pending notice store)
- Apr 19–Apr 23 — `force-refetch` stacking bug caused full session re-download on every visibility/online/reconnect

Each defensible in isolation; the sum exceeded the mobile memory budget for a single tab.

## Decision

Collapse to exactly one initial-load path (tail-first), one live path (SSE patch-in-place), one on-demand path (user-scrolled load-more). **No feature flag, no fallback retention** — per user ("不保留錯誤設計").

Deleted (DD-8 inventory):

- Server `_sseBuffer` ring buffer + replay plan + `Last-Event-ID` handling
- Server `Tweaks.sseReplay` config + `sse_reconnect_replay_*` keys
- Server `session.messages` `since` param (force-resync incremental tail)
- Server `session.messages` `beforeMessageID` alias → renamed canonical `before`
- Server `/api/v2/global/debug/reload-beacon` diagnostic route
- Client `packages/app/src/pages/session/use-session-resume-sync.ts` (entire file)
- Client `sync.session.sync` `force` option + every caller's `{force: true}`
- Client `loadMessagesIncremental` (relied on removed `since`)
- Client `FoldableMarkdown.expand → syncSession()` (replaced with scoped part fetch)

Added:

- Server `GET /session/:sid/message/:mid/part/:pid` — scoped part fetch for expand
- Client `patchPart` helper + `onExpandPart` DataProvider callback
- Client `isMobile()` + platform-specific tail sizes via tweaks (mobile=30, desktop=200)
- Client `evictToCap` scaffolding (store LRU — follow-up work will wire every mutation site)
- Server tweaks: `session_tail_mobile|desktop`, `session_store_cap_mobile|desktop`, `session_part_cap_bytes`
- CI `tail-first-guard.test.ts`: grep forbidden symbols in source tree, zero hits required

## Desktop UX change (accepted)

Previously desktop session-open full-hydrated. Now desktop shows last 200 messages; older loads on scroll-up. Uniform policy with mobile; reviewed and signed off.

## Not recovered

- Missed SSE events during a network drop are lost — clients recover by scroll-up (intentional per R2)
- `Last-Event-ID` header is unused; any third-party consumer that depended on it breaks. None known (internal protocol only).

## Validation

- Phase 9 mobile smoke outstanding — user must test iPhone against cisopro session
- tsc clean in `packages/app` and `packages/ui`
- `test/server/tail-first-guard.test.ts` green

## Net diff

7 commits on `beta/mobile-tail-first-simplification`:

- Phase 1 `db10299e0` — server continuity removal (-466 LOC)
- Phase 2 `7b8992c16` — part-scoped endpoint (+40 LOC)
- Phase 3–6 `f412c0154` — client tail-first + scoped expand (-191 LOC)
- Phase 7 `ecf924c58` — tweaks plumbing (+67 LOC)
- Phase 8 (this) — CI guard + docs + supersede marking

Roughly −550 LOC net in production code.

## Follow-up

- `evictToCap` hard cap enforcement at every store mutation site (currently only the helper + live-streaming set scaffolding exist — full wiring deferred until we see post-merge memory behaviour on mobile)
- If iOS OOM recurs at 200-cap: open `mobile-message-virtualization` spec (windowed DOM render)
