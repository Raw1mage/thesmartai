# Event: Switch webctl startup to dev mode

Date: 2026-02-27
Status: Done

## Goal

- Make `webctl.sh start` run in development mode so frontend changes are reflected via HMR without rebuilding `packages/app/dist` each time.

## Changes

- Updated `webctl.sh` startup lifecycle to run two processes:
  - Backend API server from source (`opencode ... web --port $OPENCODE_PORT`)
  - Frontend Vite dev server (`packages/app`, HMR) on `$OPENCODE_FRONTEND_DEV_PORT`
- Added dedicated PID files:
  - `/tmp/opencode-web-backend.pid`
  - `/tmp/opencode-web-frontend.pid`
- Updated stop/restart/status to manage both services.
- Updated help text and usage examples to reflect dev-mode workflow.

## Validation

- `bash -n webctl.sh` ✅
- `./webctl.sh help` ✅

## Notes

- `build-frontend` is retained as an optional static-build command, but not required for normal dev-mode startup.
