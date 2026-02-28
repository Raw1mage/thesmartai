# Event: webctl owner-switch sudo policy fallback

Date: 2026-02-27
Status: Completed

## Problem

- `pkcs12` can run `sudo` without password only when targeting `root`, but not when targeting `betaman` directly.
- Initial owner auto-switch used `sudo -u betaman` directly, which failed in non-interactive shell.

## Decision

- Add non-interactive fallback path for owner switching:
  1. Try direct `sudo -n -u <owner>`.
  2. If unavailable, try root-hop: `sudo -n -u root sudo -n -u <owner>`.

## Result

- webctl can still enforce repo-owner execution even under mixed sudo policies where root NOPASSWD is available but direct user switch is not.
