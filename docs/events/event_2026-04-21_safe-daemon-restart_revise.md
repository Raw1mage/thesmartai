# Scope Revision — safe-daemon-restart (2026-04-21)

Plan: `specs/_archive/safe-daemon-restart/`
Trigger: user clarified real self-restart scenario covers rebuild+install, not just signal-based respawn.

## What changed

Original plan assumed `restart_self` was "SIGTERM + gateway respawn". User pointed out the actual use case is:

> 自殺式重啟通常的情境是因為「給自己改了設計」——寫了 beta branch fetch-back 到 test branch 後需要重啟生效。涉及 src rebuild / frontend rebuild / gateway rebuild / install to system。

## Discovery

- `/api/v2/global/web/restart` already exists on the bun daemon (`packages/opencode/src/server/routes/global.ts:479`)
- UI 設定頁 "Restart Web" 按鈕已經在用它（`packages/app/src/components/settings-general.tsx`）
- Legacy 模式路徑已有完整 webctl.sh rebuild 整合（smart stamp-based skip per layer）
- **Gap**: gateway-daemon 模式分支只自殺、不 rebuild

## Decisions (amended)

- **DD-1b** (supersedes DD-1): 重用既有 `/web/restart` endpoint。MCP tool 薄層 POST。不建新 gateway endpoint。
- **DD-2b** (supersedes DD-2): 重啟流程委派給 `webctl.sh restart`。Dirty-detect + per-layer rebuild + install 都由它處理。Gateway 自身靠 systemd respawn（`--force-gateway` 旗標）。

## User answers recorded

1. **Rebuild 策略**：效法 `webctl.sh restart`（smart auto-detect）
2. **Gateway 重啟**：yes, via systemd respawn
3. **Frontend**：prod bundle 才重建，dev 模式靠 vite HMR

## Task impact

- Phase 2 重寫：從「寫新 gateway C endpoint」改成「擴充既有 daemon TS endpoint 的 gateway-daemon 分支讓它呼叫 webctl」
- Phase 3 簡化：MCP tool 只是 POST 薄層
- Phase 4-6 不變

## Estimated size reduction

原本 phase 2 是 C 端 HTTP dispatch + async job queue + 503 gating，估計 ~300 LOC + integration harness。
revised phase 2 是 TS 端擴充既有分支，估計 ~60 LOC + 一個 smoke test。

## Mode

本應該是 plan-builder `revise` 模式（scope adjustment）。因 plan 還在 `implementing` / 尚未 `living`，直接以 inline delta marker + section-level supersede 標示。狀態不變。
