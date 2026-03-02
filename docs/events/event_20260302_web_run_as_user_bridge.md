# Event: web PAM per-user execution bridge with sudoers wrapper

Date: 2026-03-02
Status: Done

## Decision

- Keep web control plane as dedicated service account (`opencode`), but execute interactive shell/pty workloads as authenticated Linux users.
- Implement a constrained root bridge instead of granting unrestricted `sudo su`.

## Changes

1. Request identity propagation
   - Added `packages/opencode/src/runtime/request-user.ts` (AsyncLocalStorage context)
   - Web auth middleware now resolves and propagates authenticated username (cookie session or basic auth)

2. Linux run-as-user bridge
   - Added `packages/opencode/src/system/linux-user-exec.ts`
   - Provides:
     - username sanitization
     - Linux home resolution via `/etc/passwd`
     - sudo wrapper invocation builder (`sudo -n <wrapper> ...`)

3. PTY ownership isolation and execution identity
   - Updated `packages/opencode/src/pty/index.ts` and `server/routes/pty.ts`
   - PTY sessions now carry owner identity in-memory and enforce owner-only access on list/get/update/remove/connect
   - On Linux with bridge enabled, PTY processes are spawned through the privileged wrapper as the authenticated user

4. Shell execution identity
   - Updated:
     - `packages/opencode/src/session/shell-executor.ts`
     - `packages/opencode/src/tool/bash.ts`
   - Linux authenticated requests now use run-as-user bridge for shell execution paths

5. Installer + system provisioning
   - Added wrapper script: `scripts/opencode-run-as-user.sh`
   - `install.sh --system-init` now installs:
     - `/usr/local/libexec/opencode-run-as-user`
     - `/etc/sudoers.d/opencode-run-as-user` (minimal whitelist)
     - env defaults in `/etc/opencode/opencode.env`:
       - `OPENCODE_RUN_AS_USER_ENABLED=1`
       - `OPENCODE_RUN_AS_USER_WRAPPER=/usr/local/libexec/opencode-run-as-user`

6. Default directory behavior
   - Authenticated Linux requests without explicit `directory` now default to that user’s home directory (when resolvable)

## Rationale

- PAM auth without per-user execution is incomplete in multi-user environments.
- Restricting elevation to one audited wrapper command preserves principle of least privilege.
- Owner-bound PTY access prevents cross-user terminal leakage.

## Risks / Follow-up

- Existing session data model does not yet persist execution identity for all async/background flows.
- Follow-up work should persist and rehydrate per-session execution identity beyond request scope where needed.
