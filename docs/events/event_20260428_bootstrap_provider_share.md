# 2026-04-28 — `bootstrapDirectory` reuses global provider snapshot

## Symptom

Each opened project triggered its own `GET /api/v2/provider` request during
bootstrap. With N projects open, N+1 identical fetches fired (one global +
one per directory). Operator-visible: when a stale OAuth account caused
`/provider` to be slow or to error-toast, the noise scaled with project
count.

## Why was it N+1?

`bootstrapGlobal` populates `GlobalStore.provider` from `provider.list()`.
`bootstrapDirectory` then calls `provider.list()` again into the
per-directory `State.provider`. Both request the same global endpoint
without a directory parameter — the per-directory store is just a snapshot
of the same global data.

`refreshProviderState(directory)` (account add/remove flow) already does
`refreshGlobal({ provider: true })` *before* `bootstrapInstance(directory)`,
so global is always fresh by the time a child reads from it. The duplicate
SDK call added latency and load with no data-freshness benefit.

## Fix

`bootstrapDirectory` accepts an optional `providerSnapshot: ProviderListResponse`.
If non-empty, it copies the snapshot into the per-directory store and
skips the SDK round-trip. If absent or empty (e.g. very early in app
load before global bootstrap completes), falls back to the original
`provider.list()` call so first-paint behaviour is unchanged.

`bootstrapInstance` in `global-sync.tsx` passes `globalStore.provider` as
the snapshot.

## Files touched

- `packages/app/src/context/global-sync/bootstrap.ts` — added param +
  conditional skip
- `packages/app/src/context/global-sync.tsx` — pass `globalStore.provider`
  through
- `docs/events/event_20260428_bootstrap_provider_share.md` — this file

## Result

`GET /provider` count per workspace bootstrap drops from `N+1` to `1`,
where N = number of opened projects. No data-shape change, no behaviour
change beyond fewer requests.
