# Event: Mobile Session Tool Parity

Date: 2026-03-08
Status: Done

## 需求

- 讓 mobile webapp 的 context button 比照其他工具按鈕，以全頁 tool page 顯示 context 資訊。
- 確認目前 UI 不再殘留 auto yes 的 toggle button，僅保留 slash commands。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/packages/app/src/components/session/session-header.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/session-context-usage.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session/tool-page.tsx`
- `/home/pkcs12/projects/opencode/docs/events/event_20260308_mobile_session_tool_parity.md`

OUT:

- desktop sidebar interaction redesign
- auto yes slash command removal
- context metrics 計算邏輯變更

## 任務清單

- [x] 盤點 mobile tool page / context button 行為
- [x] 實作 mobile context full-page 顯示
- [x] 確認 auto yes 不再有 UI toggle button
- [x] 驗證 build/runtime 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- mobile `SessionHeader` 目前僅支援 `changes/files/status/terminal` 四個行為，`context` 沒有 mobile parity。
- `SessionContextUsage` 目前一律走 desktop sidebar 的 `layout.fileTree.show("context")` 路徑。
- `use-session-commands.tsx` 只保留 `/auto-yes-enabled` 與 `/auto-yes-disabled` slash commands；repo 搜尋未發現獨立的 auto yes UI toggle component。

### Execution

- `SessionContextUsage` 新增 `mobileToolPage` 路徑；在 mobile 上點擊 context button 時改導向 `/tool/context`，不再走 desktop sidebar state。
- `SessionHeader` 的 mobile subpage 解析 / active state / title / tool navigation 擴充支援 `context`。
- `SessionToolPageRoute` 新增 `context` tool mode，使用 `SessionContextTab` 以全頁方式呈現 context 資訊。
- 重新檢查 repo 內 auto yes 相關 UI：目前僅保留 `/auto-yes-enabled` 與 `/auto-yes-disabled` slash commands；未發現獨立 toggle component，故不做額外 UI 刪除改動。

### Validation

- `bun run build`（workdir: `packages/app`）
  - 通過。
- `./webctl.sh dev-refresh && ./webctl.sh status`
  - 通過，health 為 `{"healthy":true,"version":"local"}`。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次為 mobile surface parity 補齊，未改變 session shell 的核心 pane topology 或 canonical page contract。
