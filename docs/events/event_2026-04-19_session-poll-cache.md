# 2026-04-19 — session-poll-cache

Spec: [specs/session-poll-cache/](../../specs/session-poll-cache/)
Implementation branch: `beta/session-poll-cache` at `/home/pkcs12/projects/opencode-beta`
Base branch: `main`
State machine: `proposed` → `designed` → `planned` → `implementing` (2026-04-19)

## Baseline observation (pre-work)

- daemon `bun` CPU: ~44% averaged over 2h (54m CPU / 125m wall)
- `/api/v2/session/{id}/message` latency: 48–61 ms, ~20 req/s polling
- Root cause confirmed: each request runs `Session.messages(sessionID, 400)` →
  `MessageV2.stream(sessionID)` → N filesystem reads per call; no cache, no ETag.
- Worker→daemon bus bridge for `MessageV2.Event.*` / `Session.Event.*` already
  exists at `packages/opencode/src/tool/task.ts:371-409`
  (`publishBridgedEvent`). The design relies on this being complete.

## Phase 1 — Foundation (tweaks.cfg loader + health endpoint)

Completed: 2026-04-19

### Done (tasks 1.1–1.5)

- **1.1** `packages/opencode/src/config/tweaks.ts` (`Tweaks` namespace)
  - Parses `/etc/opencode/tweaks.cfg` (override via `OPENCODE_TWEAKS_PATH`)
  - INI-style `key=value`; `#` / `;` comments; blank lines ignored
  - Missing file → defaults + single `log.info`
  - Invalid value → `log.warn` + per-key fallback (AGENTS.md rule 1)
  - Unknown keys warned; malformed lines warned
  - Exposes `loadEffective()`, `sessionCache()`, `rateLimit()`, `resetForTesting()`
- **1.2** `templates/system/tweaks.cfg`
  - Default template with documentation for every key, ready to ship to
    `/etc/opencode/tweaks.cfg`. Co-located with existing `opencode.cfg`.
- **1.3** `packages/opencode/src/server/routes/cache-health.ts`
  - `GET /cache/health` Hono route returning the full `CacheHealthResponse`
    schema from data-schema.json
  - Phase 1 uses placeholder stats; Phase 2/5 will register real providers
    via `registerCacheStatsProvider` / `registerRateLimitStatsProvider`
  - Error path returns `503 { code: "HEALTH_UNAVAILABLE" }` with `log.error`
- **1.4** Route mounted in `packages/opencode/src/server/app.ts`
  - `api.route("/server", ServerRoutes())` → endpoint lives at
    `/api/v2/server/cache/health`
  - Rate-limit middleware doesn't exist yet (Phase 4); the exempt list **must**
    include `/api/v2/server/*` and `/api/v2/global/health` when that work lands.
- **1.5** `packages/opencode/test/config/tweaks.test.ts`
  - 9 passing unit tests: defaults on missing file, full valid load,
    invalid integer, invalid boolean, below-minimum rejection, non-positive
    float rejection, unknown-key tolerance, malformed-line tolerance,
    accessor parity with `loadEffective`

### Validation

- `bun run typecheck` — no new errors introduced by these files (pre-existing
  baseline errors in `cli/cmd/uninstall.ts`, `mcp/index.ts`, etc. untouched)
- `bun test test/config/tweaks.test.ts` — 9 pass, 0 fail, 309 ms
- `bun run scripts/plan-sync.ts specs/session-poll-cache/` — clean (no drift)

### Key decisions captured this phase

- **Mount point `/server`** chosen literally per spec R-4 rather than folding
  into existing `/global`. Single endpoint today; future ops endpoints
  (`/server/connections`, `/server/pressure`, …) will extend this file.
- **Stats providers are registered, not imported.** Phase 1 uses a placeholder
  callback and exposes `registerCacheStatsProvider` / `registerRateLimitStatsProvider`
  so session-cache and rate-limit modules in later phases wire themselves
  without `cache-health.ts` importing them (avoids circular deps).
- **Tweaks loader is async-memoized.** First caller triggers disk read;
  concurrent callers share the same promise. `resetForTesting()` is the only
  way to re-read (matches opencode's "restart to apply" convention).

### Drift / follow-ups

- None blocking. Phase 4 must register `/api/v2/server/*` as exempt from the
  rate-limit middleware at introduction time — flagged in tasks.md 1.4 note
  and in Phase 4 task 4.2.

## Next (Phase 2 — Session read cache)

Starting immediately per plan-builder §16.5 (phase boundary is a checkpoint,
not a pause). First task: inventory all bus-event-emitting write paths to
confirm cache coverage.

## Phase 2 — Session read cache

Completed: 2026-04-19

### Stop-gate #1 (handoff): bus bridge coverage audit

Grep over `packages/opencode/src/**` for `Bus.publish(MessageV2.Event.*)` and
`Bus.publish(Session.Event.Updated|Created|Deleted)` found 12 publish sites.
All 7 subscriber-relevant types are covered:

| Event type | Publisher(s) | Process | Daemon delivery path |
|---|---|---|---|
| `MessageV2.Event.Updated` | `session/index.ts:832`, `session/message-v2.ts:1313` | worker/daemon | direct or via `publishBridgedEvent` (task.ts:375) |
| `MessageV2.Event.Removed` | `session/index.ts:857`, `session/message-v2.ts:1335`, `session/revert.ts:101` | worker/daemon | direct or bridged (task.ts:378) |
| `MessageV2.Event.PartUpdated` | `session/index.ts:926/932`, `session/message-v2.ts:1322` | worker/daemon | direct or bridged (task.ts:381) |
| `MessageV2.Event.PartRemoved` | `session/index.ts:873`, `session/revert.ts:110` | worker/daemon | direct or bridged (task.ts:384) |
| `Session.Event.Created` | `session/index.ts:477` | daemon | direct |
| `Session.Event.Updated` | `session/index.ts:491/560`, also bridged (task.ts:387) | daemon/worker | direct or bridged |
| `Session.Event.Deleted` | `session/index.ts:812` | daemon | direct |

No gaps found. Stop-gate #1 **passes** without remediation — the cache can
trust the existing bus infrastructure.

### Done (tasks 2.1–2.6)

- **2.2** `packages/opencode/src/server/session-cache.ts` (`SessionCache` namespace)
  - In-process LRU using `Map<key, Entry>` insertion-order semantics
  - Keys: `session:<id>`, `messages:<id>:<limit>`
  - Per-session monotonic version counter (I-4); bumped on every
    MessageV2.Event / Session.Event.Created|Updated, cleared on Deleted
  - `get(key, sessionID, loader)` with TTL + LRU enforcement
  - Bus events emitted: `session-cache.hit|miss|invalidated|evicted`
  - Registers itself as stats provider via `registerCacheStatsProvider`
  - `resetForTesting` + `setSubscriptionAliveForTesting` for clean unit tests
- **2.3** Subscribers registered at daemon startup in `src/index.ts` after
  existing `registerDebugWriter` / `registerTelemetryRuntimePersistence` /
  `registerTaskWorkerContinuationSubscriber` calls
- **2.4** Subscription registration wrapped in try/catch; failure path sets
  `subscriptionAlive=false`, issues `log.warn`, and still registers the
  stats provider so `/cache/health` can surface the degraded state
- **2.5** `Session.Event.Deleted` subscriber calls `forgetSession` which both
  drops cache keys and clears the per-session version counter (I-4 cleanup)
- **2.6** `packages/opencode/test/server/session-cache.test.ts` — 10 passing
  tests: miss-then-hit, loader skip, invalidate, bus-event-driven
  invalidation for `MessageV2.Event.Updated` and `PartUpdated`,
  `Session.Event.Deleted` counter cleanup, TTL expiry (ttlSec=0 edge),
  LRU eviction under max=2, subscriptionAlive=false never memoizes,
  cache-disabled tweaks short-circuit

### Validation

- `bun run typecheck` — no new errors
- `bun test test/server/session-cache.test.ts` — 10 pass, 0 fail, 1.2 s
- `bun run scripts/plan-sync.ts specs/session-poll-cache/` — clean (no drift)

### Drift / follow-ups

- None. Phase 3 will wire the cache into the actual HTTP routes.
