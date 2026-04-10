# Proposal: Published Web Sidebar

## Why

- Users publish web apps (e.g. cecelearn) via the C gateway's web registry, but have no GUI to see or manage their published routes
- Currently the only way to list/manage routes is via CLI (webctl.sh list-routes), which is undiscoverable for web-only users
- Users need a quick way to open their published apps without remembering URLs

## Original Requirement Wording (Baseline)

- "我想在pkcs12使用者界面應該要有對應的進入點可以直接開網址。我覺得合理的做法是在左側的side bar有一個Published web UI讓人有所有的屬於該user的發布網址的列表，按了可以開連結，並有「…」圖示對這些發布設定進行CRUD"

## Requirement Revision History

- 2026-04-10: initial requirement from user

## Effective Requirement Description

1. Sidebar must show a list of web routes published by the current user
2. Each route entry must be clickable to open the web app URL
3. Each route entry must have a "..." menu for management operations (open, copy URL, remove)
4. The data source is the C gateway's ctl.sock protocol, filtered by user UID

## Scope

### IN

- Backend proxy for ctl.sock (list/publish/remove)
- Sidebar tile (globe icon) in the utility bar
- Sidebar panel with route list and CRUD dropdown
- Route deduplication (group frontend + /api routes)

### OUT

- Publish form in the UI (CLI-only for MVP)
- Route health monitoring
- SSE push updates

## Non-Goals

- Replacing the CLI workflow for power users
- Managing routes for other users (admin view)
- Editing route configuration (host, port) after publish

## Constraints

- Must use existing ctl.sock protocol — no gateway C code changes
- Must follow existing sidebar tile/panel pattern (ScheduledTasksTile/TaskSidebar)
- Per-user daemon architecture means UID filtering happens at the backend, not gateway

## What Changes

- New backend API endpoint /api/v2/web-route with 3 sub-routes
- New sidebar tile (globe icon) in the rail utility bar
- New sidebar panel component with route list
- Router gains /system/web-routes path
- layout.tsx gains isWebRoutesRoute branching logic

## Capabilities

### New Capabilities

- View published routes: users see their own published web apps in the sidebar
- Open route: click to open in new tab
- Copy URL: copy the public URL to clipboard
- Remove route: unregister a route from the gateway with confirmation

### Modified Capabilities

- Sidebar utility bar: gains a globe icon between app-market and settings
- Layout panel rendering: gains a third branch for web routes (alongside projects and tasks)

## Impact

- packages/opencode/src/server/ — new route file + app.ts registration
- packages/app/src/pages/ — new web-routes directory + layout/sidebar modifications
- packages/app/src/app.tsx — new route definition
- No database schema changes
- No gateway C code changes
- No breaking changes to existing functionality
