# Tasks

## 1. Backend API Route

- [x] 1.1 Create web-route.ts with ctlRequest helper (net.createConnection to ctl.sock, JSON protocol, 3s timeout)
- [x] 1.2 Implement GET / handler (list routes, filter by process.getuid())
- [x] 1.3 Implement POST /publish handler (forward to ctl.sock)
- [x] 1.4 Implement POST /remove handler (forward to ctl.sock)
- [x] 1.5 Register WebRouteRoutes in app.ts

## 2. Frontend API Client

- [x] 2.1 Create web-routes/api.ts with list(), publish(), remove() methods
- [x] 2.2 Use globalSDK.url + globalSDK.fetch pattern (same as cron api)

## 3. Sidebar Panel Component

- [x] 3.1 Create WebRouteSidebar with header, loading state, empty state, route list
- [x] 3.2 Create WebRouteItem with clickable link (a href, target _blank)
- [x] 3.3 Add DropdownMenu per item (Open in new tab, Copy URL, Remove route)
- [x] 3.4 Implement groupRoutes() to deduplicate /api sub-routes
- [x] 3.5 Implement handleRemove with confirm dialog and cascading /api removal

## 4. Sidebar Integration

- [x] 4.1 Add webRoutesLabel + onOpenWebRoutes props to SidebarContent
- [x] 4.2 Add globe IconButton in sidebar-shell.tsx utility bar
- [x] 4.3 Add isWebRoutesRoute memo in layout.tsx
- [x] 4.4 Add openWebRoutes() navigation function
- [x] 4.5 Update renderPanel branching (desktop + mobile) to show WebRouteSidebar
- [x] 4.6 Update push-sidebar Show condition to include isWebRoutesRoute
- [x] 4.7 Add /system/web-routes Route in app.tsx

## 5. Validation

- [ ] 5.1 Restart web server and verify sidebar loads without errors
- [ ] 5.2 Verify globe icon appears and clicking opens the panel
- [ ] 5.3 Verify route list shows cecelearn entry (grouped, no /api duplicate)
- [ ] 5.4 Verify clicking route opens URL in new tab
- [ ] 5.5 Verify dropdown menu actions work (open, copy, remove)
- [ ] 5.6 Verify type check passes (npx tsc --noEmit)
