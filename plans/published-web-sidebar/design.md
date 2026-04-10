# Design: Published Web Sidebar

## Context

- OpenCode uses a C gateway (opencode-gateway.c) that manages web route registration via a Unix socket control protocol (ctl.sock)
- Web apps register routes like /cecelearn → localhost:5173 and the gateway does zero-copy splice proxy
- The gateway stores routes in /etc/opencode/web_routes.conf with owner UID per route
- The frontend is SolidJS and the backend is Hono, both running in a per-user Bun daemon
- The sidebar already has a system-level panel pattern (ScheduledTasksTile → TaskSidebar at /system/tasks)

## Goals / Non-Goals

**Goals:**

- Let users see and manage their published web routes from the web UI
- Follow the existing sidebar tile/panel pattern for consistency
- Keep the implementation minimal (no new UI frameworks, no gateway changes)

**Non-Goals:**

- Building a publish wizard UI (CLI is sufficient for MVP)
- Real-time route change notifications
- Admin-level cross-user management

## Decisions

- D1: Backend proxies ctl.sock via Node net.createConnection — browser cannot talk to Unix sockets; the Hono route is the bridge, also responsible for UID filtering
- D2: UID filtering uses process.getuid() — the per-user daemon runs as the user, so its UID matches the route owner_uid from the gateway; no separate auth token needed
- D3: Follow TaskSidebar pattern exactly — globe tile in utility bar, navigate to /system/web-routes, isWebRoutesRoute memo, renderPanel branching; minimizes architectural divergence
- D4: Route grouping by prefix stem — a web app typically has two gateway entries (/cecelearn + /cecelearn/api); the sidebar groups by stripping /api suffix and showing only the shortest prefix
- D5: No publish form in MVP — publishing requires deployment knowledge (port, prefix); CLI workflow is appropriate for the current user base

## Data / State / Control Flow

- Request flow: globe click → navigate(/system/web-routes) → layout.tsx opens sidebar → WebRouteSidebar mounts → fetch GET /api/v2/web-route → Hono handler → net.createConnection(ctl.sock) → JSON {"action":"list"} → gateway responds with route array → filter by UID → return to frontend → groupRoutes() dedup → render list
- Remove flow: dropdown menu → confirm dialog → fetch POST /api/v2/web-route/remove → Hono handler → ctl.sock {"action":"remove"} → gateway removes from memory + flushes web_routes.conf → frontend refreshes list

## Risks / Trade-offs

- R1: ctl.sock timeout — if gateway is slow, the 3-second timeout in ctlRequest may cause poor UX → mitigation: return 502 with error message, frontend shows empty state instead of hanging
- R2: Route grouping heuristic — stripping /api suffix is a convention, not a contract; if a user publishes /foo and /foobar, the grouping won't incorrectly merge them because it only strips exact /api suffix
- R3: No real-time updates — if routes are added/removed externally (via CLI), the sidebar won't update until user clicks Refresh → acceptable for MVP; SSE extension is future work
- R4: ctl.sock permissions — socket is 0666, any local user can send commands; the gateway uses SO_PEERCRED to tag owner_uid, so a user cannot spoof another user's UID

## Critical Files

- daemon/opencode-gateway.c — ctl.sock handler (existing, not modified)
- /etc/opencode/web_routes.conf — persistent route storage (existing, not modified)
- packages/opencode/src/server/routes/web-route.ts — new Hono route
- packages/opencode/src/server/app.ts — route registration
- packages/app/src/pages/web-routes/api.ts — frontend fetch client
- packages/app/src/pages/web-routes/web-route-sidebar.tsx — sidebar panel component
- packages/app/src/pages/layout/sidebar-shell.tsx — sidebar tile props + globe icon
- packages/app/src/pages/layout.tsx — routing logic + panel rendering
- packages/app/src/app.tsx — route definition
