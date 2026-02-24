# Event: Web Auth 401 Loop — Root Cause & Fixes (2026-02-24)

## Symptom

After the previous commit (`61ea7d4d7 fix(web): align model activity selector and global directory browsing`),
opening `http://localhost:1080` in a browser showed **no login screen**. The app
rendered the main UI shell directly, and every API call (`/api/v2/session/list`,
`/api/v2/config`, SSE streams) responded `401 Unauthorized`, creating an
infinite error loop visible in DevTools.

## Root Cause (Primary)

**The server was proxying the frontend from `app.opencode.ai` (upstream CDN)
instead of serving the local CMS build.**

In `packages/opencode/src/server/app.ts`, when `OPENCODE_FRONTEND_PATH` is not
set, the server falls back to reverse-proxying the official hosted frontend at
`https://app.opencode.ai`. That upstream version has no `AuthGate`, no login
form, and no `authorizedFetch` — it assumes unauthenticated local access. When
paired with the htpasswd auth middleware on our server, every request from the
upstream frontend was missing session cookies and failed with 401.

The start script (`scripts/tools/start-opencode-web.sh`) did not set
`OPENCODE_FRONTEND_PATH`, so the server always fell through to the CDN proxy.

**Fix**: Set `OPENCODE_FRONTEND_PATH` in the start script to point to the local
CMS build (`$PROJECT_ROOT/packages/app/dist`), which includes AuthGate, the
login form, and `authorizedFetch`.

## Root Cause (Secondary)

Several additional bugs were stacked on top:

### 1. Session error handling silently disabled auth

In `web-auth.tsx`, the session fetcher's error path returned
`{ enabled: false, authenticated: true }` for **any** non-OK HTTP response.
This told `AuthGate` that authentication was disabled server-side, granting
full access without login. Only a 404 (server doesn't support auth at all)
should bypass auth.

**Fix**: Only 404 returns `{ enabled: false, authenticated: true }`. All other
errors return `{ enabled: true, authenticated: false }`, forcing the login UI.

### 2. authorizedFetch didn't carry credentials for SDK Request objects

The `createOpencodeClient` SDK constructs `new Request(url, init)` and calls
`_fetch(request)` with a single Request argument. The refactored
`authorizedFetch` used `fetch(input, { credentials: "include", ...init })`,
which doesn't properly carry credentials when `input` is already a Request
object (the init spread doesn't override Request internals).

**Fix**: Reverted to the Request-cloning pattern:
```typescript
const request = new Request(input, init)
const headers = new Headers(request.headers)
// ... add CSRF header if mutation ...
const next = new Request(request, { headers, credentials: "include" })
return fetch(next)
```

### 3. htpasswd password mismatch

The argon2id hash stored in `~/.config/opencode/.htpasswd` didn't match the
expected password. The hash was generated during a debug session with an
unknown input.

**Fix**: Regenerated with `Bun.password.hash()` using the correct password.
Created `scripts/webadmin.sh` as a proper management tool.

### 4. Auto-heal effect firing outside AuthGate

`server.tsx` contained a `createEffect` that called authenticated API endpoints
to "heal" stale project directories. This effect ran **outside** the AuthGate
boundary, so it fired before login, generating 401 noise on every page load.
The same healing logic already exists inside `GlobalSDKProvider` and
`bootstrap.ts`, which run after authentication.

**Fix**: Removed the redundant effect from `server.tsx`.

### 5. Cookie Secure flag behind reverse proxy

The session cookie was set with `secure: true` based on `c.req.url` protocol.
Behind a reverse proxy (nginx with SSL termination), the backend URL is always
`http://`, so the Secure flag was never set, and cookies were rejected on HTTPS.

**Fix**: Added `isSecureRequest()` helper in `web-auth.ts` that checks the
`X-Forwarded-Proto` header before falling back to URL protocol.

## All Changes

### Server-side
- **`packages/opencode/src/server/app.ts`** — Restructured to `api` sub-Hono
  with dual mount (`/api/v2` and `/`); directory resolution middleware now runs
  for all routes including `/global/*`; added local frontend serving via
  `OPENCODE_FRONTEND_PATH`; added `X-Opencode-Resolved-Directory` response
  header; directory existence check with cwd fallback
- **`packages/opencode/src/server/web-auth.ts`** — Added `isSecureRequest()`
  for X-Forwarded-Proto cookie handling
- **`packages/opencode/src/server/routes/provider.ts`** — Model activity
  selector alignment
- **`packages/opencode/src/provider/provider.ts`** — Provider type refinements

### Frontend
- **`packages/app/src/context/web-auth.tsx`** — Reverted `authorizedFetch` to
  Request-cloning pattern; fixed session error handling (404-only bypass)
- **`packages/app/src/context/global-sdk.tsx`** — Added auto-heal effect for
  stale project paths (inside AuthGate)
- **`packages/app/src/context/global-sync.tsx`** — Fixed `interceptedFetch`
  TypeScript error (missing `preconnect` property); added `errorMessage()`
  export; added `getGlobalProjects` getter; added `account_families` to store
- **`packages/app/src/context/global-sync/bootstrap.ts`** — Added Step 1 path
  healing before bootstrap tasks; added `account_families` fetch
- **`packages/app/src/components/auth-gate.tsx`** — Minor auth-gate refinement
- **`packages/app/src/components/dialog-select-directory.tsx`** — Global FS
  browse support
- **`packages/app/src/components/dialog-select-model.tsx`** — Model activity
  selector alignment
- **`packages/app/src/components/dialog-manage-models.tsx`** — Model management
  UI updates
- **`packages/app/src/components/dialog-select-provider.tsx`** — Provider
  selector updates
- **`packages/app/src/components/settings-accounts.tsx`** — Account settings
- **`packages/app/src/components/settings-models.tsx`** — Model settings
- **`packages/app/src/components/settings-providers.tsx`** — Provider settings

### Scripts & Tests
- **`scripts/tools/start-opencode-web.sh`** — Set `OPENCODE_FRONTEND_PATH`;
  fixed `PROJECT_ROOT` path traversal
- **`scripts/webadmin.sh`** — NEW: htpasswd user management (add/delete/passwd/list)
- **`scripts/test-with-baseline.ts`** — Dynamic root path resolution
- **`scripts/typecheck-with-baseline.ts`** — Dynamic root path resolution
- **`packages/opencode/test/provider/gmicloud-toolcall-bridge.test.ts`** —
  Removed hardcoded home path

## Lesson Learned

When a working commit breaks after changes, **check `git diff` against the last
known-good commit first** instead of debugging from scratch. The root cause was
visible in the diff (missing `OPENCODE_FRONTEND_PATH`, changed session error
handling) but was obscured by the volume of changes (20 files, 1000+ lines).

The CDN proxy fallback is a dangerous default — it silently replaces the
authenticated CMS frontend with an unauthenticated upstream version, making
auth failures look like client-side bugs when the problem is that an entirely
different frontend is being served.
