Event: web app settings kill-switch controls

Date: 2026-03-16

Summary

- Added a minimal kill-switch admin section to `packages/app` settings runtime surface.
- Implemented status fetch from `GET /api/v2/admin/kill-switch/status`.
- Implemented trigger flow with reason + confirmation, including MFA challenge handling:
  - first trigger request without `mfaCode`
  - handle `202 mfa_required` + `request_id`
  - second trigger request with same `request_id` + `mfaCode`
- Implemented cancel action with confirmation.
- Added focused unit tests for kill-switch payload/status helper logic.

Files

- `packages/app/src/components/settings-general.tsx`
- `packages/app/src/components/settings-kill-switch.ts`
- `packages/app/src/components/settings-kill-switch.test.ts`
