# Implementation Spec

## Goal

- Add a "Published Web" sidebar section to the OpenCode web UI, allowing users to view, open, and manage their gateway-registered web app routes.

## Scope

### IN

- Backend Hono API route proxying ctl.sock (list, publish, remove)
- Frontend sidebar globe tile in the utility bar
- Frontend sidebar panel showing user's routes with clickable links
- Dropdown menu per route (open in new tab, copy URL, remove)
- Route grouping to deduplicate frontend/api entries

### OUT

- Publish form UI (MVP relies on CLI for publishing)
- Backend health check / reachability probe for route targets
- SSE live-update when routes change at gateway level
- Admin cross-user route visibility

## Assumptions

- The C gateway is running and ctl.sock is accessible at /run/opencode-gateway/ctl.sock
- The per-user daemon runs as the user's UID (process.getuid() matches route owner_uid)
- The ctl.sock JSON protocol (list/publish/remove) is stable
- The SolidJS sidebar follows the ScheduledTasksTile/TaskSidebar pattern for system-level panels

## Stop Gates

- If ctl.sock protocol changes (field names, response format), backend route must be updated before frontend
- If the gateway process is not running, the API returns 502 with error message — frontend must show graceful empty state
- If multi-user UID filtering is wrong, users could see each other's routes — must verify with multiple user sessions before shipping

## Critical Files

- packages/opencode/src/server/routes/web-route.ts
- packages/opencode/src/server/app.ts
- packages/app/src/pages/web-routes/api.ts
- packages/app/src/pages/web-routes/web-route-sidebar.tsx
- packages/app/src/pages/layout/sidebar-shell.tsx
- packages/app/src/pages/layout.tsx
- packages/app/src/app.tsx

## Structured Execution Phases

- Phase 1: Backend API route — create web-route.ts with ctl.sock Unix socket communication, register in app.ts
- Phase 2: Frontend API client — create fetch wrapper for list/publish/remove endpoints
- Phase 3: Sidebar panel — create WebRouteSidebar and WebRouteItem components with route list, clickable links, and dropdown menu
- Phase 4: Sidebar integration — add globe tile to sidebar-shell.tsx, add route/memo/panel logic in layout.tsx and app.tsx

## Validation

- Backend: GET /api/v2/web-route returns only routes matching current user UID
- Backend: POST /api/v2/web-route/remove removes a route and gateway confirms via ctl.sock
- Backend: gateway unreachable returns 502 with descriptive error
- Frontend: globe icon appears in sidebar utility bar between app-market and settings
- Frontend: clicking globe navigates to /system/web-routes and opens sidebar panel
- Frontend: panel lists grouped routes (no /api duplicates)
- Frontend: clicking route item opens URL in new tab
- Frontend: dropdown menu works for open, copy URL, remove
- Frontend: remove with confirm dialog calls API and refreshes list
- Type check: npx tsc --noEmit introduces no new errors

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
