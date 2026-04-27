# 2026-04-28 — Codex token refresh: root-cause storm fix + dead-state settlement

## Symptom chain (today, in order)

1. Three codex accounts (`ivon0829@gmail.com`, `raw@sob.com.tw`,
   `yeatsluo@thesmart.cc`) suddenly returned `401 invalid_grant` on every
   refresh.
2. The 401 propagated as a thrown exception out of
   `refreshAccessToken` → `refreshIfNeeded` → auth-plugin loader →
   `Provider.list()` → `/provider` returned `500` → web-app bootstrap
   toasted `Failed to bootstrap instance` repeatedly.
3. Later in the day a related symptom: `ProviderInitError` on dispatch,
   because an interim try/catch wrapper swallowed the loader throw and
   left `modelLoaders[family]` un-wired.

## Real RCA

### Surface bug
`refreshAccessToken` threw on **every** non-2xx response, including the
4xx range (refresh_token revoked / rotated-out / signed for a different
client). A permanently dead refresh_token is a settled outcome, not an
exception — throwing converted that into a runaway error path.

### Storm bug (the actual reason 3 accounts died at once)
Before this fix, the auth-plugin loader called `refreshIfNeeded` eagerly
inside `Provider.list()`. Every `GET /api/v2/provider` therefore poked
the upstream OAuth endpoint with the current refresh_token. The web-app
calls `/provider` once per opened project (via per-directory child
bootstrap), plus extras on SSE reconnect / focus / account changes.

Opening N projects when an access_token had just expired created N
parallel refresh attempts holding the **same** refresh_token. OpenAI's
rotating-token contract: the first wins (gets a new refresh_token, old
one revoked); the others arrive with the now-revoked token and get 401.
Token death cascade.

The single-process `refreshTokenWithMutex` was not protection — it was
keyed on a single module-level promise, not on the refresh_token
itself. So in the rare case it did intercept a parallel call, it would
return *another account's* tokens to the loser (silent corruption);
more commonly, parallel calls had different module-level identity and
all flew through unmutexed.

## Fix (refresh layer only — no caller wrappers, no fallbacks)

### 1. `refreshAccessToken` contract becomes three-way
`packages/opencode-codex-provider/src/auth.ts`
- 2xx → resolves with `TokenResponse`
- 4xx → resolves with `null` (refresh_token is permanently dead)
- 5xx / network error → throws (transient, real exception)

### 2. Per-token mutex (replaces the broken module-level singleton)
Same file. `refreshTokenWithMutex` now uses
`Map<refreshToken, Promise<TokenResponse | null>>`. Concurrent callers
with the same refresh_token coalesce onto one upstream call; different
tokens never share a promise. Empty `refreshToken` short-circuits to
`null` (no point pinging upstream with no credential).

### 3. Lazy refresh becomes the SOLE refresh path
`packages/opencode/src/plugin/codex-auth.ts`
- Eager `refreshIfNeeded` call removed from the auth-plugin loader.
- `refreshIfNeeded` itself deleted (was the only caller).
- The loader now returns whatever credentials are on disk, expired or
  not. Refresh is performed by `ensureValidToken` inside the codex
  provider, fired only on real API calls — i.e. once per session, not
  once per project bootstrap.

### 4. Lazy refresh now persists
Same file, inside `getModel`. `createCodex` is called with an
`onTokenRefresh` callback that writes new credentials back via
`client.auth.set`. Without this, refreshes from `ensureValidToken`
would be memory-only; a process restart would resurrect a rotated-out
refresh_token and walk into a 401 immediately.

### 5. Dead-state persistence inside the codex provider
`packages/opencode-codex-provider/src/provider.ts`
`ensureValidToken` handles `null` from `refreshTokenWithMutex` by:
clearing local creds, calling `onTokenRefresh` to persist the cleared
state, then throwing `re-login required` to the request caller. The
account is now permanently dead-on-disk; future
`refreshTokenWithMutex` calls short-circuit on the empty refresh_token
guard. No more pounding upstream with a known-dead token.

## Reverted (this morning's wrong-layer patches)

- Three `try/catch` wrappers around `plugin.auth.loader(...)` in
  `provider.ts` (family / per-account / github-copilot-enterprise).
  Reverting them is safe now because the loader no longer throws on
  dead refresh_tokens.
- The four-line interim `modelLoaders[family]` backfill in the
  per-account loop.
- The two earlier event docs:
  `event_20260428_provider_list_fault_tolerance.md` and
  `event_20260428_provider_modelloaders_account_fallback.md`.

## End-state behaviour

- `GET /provider` makes **zero** OAuth calls. Listing is purely a disk
  read.
- A dead refresh_token is detected exactly once at first API use,
  cleared on disk, and never poked again.
- N projects open with a 1-hour access_token and a healthy refresh:
  first API call by any session triggers one refresh through the
  per-token mutex; the other sessions reuse the result.
- Re-login (existing flow) writes a new refresh_token; next API call
  works normally.

## Known-not-fixed: cross-process race

If `opencode` and `opencode-beta` (or two daemons under a multi-user
gateway) hold the same refresh_token simultaneously and both refresh
in the same access-expiry window, neither process's per-token mutex
sees the other. The race surface is much smaller than before (no more
eager refresh on every `/provider`), but it still exists. Proper
defence is a file lock around `accounts.json` writes or a
single-owner persistence layer; left for a future change.

## Files touched

- `packages/opencode-codex-provider/src/auth.ts`
- `packages/opencode-codex-provider/src/provider.ts`
- `packages/opencode/src/plugin/codex-auth.ts`
- `packages/opencode/src/provider/provider.ts` (revert to baseline)
- `docs/events/event_20260428_codex_refresh_dead_token_settles.md`
  (this)
