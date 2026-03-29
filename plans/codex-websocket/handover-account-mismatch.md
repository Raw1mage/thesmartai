# Handover: Codex Account Mismatch Investigation

## Problem

All codex accounts show identical cooldown timers (00:11:25:24) simultaneously. This is impossible if each account uses its own token — it means **one token is being used for all requests regardless of which account rotation selects**.

User reports this is a recurrent issue: 「所用非所選」(using a different account than the one selected).

## Evidence

1. Screenshot: 4 codex accounts all showing `00:11:25:24` cooldown at the same time
2. Earlier today: WS connection carried `yeatsluo` (free plan, exhausted) token when session was assigned to `miatlab-api` (plus plan, has quota)
3. WS error trace showed `plan_type: "free"` for a plus account — proving the token doesn't match the account

## Suspect: Module-Level Auth State in codex.ts

```
packages/opencode/src/plugin/codex.ts
```

The fetch interceptor uses module-level variables that are set once during plugin initialization and updated on token refresh, but **NOT updated per-request when rotation switches accounts**:

```typescript
// These are module-level — shared across all sessions and requests
let currentAuth = { access: "..." }           // ← set at plugin init
let authWithAccount = { accountId: "..." }     // ← set at plugin init

// The fetch interceptor captures these at call time:
const headers = buildCodexHeaders(init, currentAuth.access, authWithAccount.accountId)
//                                      ^^^^^^^^^^^^^^^^     ^^^^^^^^^^^^^^^^^^^^^^
//                                      Same token for ALL requests, regardless of rotation
```

When rotation calls `Account.update()` to switch from account A to account B, the **account storage** is updated but `currentAuth.access` in the codex plugin closure **stays pointing at account A's token**.

## Where to Look

1. **`packages/opencode/src/plugin/codex.ts`** — search for `currentAuth` and `authWithAccount`. Trace how they are set and when they are updated. The `refreshAuth()` function (around line 600) updates them, but is it called on every rotation switch or only on token expiry?

2. **`packages/opencode/src/session/llm.ts`** — search for `accountId` and how it flows into provider options. Does the per-request accountId from rotation actually reach the fetch interceptor?

3. **`packages/opencode/src/account/rotation3d.ts`** — when rotation picks a new account, does it signal the codex plugin to update `currentAuth`? Or does it just update the session's metadata?

4. **`packages/opencode/src/provider/provider.ts`** — line ~1463: `options.apiKey = accountInfo.accessToken`. This sets the token per-provider-registration, not per-request. If the provider was registered with account A's token, all requests use that token even after rotation switches to account B.

## Verification Steps

1. Add a log trace at the fetch interceptor that prints **both** the intended accountId (from rotation) and the actual token fingerprint (first 20 chars of `currentAuth.access`):
   ```typescript
   console.error(`[AUTH-CHECK] intended=${authWithAccount.accountId} tokenPrefix=${currentAuth.access.slice(0,20)}`)
   ```

2. Trigger rotation by exhausting one account, then check if the token fingerprint changes when rotation switches.

3. If token doesn't change → the fix is to resolve `currentAuth.access` from `accounts.json` at request time, not at plugin init time.

## Architectural Constraint

`specs/codex_provider_runtime/design.md` DD-2: auth is the fetch interceptor's responsibility. The fix must stay in the interceptor layer, not in AI SDK or provider registration.

## Related Memory

- `memory/project_account_mismatch_suspect.md` — full context
- `memory/project_codex_stale_oauth.md` — stale OAuth can compound this issue
