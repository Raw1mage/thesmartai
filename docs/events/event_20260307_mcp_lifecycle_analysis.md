# Event: MCP lifecycle / orphan cleanup analysis

Date: 2026-03-07
Status: Done

## 需求

- 分析 upstream `fix: kill orphaned MCP child processes ... (#15516)` 在 cms 的適配方式
- 找出不增加架構風險的最小第一片，提升 MCP child process lifecycle 穩定性
- 避免直接搬運不相容的 runtime 假設

## 範圍

### IN

- upstream commit `c4c0b23bff52878014007e53de7657a59df95915`
- cms 現有 `mcp` / `plugin` / `server` / CLI 啟動點
- orphan child process cleanup 的最小可落地切片

### OUT

- 不直接重寫整個 MCP runtime
- 不做與本輪無關的 provider / session / workspace 重構

## 任務清單

- [x] 建立 MCP lifecycle 專題 event
- [x] 盤點 cms 當前 MCP 啟動 / 子程序 / 關閉路徑
- [x] 比對 upstream orphan cleanup commit 的核心意圖
- [x] 定義 minimum safe first slice
- [x] 決定：實作 / 延後
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- upstream `#15516` 只改動少數檔案，表面上屬於小 patch，但需要先確認 cms 的 MCP runtime 結構是否仍對應相同入口點。
- cms 現有 `packages/opencode/src/server/routes/mcp.ts`、`packages/opencode/src/cli/cmd/mcp.ts`、`packages/opencode/src/plugin/index.ts` 已表明 MCP / plugin / server 面存在足夠交集，值得進一步分析。

### Execution

- cms current MCP lifecycle findings:
  - `packages/opencode/src/index.ts` already performs global `ProcessSupervisor.disposeAll()` in `finally`, which covers process cleanup on CLI shutdown.
  - `packages/opencode/src/mcp/index.ts` already contains descendant-tree cleanup for local MCP stdio clients before client close, covering the main orphan-child-process problem from upstream `#15516`.
  - Therefore upstream `#15516` is mostly already represented in cms behavior, but one small slice was still missing: exposing `OPENCODE_PID` to MCP child processes.
- Minimum safe first slice:
  - Add `process.env.OPENCODE_PID = String(process.pid)` during CLI bootstrap.
  - Forward `OPENCODE_PID` into local MCP `StdioClientTransport` env.
  - This is architecture-safe, isolated, and compatible with current MCP runtime.
- Implementation:
  - `/packages/opencode/src/index.ts` now seeds `OPENCODE_PID` alongside other bootstrap env vars.
  - `/packages/opencode/src/mcp/index.ts` now explicitly forwards `OPENCODE_PID` into local MCP child process env.
- Decision:
  - Implemented the first safe MCP lifecycle slice.

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅補齊 CLI bootstrap → local MCP child process 的 `OPENCODE_PID` 傳遞鏈路，未改動 MCP runtime 邊界、server routing、或 process supervisor 架構。
