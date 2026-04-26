# filesystem MCP connection closed RCA (2026-04-27)

## 需求

- 使用者回報 Web UI MCP card 顯示 `filesystem` 錯誤：`MCP error -32000: Connection closed`，要求 RCA。

## 範圍(IN/OUT)

- IN: filesystem MCP 啟動、設定來源、UI status card 錯誤呈現、runtime log evidence、XDG config hotfix。
- OUT: 本次未重啟 daemon、未執行 restore。

## Baseline

- 症狀：Web UI 的 `filesystem` MCP card 顯示 `MCP error -32000: Connection closed`，Retry 後仍失敗。
- 影響：filesystem MCP server 無法連線，因此 `filesystem_*` MCP tools 無法由 MCP 層提供。

## Checkpoints / Evidence

- Architecture boundary: `specs/architecture.md` 記錄 MCP tool resolve 由 `packages/opencode/src/session/resolve-tools.ts` 與 `packages/opencode/src/mcp/index.ts` 負責，`~/.config/opencode/mcp.json` 是 split config 的 MCP layer。
- Runtime config: `~/.config/opencode/opencode.json` 仍包含 `mcp.filesystem.command = ["/usr/local/bin/bun", "/usr/local/share/opencode/mcp/server-filesystem/dist/index.js", "$HOME"]`。
- Split config: `~/.config/opencode/mcp.json` 目前是 `{ "mcp": {} }`，不覆蓋 legacy all-in-one entries；runtime 仍從 merged config 看到 `filesystem`。
- MCP launcher: `packages/opencode/src/mcp/index.ts` 對 `key === "filesystem"` 只會 auto-inject current cwd，並不展開 command args 裡的 `$HOME`。
- Filesystem server: `/usr/local/share/opencode/mcp/server-filesystem/dist/path-utils.js` 的 `expandHome()` 只展開 `~` / `~/...`，不展開 `$HOME`。
- Runtime log: `~/.local/share/opencode/log/debug.log` 在 2026-04-27T02:34:12 / 02:34:15 記錄：`mcp stderr: Error accessing directory /home/pkcs12/$HOME`，隨後 `local mcp startup failed ... error: MCP error -32000: Connection closed`。

## Root Cause

`filesystem` MCP 的 allowed-directory 參數被設定成 literal `"$HOME"`。OpenCode MCP launcher 不會替 command args 做 shell/env expansion；filesystem MCP upstream server 也只展開 `~`，不展開 `$HOME`。因此在 daemon cwd 為 `/home/pkcs12` 時，server 嘗試存取 `/home/pkcs12/$HOME`，該路徑不存在，server startup 直接 `process.exit(1)`；stdio transport 看到子程序關閉後回報 `MCP error -32000: Connection closed`。

## 建議修復

1. 將 filesystem MCP command arg 從 `"$HOME"` 改成絕對路徑 `/home/pkcs12`，或改成 upstream 支援的 `"~"`。
2. 長期修復可考慮在 config validation / MCP launcher 對 local MCP command args 中的 `$HOME` 顯式 fail-fast，避免以 connection closed 掩蓋真因。

## Hotfix Applied

- 已依使用者指示將 `~/.config/opencode/opencode.json` 的 filesystem MCP allowed-directory 參數由 `"$HOME"` 改為 `"~"`。
- 修改前備份：`~/.config/opencode.bak-20260427-filesystem-mcp-rca/opencode.json`。

## Verification

- `jq empty ~/.config/opencode/opencode.json` 通過。
- Read-back verified: filesystem MCP command arg is now `"~"`.
- Architecture Sync: Verified (No doc changes). 依據：本次只定位現有 filesystem MCP 設定錯誤，未更動模組邊界、資料流、狀態機或 runtime authority。
