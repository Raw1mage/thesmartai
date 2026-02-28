# Event: webctl runtime profile isolation

Date: 2026-02-27
Status: Completed

## Decision

- Add runtime profile isolation to `webctl.sh` to reduce cross-user/runtime contamination during web debugging.
- Keep backward compatibility for PTY debug logs by falling back to legacy `/tmp/pty-debug.log` when profile-scoped log is absent.

## Changes

- Added `OPENCODE_PROFILE` support (default: `default`).
- Added profile-safe file naming for PID/log files under `${XDG_RUNTIME_DIR:-/tmp}`.
- Added runtime context output (`HOME`, `XDG_*`, profile, PID path) to start/status output.
- Updated help text to document profile and XDG isolation usage.

## Rationale

- The same machine may host multiple runtime identities (e.g. `pkcs12`, `betaman`).
- Without profile-aware PID/log separation, control scripts can target the wrong process/state and create confusing behavior.
