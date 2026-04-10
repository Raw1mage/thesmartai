# Tasks - Webapp Registry (C Gateway)

## 0. Planning

- [x] 0.1 Identify fatal flaw in previous daemon-based routing (anonymous users don't spawn daemons)
- [x] 0.2 Pivot architecture to C Gateway as the true reverse proxy
- [x] 0.3 Define routes.conf format and ctl.sock protocol
- [x] 0.4 Write full plan package (10 artifacts)

## 1. C Gateway Core (Routing + Proxy)

- [x] 1.1 Define `WebRoute` struct with owner uid field, `g_web_routes[]` static array (MAX_WEB_ROUTES=128)
- [x] 1.2 Implement `load_web_routes()`: fopen + sscanf parser (4 fields: prefix host port uid), sort by prefix length desc
- [x] 1.3 Implement `match_web_route()`: linear scan with boundary guard (path[len] == '\0' || '/')
- [x] 1.4 Implement bypass-JWT proxy in `route_complete_request()`: match → TCP connect → alloc_conn → pipe2 → splice
- [ ] 1.5 Change error handling for public routes: connect fail → 302 redirect to `/` (not 502)
- [x] 1.6 Call `load_web_routes()` in `main()` at startup
- [x] 1.7 Register SIGHUP handler, add reload check in epoll loop
- [ ] 1.8 Update routes.conf parser to read 4th field (owner uid), backward-compatible with 3-field format

## 2. Control Socket (ctl.sock)

- [ ] 2.1 Add `ECTX_CTL_LISTEN` and `ECTX_CTL_CLIENT` to EpollCtxType enum
- [ ] 2.2 Create and listen on `/run/opencode-gateway/ctl.sock` (mode 0660, group opencode)
- [ ] 2.3 Add ctl.sock accept handler in epoll loop
- [ ] 2.4 Implement JSON line-protocol reader for ctl client connections
- [ ] 2.5 Implement `publish` action: duplicate check, `SO_PEERCRED` uid, update in-memory + flush routes.conf
- [ ] 2.6 Implement `remove` action: find prefix, remove from table + flush
- [ ] 2.7 Implement `list` action: return current route table as JSON
- [ ] 2.8 Add ctl.sock cleanup on gateway shutdown

## 3. CLI + Skill

- [ ] 3.1 Implement `webctl.sh publish-route <prefix> <host> <port>`: connect to ctl.sock, send publish JSON, report result
- [ ] 3.2 Implement `webctl.sh remove-route <prefix>`: connect to ctl.sock, send remove JSON
- [ ] 3.3 Implement `webctl.sh list-routes`: connect to ctl.sock, send list JSON, format output
- [ ] 3.4 Write `templates/skills/web-registry.md` skill template for AI-driven route publishing

## 4. Testing & Validation

- [ ] 4.1 Compile gateway (`webctl.sh compile-gateway`), fix any warnings
- [ ] 4.2 Create test routes.conf, restart gateway, verify log "Loaded N web routes"
- [ ] 4.3 Test ctl.sock publish: `webctl.sh publish-route /cecelearn 127.0.0.1 5173`
- [ ] 4.4 Test anonymous curl: `curl -L http://127.0.0.1:1080/cecelearn` returns webapp content
- [ ] 4.5 Test auth unchanged: `curl http://127.0.0.1:1080/` returns login page
- [ ] 4.6 Test duplicate reject: second publish of same prefix fails
- [ ] 4.7 Test backend down: stop cecelearn, verify 302 redirect to `/`
- [ ] 4.8 Test gateway restart: kill + restart, verify routes.conf reloaded
- [ ] 4.9 Update specs/architecture.md with Web Routes + ctl.sock section
