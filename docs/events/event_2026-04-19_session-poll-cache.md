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
