# 2026-05-01 Privileged Self-Update Channel

## 需求

- 為 gateway-daemon 模式新增受控 privileged self-update 管道。
- 當 per-user daemon 以 sudoer 身分執行且可非互動 `sudo -n` 時，允許它執行固定白名單更新動作。
- 目標是讓 `pkcs12` 這類 sudoer daemon 能安裝 gateway/webctl/frontend 更新，但不能開放任意 sudo。

## 範圍(IN/OUT)

- IN: daemon 端 sudoer 能力檢查、白名單 self-update executor、`/global/web/restart` gateway target 接入。
- IN: fail-fast 非 sudoer / sudo 需要密碼 / 路徑不在白名單。
- IN: audit log 記錄 user / uid / action / argv / exit code。
- OUT: 本輪不執行實際重啟、不安裝新版 gateway、不改 system sudoers policy。

## 任務清單

- [x] 建立 privileged self-update hotfix event 與 XDG 白名單備份
- [x] 新增 daemon 端 sudoer 能力檢查與白名單 self-update executor
- [x] 接入 `/global/web/restart` 的 gateway target 路徑並 fail-fast 非 sudoer
- [x] 補 focused tests/typecheck 與文件紀錄，不執行重啟

## Debug Checkpoints

- Baseline: `restart_self(targets:["gateway"])` 會呼叫 daemon 內 `/global/web/restart`，目前走 `webctl.sh restart --force-gateway`；實務上已發現 daemon 可編譯 gateway，但無法可靠完成 root-level install/restart。
- Instrumentation Plan: 讀現有 restart route / webctl / bash denylist，新增固定 argv privileged executor，並以 typecheck / focused unit 測試驗證行為，不做 runtime restart。

## Verification

- XDG Backup: `/home/pkcs12/.config/opencode.bak-20260501-1715-privileged-self-update`（白名單快照；僅供需要時手動還原）。
- Implemented: `packages/opencode/src/server/self-update.ts` provides a fixed-action privileged executor. It probes `sudo -n -v`, only runs hardcoded argv for installing `/etc/opencode/webctl.sh`, installing `/usr/local/bin/opencode-gateway`, syncing `/usr/local/share/opencode/frontend`, and restarting `opencode-gateway.service`, and writes audit JSONL to `~/.local/state/opencode/self-update-audit.jsonl`.
- Route integration: in gateway-daemon mode, `/global/web/restart` with `targets:["gateway"]` now compiles `daemon/opencode-gateway.c` with fixed gcc argv, installs `webctl.sh` and the compiled gateway via `SelfUpdate.runActions`, then schedules the service restart after returning the accepted response. Non-sudoer daemons fail fast with `SELF_UPDATE_REQUIRES_SUDOER`.
- Validation: `bash -n webctl.sh` passes; `gcc -fsyntax-only -Wall -D_GNU_SOURCE daemon/opencode-gateway.c` passes; `bun build packages/opencode/src/server/self-update.ts --target bun --outfile /tmp/opencode-self-update.js` passes; `bun build packages/opencode/src/server/routes/global.ts --target bun --outdir /tmp/opencode-global-build` passes.
- Note: `bun --filter opencode typecheck` remains blocked by pre-existing cross-package/type drift errors unrelated to this change; no new self-update/global-route diagnostics were reported by focused builds.
- Runtime safety: no restart, install, or live gateway mutation was executed after this implementation.
