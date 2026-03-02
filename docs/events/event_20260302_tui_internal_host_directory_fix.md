# Event: fix TUI internal host directory override

Date: 2026-03-02
Status: Done

## Symptom

- In TUI, prompt text was submitted then appeared to disappear/no response.
- Debug log showed session creation under `/home/opencode` instead of user cwd.

## Root Cause

- Server directory middleware prioritized authenticated Linux user home when auth username existed.
- TUI worker uses in-process server fetch with base URL host `opencode.internal` and may carry auth header.
- This made internal TUI requests resolve default directory to auth user home (e.g. `/home/opencode`) instead of TUI process cwd.

## Fix

- In `packages/opencode/src/server/app.ts`, detect internal worker host `opencode.internal`.
- For this host, default directory is forced to `process.cwd()`.
- External/web requests keep per-user home fallback behavior.

## Expected Result

- TUI sessions are created in current terminal working directory again.
- Web PAM per-user behavior remains intact.
