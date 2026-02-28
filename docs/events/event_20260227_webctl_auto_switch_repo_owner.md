# Event: webctl auto-switch to repo owner

Date: 2026-02-27
Status: Completed

## Decision

- Update `webctl.sh` to auto-switch execution user to the repository owner for runtime-affecting commands.
- Keep this guard enabled by default and allow opt-out with `OPENCODE_AUTO_SWITCH_OWNER=0`.

## Scope

- Owner-enforced commands: `start/up`, `stop/down`, `restart`, `status`, `logs`, `build-frontend`, `build-binary`.
- Non-runtime commands (e.g. `help`) do not require user switch.

## Implementation

- Detect repo owner via `stat -c '%U' ${PROJECT_ROOT}`.
- If current user differs and auto-switch is enabled:
  - Re-exec through `sudo -u <repo_owner> -H`.
  - Pass through profile/XDG envs needed for runtime isolation.
- Add loop guard (`OPENCODE_OWNER_SWITCHED=1`) to prevent recursion.
- Print runtime context including current user and repo owner.

## Rationale

- Prevent mixed-runtime debugging where code is edited in one home but runtime/session state is written under another user.
- Reduce risk of polluting TUI/runtime state while developing webapp.
