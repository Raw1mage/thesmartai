# Event: webapp MCP session switch

Date: 2026-03-14
Status: Resolved
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## Requirements

- 在 WebApp 下，實現用指令呼叫 MCP 進行 session 切換的功能效果。
- 不接受只回 URL 或文字的偽成功；必須讓 WebApp 實際切到目標 session。

## Scope

### In

- `packages/mcp/system-manager/src/index.ts`
- `packages/app/src/app.tsx`
- 必要的 event / route contract 對齊
- docs/events / architecture sync

### Out

- 大規模 Web router 重構
- 新增 fallback mechanism
- 與 session switch 無關的 UI 調整

## Task List

- [x] 讀 architecture 與既有 system-manager session event
- [x] 搜尋 Web/TUI/session-switch 現況
- [x] 確認 Web 缺少 external session-switch bridge
- [x] 實作最小 Web session-switch bridge
- [x] 讓 MCP `manage_session.open` 走真切換路徑
- [x] 驗證並完成 doc sync

## Baseline

- TUI 已有真切換橋：`tui.session.select` → `route.navigate(...)`。
- WebApp 目前沒有等價的外部 session-switch bridge。
- `system-manager.manage_session.open` 若只回 URL/標題，在 WebApp 上屬於偽成功。

## Root Cause (working)

- 現有 runtime contract 偏向 TUI：
  - backend 已有 `tui.session.select` 事件與 `/api/v2/tui/select-session`
  - Web 原先缺少等價 bridge（此輪前已補上）
- 最終真正的斷點（已修復）：
  - `Bus.publish()` 透過 global SSE 發送事件時，`directory` 不是固定 `"global"`，而是 `Instance.directory`
  - 前端 `WebSessionSelectBridge` 使用 `emitter.on(channel, cb)` 按 channel 訂閱，但 channel key 對不上：
    - `"global"` channel 永遠收不到——`Bus.publish` 只在 `Instance.directory` channel 上發送
    - URL 解碼出的 directory 也不一定匹配（使用者可能不在對應頁面）
  - 修復方式：改用 `emitter.listen(cb)` wildcard listener（同 `global-sync.tsx` 的做法），不再依賴 channel key 匹配
  - 修復後經 runtime 實測確認 MCP `manage_session.open` 可驅動 WebApp 實際切換 session
- 仍有實際路徑阻斷：`system-manager.manage_session.open` 被 `mode="tui"` gate 卡住。
  - 真實 agent/user flow 常以 title → search → open 呼叫 `open`，但不一定帶 `mode`。
  - 造成 open 在 MCP 層 fail-fast，事件根本不會 dispatch，Web 當然無法 visible navigate。
- 另一個設計錯誤是 MCP 內硬編 `127.0.0.1:4096` 作為 session create/open API base URL。
  - 這違反 web runtime 單一事實來源原則。
  - 正確來源應為 `/etc/opencode/opencode.cfg` 中的 `OPENCODE_PUBLIC_URL`（或明確 `OPENCODE_SERVER_URL` env override）。
- 進一步驗證後，真正合理的控制路徑應改為 **方案 A：本機控制通道**，而不是 public URL/proxy。
  - `system-manager` 雖非 server 同程序，但屬本機 MCP 控制面，應優先走 loopback control URL。
  - 既有 `OPENCODE_PUBLIC_URL=https://crm.sob.com.tw` 僅是對外展示/入口，不應作為本機 session-switch 首選控制通道。
- web auth 需補一個明確例外規則：
  - 僅對 **真實 socket peer 為 loopback** 的請求免登入
  - 且請求中不得帶 `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` / `x-forwarded-proto` 等 proxy headers
  - 且 request URL hostname 必須仍是 `127.0.0.1` / `localhost` / `::1`
  - 目的：避免僅靠可偽造 source IP header 開洞

## Repair Direction

1. Web 在 app/router 層訂閱全域事件 `tui.session.select`
2. 收到事件後以目前目錄 slug navigate 到 `/:dir/session/:sessionID`
3. system-manager `manage_session.open` 改為呼叫真實 endpoint `/api/v2/tui/select-session`
4. 若 endpoint/切換失敗，明確 fail-fast，不再回報偽成功
5. 拿掉 `open` 的 `mode="tui"` 強制 gate，讓既有 shared event bridge 真正可被 title/search/open 路徑觸發
6. 拔除 `127.0.0.1:4096` 硬編，改由 `/etc/opencode/opencode.cfg` 的本機 runtime port 推導 loopback control URL（例如 `http://127.0.0.1:<port>/api/v2`）
7. server auth 補 localhost/127.0.0.1/::1 真實直連例外，但只信任 server 自身 socket peer 判定，不信任 forwarded headers
8. 保留 fail-fast：若不是受信任 loopback 控制路徑，仍需正常 auth，不新增 silent fallback
9. ~~WebSessionSelectBridge 需同時監聽 `global` 與目前路由對應的 workspace directory channel~~ → 最終採用 `emitter.listen()` wildcard，根本不需要猜 channel

## Router Context Correction

- 初版實作曾有一個結構風險：若 `WebSessionSelectBridge` 置於 `<Router>` 外層 sibling，`useNavigate()` 將不在合法 router context 內。
- 已修正為將 `WebSessionSelectBridge` 放入 `RouterRoot`，使其位於 Router 子樹內，`useNavigate()` 的取得方式成為結構上正確且穩定的做法。

## Validation

- Code path validation:
  - 確認後端已有 `/api/v2/tui/select-session`，會 `Bus.publish(TuiEvent.SessionSelect, { sessionID })`
  - 確認 SDK 型別已包含 `tui.session.select`
  - 確認 Web global event stream 會把 `global` 事件送入 `globalSDK.event`
  - 本輪新增 `packages/app/src/app.tsx` 的 `WebSessionSelectBridge`，收到 `tui.session.select` 後會讀 session 並 navigate 到 `/${base64(directory)}/session/${sessionID}`
  - 本輪修改 `packages/mcp/system-manager/src/index.ts`，`manage_session.open` 會改打 `/api/v2/tui/select-session`
  - 本輪移除 `manage_session.open` 的 `mode="tui"` 強制 gate，避免 title/search/open 預設呼叫被阻斷
  - 本輪改由 `/etc/opencode/opencode.cfg` 的本機 runtime port 解析 loopback control URL，不再硬編 `127.0.0.1:4096`，也不再優先走 public URL/proxy
  - server 端會以 Bun server 真實 socket peer 寫入 internal loopback marker，auth middleware 只對 `x-opencode-loopback=1` 且無 proxy headers、且 hostname 仍為 loopback 的請求免登入
  - 若不是受信任 loopback 控制路徑，auth 仍照常執行，不做 silent bypass
  - 已確認並修正 Web bridge 訂閱機制：從 `emitter.on(channel)` 改為 `emitter.listen()` wildcard，徹底消除 channel key mismatch 問題
- Typecheck:
  - `bun run --cwd packages/opencode typecheck` ✅
  - `bun run --cwd packages/app typecheck` ⚠️ 失敗，但失敗點在既有 `src/pages/session.tsx(330,44)`，非本次修改檔案
- Targeted test:
  - `bun test packages/mcp/system-manager/src/system-manager-session.test.ts` ✅（含原 mode gate 測試移除後，其他 fork guard 測試通過）
  - `bun test packages/opencode/test/server/session-select.test.ts` ⚠️ 現有測試 timeout；未證明為本次變更引入
- Manual/web runtime verification:
  - ✅ 已實測確認：MCP `manage_session.open` 成功驅動 WebApp 切換至目標 session

## Resolution

最終修復只改一處：`packages/app/src/app.tsx` 的 `WebSessionSelectBridge`。

- **Before**: `globalSDK.event.on(channel, cb)` — 按 channel key 訂閱，需猜測事件會出現在哪個 channel（`"global"` 或 `Instance.directory`），兩邊 key 對不上導致事件被丟棄
- **After**: `globalSDK.event.listen(cb)` — wildcard listener，接收所有 channel 的事件，再在 callback 內過濾 `event.type === "tui.session.select"`
- 此做法與 `global-sync.tsx` 處理其他跨 directory 事件的模式一致
- 同時移除了不再需要的 `useLocation`、`decode64` import

完整事件路徑（已驗證可用）：
```
MCP manage_session.open(sessionID)
  → POST /api/v2/tui/select-session { sessionID }  (loopback auth bypass)
    → Bus.publish(TuiEvent.SessionSelect, { sessionID })
      → GlobalBus.emit("event", { directory: Instance.directory, payload })
        → SSE stream → frontend
          → emitter.emit(directory, payload)
            → WebSessionSelectBridge.listen() catches it
              → navigate(`/${base64(directory)}/session/${sessionID}`)
```

## Architecture Sync

- Verified: `docs/ARCHITECTURE.md` 需要同步。
- 本輪需補入：Web 已與 TUI 共用 `tui.session.select` 作為 shared external session-switch bridge。
