# Tasks: safe-daemon-restart

## 1. Gateway runtime-dir guarantee + orphan cleanup (C)

- [x] 1.1 Extend `resolve_runtime_dir()` in `daemon/opencode-gateway.c` to also `mkdir + chown + chmod 0700` the `opencode/` subdir (`/run/user/<uid>/opencode/`) before returning — new helper `ensure_socket_parent_dir(uid, gid)` called from `ensure_daemon_running` BEFORE fork
- [x] 1.2 Add `detect_lock_holder_pid(username, target_uid)` helper — **design amended**: gateway lock is a PID JSON file at `~/.config/opencode/daemon.lock` (not kernel flock); detector reads file, verifies `/proc/<pid>` uid matches target. Returns pid or -1.
- [x] 1.3 Add `cleanup_orphan_daemon(pid, username)` helper: SIGTERM → poll `kill(pid,0)` for 1000ms → SIGKILL if still alive → log `orphan-cleanup uid=... holderPid=... result=...`
- [x] 1.4 Wire orphan cleanup into `ensure_daemon_running`: after `adopt failed`, before `fork`, call detect → if holder found AND uid matches → cleanup → then proceed
- [x] 1.5 Unit test (C-level): `daemon/test-orphan-cleanup.c` covers detect(alive/stale/no-file) + cleanup(SIGTERM/SIGKILL escalation); all 9 assertions pass

## 2. Extend /web/restart gateway-daemon branch to run webctl rebuild (TypeScript)

Scope **revised 2026-04-21**: `/api/v2/global/web/restart` already exists (`packages/opencode/src/server/routes/global.ts`) and handles legacy-mode with webctl.sh rebuild. Gateway-daemon mode currently just self-terminates without rebuild. This phase closes that gap.

- [ ] 2.1 In `packages/opencode/src/server/routes/global.ts` line ~511-533 (gateway-daemon branch): before the self-terminate setTimeout, call `webctl.sh restart --graceful` via `Bun.spawn` (same pattern as legacy branch line ~535-595)
- [ ] 2.2 On webctl exit != 0: do NOT self-terminate; return 5xx with error log path + hint (mirrors legacy error path); preserves "rebuild failed → system stays on old version" invariant
- [ ] 2.3 Accept optional `targets?: ("daemon"|"frontend"|"gateway")[]` body parameter; when `gateway` is requested, append `--force-gateway` to the webctl call
- [ ] 2.4 Ensure webctl is NOT re-entered if already-running (webctl has its own lock file at `RESTART_LOCK_FILE`); if busy, return 409 Conflict
- [ ] 2.5 Emit structured logs: `web-restart mode=gateway-daemon txid=... targets=... webctlExit=...`
- [ ] 2.6 Integration smoke test: call endpoint, assert webctl invoked (log check) + daemon exits + gateway respawn succeeds

## 3. system-manager MCP restart_self tool (TypeScript)

Scope **simplified**: no new endpoint needed — tool just POSTs the existing `/web/restart`.

- [ ] 3.1 Add `restart_self` tool to `packages/mcp/system-manager/src/index.ts` tools array; description makes it clear this triggers rebuild+restart and should be used after code changes or for recovery
- [ ] 3.2 Tool handler: POST `/api/v2/global/web/restart` on localhost (reuse `globalSDK` equivalent or raw fetch with session JWT); optional `targets` passthrough
- [ ] 3.3 Return `{restartScheduled: true, mode, txid}` to AI; on non-2xx return error with log path so AI can read + report
- [ ] 3.4 No local-spawn fallback — if endpoint unreachable, fail loud (AGENTS.md rule 1)
- [ ] 3.5 Unit test: mock endpoint, assert tool forwards JWT + targets; assert non-2xx surfaced as error

## 4. system-manager execute_command denylist (TypeScript)

- [ ] 4.1 Introduce `DAEMON_SPAWN_DENYLIST` constant array of regex in system-manager: patterns for `webctl\.sh\s+(dev-start|dev-refresh|dev-stop)`, `\bbun\b.*\bserve\b.*--unix-socket`, `\bopencode\s+(serve|web)\b`, `\bkill\b.*<daemon-pid-pattern>`
- [ ] 4.2 In `execute_command` handler, match input against denylist BEFORE template lookup or shell exec; on match throw error with code `FORBIDDEN_DAEMON_SPAWN` and message referencing `restart_self`
- [ ] 4.3 Emit `denylist-block rule=... argvHash=...` log line (warn level)
- [ ] 4.4 Unit test vectors TV-3 and TV-4; also negative test that legitimate commands (e.g. `git status`) pass through

## 5. Policy + docs

- [ ] 5.1 Add to `AGENTS.md` (top-level rules section): 「AI 禁止自行 spawn / kill / restart daemon 行程；restart 必須透過 `restart_self` tool，否則違規」
- [ ] 5.2 Add section to `specs/architecture.md`: "Daemon Lifecycle Authority" — gateway is the sole owner; daemon never forks/execs another daemon; AI never invokes daemon-spawning commands
- [ ] 5.3 Write `docs/events/event_2026-04-20_daemon-orphan.md` capturing the incident RCA, fix summary, and link to this spec package
- [ ] 5.4 Update `templates/AGENTS.md` to mirror the new rule (release sync per §Release 前檢查清單)

## 6. Acceptance validation

- [ ] 6.1 Run TV-1 through TV-7 end-to-end on a beta worktree; capture outputs
- [ ] 6.2 Manual verification: artificially create orphan (spawn bun daemon out-of-band), trigger request, confirm gateway log shows orphan-cleanup path, user not redirected to login
- [ ] 6.3 Manual verification: `sudo rm -rf /run/user/1000/opencode/` then access site; confirm auto-recreate + normal operation
- [ ] 6.4 Record validation evidence in `handoff.md` under Execution Evidence section
- [ ] 6.5 Promote state verified → living after fetch-back to main
