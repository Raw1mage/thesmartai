# Tasks

## Baseline Status
- 前一輪 Session 3 hardening 的 JWT claim validation、identity routing、daemon lifecycle 修改已在 code 中，作為有效基線保留。
- 本 task tree 從結構性 gap analysis 結果出發，涵蓋前一輪未識別的所有問題。
- 前一輪的 Phase 0-2 / Phase 4 成果視為 baseline，不重列為 task。

---

## Phase 1: Event Loop Architecture Fix (REQ-1, REQ-2)

- [x] 1.1 Refactor accept path to non-blocking: accept4() → set non-blocking → register to epoll with PendingRequest context → return to loop (不在 accept path 中 recv 或 PAM)
- [x] 1.2 Implement PendingRequest struct: per-connection read buffer (8KB) + buf_len + accept_time + peer_ip
- [x] 1.3 Implement buffered HTTP accumulation: EPOLLIN on pending fd → read append → check `\r\n\r\n` → if complete, proceed to routing; if timeout (30s) or oversize → 408/400 → close
- [x] 1.4 Implement thread-per-auth PAM: POST /auth/login → spawn pthread → PAM auth in thread → result via eventfd → main loop reads result → send response → close fd
- [x] 1.5 Verify: epoll loop 在 PAM auth 期間持續 accept 和 splice 其他連線（structural: PAM runs in detached thread, main loop only sees eventfd signal）

## Phase 2: epoll & Connection Lifecycle Fix (REQ-3, REQ-4)

- [x] 2.1 Define EpollCtx tagged struct: `{ enum type, union { PendingRequest*, Connection* } }` — 每個 epoll fd 都有 typed context
- [x] 2.2 Refactor epoll registration: listen fd (ECTX_LISTEN) / pending fd (ECTX_PENDING) / splice client fd (ECTX_SPLICE_CLIENT) / splice daemon fd (ECTX_SPLICE_DAEMON) / auth eventfd (ECTX_AUTH_NOTIFY)
- [x] 2.3 Refactor splice event handling: epoll 事件根據 EpollCtx.type 只做觸發方向的 splice（splice_one_direction），不做雙向嘗試
- [x] 2.4 Fix close_conn(): 先 EPOLL_CTL_DEL 兩個 fd，再 close，再遞減 g_nconns
- [x] 2.5 Add closed flag to Connection: close_conn() set flag → 同一輪 epoll 事件 check flag → skip
- [ ] 2.6 Verify: 建立 + 關閉 100 個連線後 g_nconns == 0，無 fd leak — deferred to runtime verification (V3)

## Phase 3: Security Hardening (REQ-5, REQ-6, REQ-10.2)

- [x] 3.1 Implement JWT secret file persistence: 啟動讀 `/run/opencode-gateway/jwt.key`（configurable via `OPENCODE_JWT_KEY_PATH`）；不存在則 RAND_bytes + write；存在則 load + validate length
- [x] 3.2 Implement login rate limiting: per-IP hash table (mod 256), 5 failures / 60s → 429, successful login clears counter
- [x] 3.3 Refactor OPENCODE_BIN exec: fork 前 parse_opencode_argv() 拆成 argv array → child 用 execvp → 移除 sh -c path
- [ ] 3.4 Verify: gateway restart 後既有 JWT cookie 仍可通過驗證；6 次快速 failed login 觸發 429 — deferred to runtime verification (V3)

## Phase 4: Environment Adaptation (REQ-10) — STOP GATE: 需使用者確認 WSL2 fallback 策略

- [x] 4.1 Implement runtime path detection: check `/run/user/<uid>/` → `$XDG_RUNTIME_DIR` → `/tmp/opencode-<uid>/` (mkdir 700) → log selected path
- [x] 4.2 Implement PAM availability check: 啟動時 probe PAM service → 若不可用，log error 並提供 guidance
- [ ] 4.3 Verify: 在 WSL2 環境下（無 /run/user/）gateway 正確使用 fallback path 且 log 記錄路徑選擇 — deferred to runtime verification (V3)

## Phase 5: Verification Matrix

- [x] 5.1 V1 — Compile: `gcc -O2 -Wall -Werror -D_GNU_SOURCE -o gateway opencode-gateway.c -lpam -lpam_misc -lcrypto -lpthread` — PASSED
- [x] 5.2 V2 — Static review: 確認無 blocking call in epoll loop、無 close without EPOLL_CTL_DEL、無 sh -c in child、JWT claim validation 完整 — PASSED (all 7 invariants hold; send() calls are on O_NONBLOCK sockets)
- [ ] 5.3 V3 — Single-user runtime: login → JWT issue → authenticated HTTP → correct daemon → response — DEFERRED (requires running gateway + opencode backend)
- [ ] 5.4 V4 — SSE forwarding: SSE stream through splice proxy 持續推送 events — DEFERRED (requires V3 + SSE-capable backend)
- [ ] 5.5 V5 — WebSocket: WebSocket upgrade + bidirectional streaming through splice — DEFERRED (requires V3 + WebSocket-capable backend)
- [ ] 5.6 V6 — Multi-user isolation: alice + bob 各自 login，request 只到自己的 daemon — DEFERRED (requires multi-user OS environment)
- [ ] 5.7 V7 — Stress: 併發 login + splice 不 deadlock、不 leak、rate limiter — DEFERRED (requires V3)
- [ ] 5.8 V8 — WSL2: 在 WSL2 環境下完成 V1-V3 — DEFERRED (requires V3 baseline first)
- [x] 5.9 Record deferred evidence: V3-V8 require a running gateway + opencode backend environment. Preconditions: compiled binary, PAM-enabled system, opencode serve --unix-socket support. Uncovered risks: splice data integrity under load, PAM thread-safety under concurrent auth, JWT cookie round-trip through browser, runtime path fallback on actual WSL2.

## Phase 6: Documentation Sync

- [x] 6.1 Update `docs/events/event_20260319_daemonization.md`: 記錄結構性修復 session 的 scope、decisions、issues、verification
- [x] 6.2 Update `specs/architecture.md`: 反映修復後的 gateway 架構（event loop model、EpollCtx、PendingRequest、thread-per-auth、JWT persistence、rate limiting、WSL2 adaptation）
- [x] 6.3 Mark Architecture Sync in event Validation block
