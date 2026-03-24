# Event: Daemonization V2 — Unified Per-User Process Model

**Date**: 2026-03-24
**Branch**: `daemonization-v2` (base: `cms`)
**Plan**: `plans/20260324_daemonization-v2/`

## 需求

消除三種互不知曉的 runtime process type（Worker thread, Unix socket daemon, HTTP daemon），統一為「每 user 恰好一個 opencode daemon process」。TUI 從 in-process Worker mode 改為 always-attach thin client。

## 範圍

### IN
- Phase 1: Discovery Enhancement（spawnOrAdopt, socket probe, bun flags preservation）
- Phase 2: TUI Always-Attach（消除 Worker mode）
- Phase 3: Worker Mode Cleanup（移除 worker.ts, build entrypoint）
- Attach empty-state bug fix（local.tsx Account.listAll in-process → SDK HTTP）

### OUT
- Gateway C code 改動（Phase 4）
- systemd / webctl.sh 整合（Phase 5）
- dialog-admin / dialog-account in-process Account calls 遷移
- 完整 integration validation（Phase 6）

## 任務清單

見 `plans/20260324_daemonization-v2/tasks.md`

## Key Decisions

- **spawnOrAdopt 在 Daemon module 層**：不放在 thread.ts，而是 daemon.ts 提供統一入口
- **socket connectivity probe 放在 spawnOrAdopt 層**：readDiscovery() 保持輕量（PID check only），spawnOrAdopt() 才做 health fetch
- **OPENCODE_CLI_TOKEN 保留**：killswitch.ts 仍需要 CLI→server HTTP auth，不隨 Worker 一起移除
- **directory 由 TUI 傳入**：V1 attach mode 沒傳 directory 是 bug，V2 修正為 always 傳
- **bun flags 保留**：spawn() 新增 `--conditions=` / `--preload=` 旗標傳遞

## Debug Checkpoints

### Baseline
- 症狀：`bun run dev --attach` 連接 daemon 後 accounts/sessions list 為空
- 重現：啟動 daemon → TUI attach → TUI 顯示空白
- 影響範圍：`local.tsx`, `sync.tsx`, `thread.ts`, `daemon.ts`

### Instrumentation Plan
- 追蹤 SDK client creation → directory propagation → server middleware
- 追蹤 bootstrap() → session.list / account.list → response

### Execution
- 完整追蹤 8 層資料流（thread → app → sdk → SDK client → server middleware → Instance.provide → session route → Session.listGlobal）
- 發現 `local.tsx` line 25 呼叫 `Account.listAll()` 是 **in-process call**，不走 HTTP

### Root Cause（修正）

兩個獨立成因：

1. **Directory 未傳遞（session 空白的直接原因）**：
   - V1 `--attach` code path 未傳 `directory` 給 `tui()` → SDK 不發 `x-opencode-directory` header
   - Server middleware fallback 到 `defaultDirectory`（user home `/home/pkcs12`）
   - Sessions 是以 project directory 為 key（`/home/pkcs12/projects/opencode`）→ 過濾結果為空

2. **Account list 應走 daemon HTTP（架構原則）**：
   - `Account.listAll()` 技術上可在 TUI 進程內運作（純 filesystem 讀取，不需 server context）
   - 但依據「Daemon = 唯一執行主體」原則，TUI 作為 thin client 不應直接讀寫 `accounts.json`
   - 改為 `sdk.client.account.listAll()` 是正確的架構方向，而非 root cause fix
   - 注意：原先的 root cause 描述（「沒有 Account storage layer」）是錯誤的 — Account module 不需 server init

### 架構澄清（Session 2 追加）

使用者確立核心原則：
- **Daemon 是唯一執行主體**，持有所有狀態
- **TUI 和 Gateway 都是 thin client**，一律透過 daemon HTTP API
- **TUI 直連 daemon**，不繞 gateway
- `accounts.json` 是 daemon 管理的資源，TUI 不直接碰

## Validation

### Static
- `local.tsx` Account.listAll() 改為 `sdk.client.account.listAll()` — SDK HTTP API
- `thread.ts` 現在 always 傳 `directory` 給 `tui()`
- `daemon.ts` 新增 `spawnOrAdopt()` + `isSocketConnectable()`
- `worker.ts` 已移除
- `build.ts` 已移除 worker entrypoint 和 OPENCODE_WORKER_PATH
- tsc: OOM（環境限制，非新引入問題）

### Runtime
- [ ] `bun run dev` 啟動 → daemon.json 存在 → TUI 顯示 accounts/sessions
- [ ] `bun run dev` 再開一個 TUI → adopt 同一 daemon
- [ ] TUI 退出後 daemon 持續運行

### Phase 2.5 Completed (Session 2)
- `dialog-account.tsx`：`Account.listAll()` → `sdk.client.account.listAll()`; `Account.setActive()` → `sdk.client.account.setActive()`; `Auth.remove()` → `sdk.client.account.remove()`
- `dialog-admin.tsx`：coreAll/activityAccounts resources、codexQuota、resolveGoogleApiKey、selectActivity、edit/view/delete handlers 全部遷移
- `DialogAccountEdit.save()`：`Account.get()` + `Account.update()` + `Account.refresh()` → `sdk.client.account.update()`
- `DialogGoogleApiAdd` / `DialogApiKeyAdd`：Account.list() check → `sdk.client.account.listAll()` + filter

### Phase 2.5 Continued (Session 3)
- `dialog-model.tsx:82`：`Account.getActive()` → `sdk.client.account.listAll()` + `activeAccount` lookup
- `prompt/index.tsx:259`：`Account.get()` → `sdk.client.account.listAll()` + accounts lookup
- `app.tsx:436`：`Account.getActive()` → `sdk.client.account.listAll()` + `activeAccount` lookup（新發現）
- TUI 中已無任何 Account I/O 殘留（僅保留純運算 utility：parseProvider, getDisplayName 等）

### Phase 4 Completed (Session 3)
- `opencode-gateway.c`：`start_splice_proxy` 失敗時 mark `DAEMON_DEAD` + retry-once loop（ensure + splice）
- `Connection` struct 新增 `DaemonInfo *daemon` back-pointer
- `ECTX_SPLICE_DAEMON` EPOLLHUP/EPOLLERR handler：daemon crash 時 mark `DAEMON_DEAD`
- `DaemonInfo` 改為 named struct（`struct DaemonInfo`）以支援 forward declaration
- 4.1 已驗證：`try_adopt_from_discovery()` 已包含 `connect_unix()` socket probe
- 編譯驗證：`gcc -O2 -Wall -Wextra` 零 warning

### Phase 5 Partial (Session 3) — webctl.sh reload/restart
- `do_reload()` 重寫：自動偵測 dev/prod mode
  - Dev mode：build frontend + sync + kill daemons（bun 重啟時直接讀新 source）
  - Prod mode：build frontend + build binary + atomic install + deploy + kill daemons
  - 兩者都 compile stale MCP servers，都不動 gateway
- `do_restart()` 重寫：`do_reload --force` + gateway recompile（if source changed）+ `systemctl restart`
- Help text 和 header comment 已同步更新
- 語法驗證：`bash -n webctl.sh` pass

### Known Remaining Issues
- `Auth.set()` 在 Add dialogs 中仍直接寫 accounts.json（daemon 無 account.add HTTP 端點）
- Phase 5 剩餘項：systemd per-user service 決策、do_status/do_stop 統一、EXPERIMENTAL flag 移除

## Architecture Sync

待 Phase 6 完成後全面同步 `specs/architecture.md`。本 session 已建立基礎設施（spawnOrAdopt, always-attach, Worker elimination），但尚未完成 integration validation。
