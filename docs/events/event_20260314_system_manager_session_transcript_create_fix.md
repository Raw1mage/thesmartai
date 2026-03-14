# Event: system-manager session transcript/create fix

Date: 2026-03-14
Status: Fixed
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## Requirements

- 修正 `system-manager_export_transcript` 使用過時 session storage 路徑的問題。
- 修正 `manage_session.create` 只能觸發 TUI `session.new`、卻無法回傳新 session ID 與可操作結果的問題。
- 補一條可在新 session 建立後切換過去處理支線任務的 system-manager 能力。

## Scope

### In

- `packages/mcp/system-manager/src/index.ts`
- 相關 session storage / create / open flow
- event / architecture sync

### Out

- 大規模 session storage migration
- summarize 全面實作
- 非 session-manager 的 UI/導航重構

## Task List

- [x] 建立 canonical session storage 讀取 helper
- [x] 修正 `export_transcript` 讀 canonical nested session storage（移除 legacy fallback）
- [x] 擴充 `manage_session` 支援新 session 建立後回傳可操作資訊
- [x] 補可切換到指定 session 的能力（`open` 強制 `mode: "tui"`）
- [x] 跑 targeted verification

## Baseline

- canonical session storage 現況已是 `storage/session/<sessionID>/info.json` + `messages/<messageID>/info.json`。
- 但 `export_transcript` 仍直接讀 `storage/message/<sessionID>` / `storage/part/<messageID>`。
- `manage_session.create` 目前只寫 `kv.ui_trigger = "session.new"`，實際上只是切回 home/new-session UI，無法把新 session ID 回傳給工具呼叫端。
- `manage_session.open` 初版修補曾回傳 session URL 與標題，但未真正驗證 WebApp/TUI 是否已完成顯示層切換。

## Debug Checkpoints

### Baseline

- `fix subagent problem` session 的實際資料位置已確認在 `~/.local/share/opencode/storage/session/<sessionID>`。
- `system-manager_export_transcript` 報錯卻去找 `~/.local/share/opencode/storage/message/<sessionID>`。

### Root Cause (working)

- `packages/mcp/system-manager/src/index.ts` 的 `export_transcript` 還停留在 legacy split layout 假設。
- 依使用者天條，本系統不允許再保留 legacy fallback；canonical storage 缺失時應 fail-fast。
- `manage_session.create` 也還是 UI-trigger only，沒有真正建立 session / 回傳 session 資訊。
- `manage_session.open` 若只回傳 URL 或文字，而沒有驅動前端實際切換，就屬於**偽成功**；這會造成 control plane 與顯示層狀態分裂。

### Session switch experiment and correction

- 使用者要求直接測試：是否能在目前對話中代理 `/session`，把畫面切到 `fix subagent problem` session。
- 嘗試呼叫：
  - `system-manager_manage_session({ operation: "open", sessionID: "ses_314c08420ffejEhyZg5LtM078x" })`
- 工具回傳：
  - `Open session: ses_314c08420ffejEhyZg5LtM078x`
  - `Title: fix subagent problem`
  - `URL: /L2hvbWUvcGtjczEyL3Byb2plY3RzL29wZW5jb2Rl/session/ses_314c08420ffejEhyZg5LtM078x`
- 但使用者於 **WebApp** 實際觀察到：
  - 畫面**沒有**切換
  - 仍停留在原 session 原對話

### Corrected conclusion

- 先前若把上述結果解讀成「後台已切換成功」，是錯誤判斷。
- 在 WebApp 場景下，**沒有實際顯示層切換，就等於沒有切換成功**。
- 因此 `manage_session.open` 目前在 WebApp 上必須視為能力不足或偽成功，不能再對 agent 暗示「session 已切換」。

### TUI vs Web capability split

- TUI 端其實已有真正的 session switch bridge：
  - `packages/opencode/src/cli/cmd/tui/event.ts`
    - `TuiEvent.SessionSelect`
  - `packages/opencode/src/server/routes/tui.ts`
    - 會 `Bus.publish(TuiEvent.SessionSelect, { sessionID })`
  - `packages/opencode/src/cli/cmd/tui/app.tsx`
    - 收到 `TuiEvent.SessionSelect` 後 `route.navigate({ type: "session", sessionID })`
- 但目前尚未找到 **WebApp 等價** 的外部 session-switch bridge。

### Product / safety implication

- 這不是單純 UX 小問題，而是顯示層與控制層分裂風險：
  - agent 若誤以為已切到新 session，後續支線任務、事件記錄、使用者觀察都會對錯 session 下判斷
  - 使用者明確指出：若後台以為切了、前台仍留在原 session，將是毀滅性錯誤

### Repair direction (updated)

1. `export_transcript`
   - 對齊 canonical nested session storage
   - 移除 legacy fallback；若 canonical 路徑缺失，直接 fail-fast 報錯
2. `manage_session.create`
   - 真正建立 session 並回傳 session info
3. `manage_session.open`
   - 若是 TUI 路徑，可接到 `TuiEvent.SessionSelect` 做真切換
   - 若是 WebApp 且尚無真切換 bridge，必須 **fail-fast**，不能只回 URL 假裝成功
4. 後續若要支援 WebApp 自動切換 session
   - 需新增明確的 Web navigation bridge / route contract，而不是重用 TUI 假設

### Implemented in this round

- `packages/mcp/system-manager/src/index.ts`
  - `export_transcript` 改為直接讀 canonical nested storage：`storage/session/<sessionID>/messages/<messageID>/{info.json,parts/*.json}`。
  - 若 canonical transcript 路徑缺失或不完整，直接 fail-fast，不再 fallback 到 `storage/message` / `storage/part`。
  - `manage_session.create` 先嘗試 `POST /session` 取得真實新 session ID / URL；失敗才退回 UI trigger。
  - `manage_session.open` 新增參數 `mode`，且強制 `mode: "tui"` 才允許 dispatch 到 `/tui/select-session`。
  - `manage_session` schema 已新增 `mode` 說明，明確標示非 TUI 模式 fail-fast。
- `packages/mcp/system-manager/src/system-manager-session.ts`
  - 新增 `assertManageSessionOpenMode(mode)` 作為 fail-fast gate，避免未確認 ACK 的 Web 切換被誤報成功。
- `packages/mcp/system-manager/src/system-manager-session.test.ts`
  - 新增 `manage_session.open requires explicit tui mode` 測試。

## Validation

- Transcript 路徑 RCA：已確認 `fix subagent problem` session 真實 storage 位於 `storage/session/<sessionID>`，非 `storage/message/<sessionID>`。
- Session switch 實驗：已確認 `manage_session.open` 在 WebApp 上**未**造成實際畫面切換，因此目前不能視為成功。
- 測試：`bun test packages/mcp/system-manager/src/system-manager-session.test.ts`
  - 結果：`6 pass / 0 fail`
  - 含新增 `manage_session.open` mode gate fail-fast 測試。

## Architecture Sync

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪變更聚焦 `system-manager` MCP 工具對 canonical transcript storage 的讀取策略與 fail-fast 安全邊界，未新增/改動核心模組邊界與 runtime dataflow；因此 `docs/ARCHITECTURE.md` 無需修改。
