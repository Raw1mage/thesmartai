# Event: restore local MCP set and plan evolve agent

Date: 2026-03-08
Status: Completed

## 需求

- 補回 local 端原有的 MCP 設定，恢復完整本地 MCP arsenal。
- 啟用目前 local 端原有的 MCP servers。
- 開始規劃一個可自我擴充能力、能從外部 skill/MCP market 搜尋與安裝能力的 `evolve agent`。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/.config/opencode/opencode.json`
- `docs/events/` 任務紀錄
- 規劃 `evolve agent` 的 capability registry / router / installer 架構方向

### OUT

- 本輪不直接實作完整 evolve agent runtime
- 本輪不直接安裝新的外部 MCP / skill
- 本輪不重構現有 session/tool routing code

## 任務清單

- [x] 比對 backup config 與現行 config，確認原有 local MCP 清單
- [x] 補回並啟用原有 local MCP
- [x] 重啟 runtime 並檢查 MCP 狀態
- [x] 產出 evolve agent 初版規劃
- [x] 完成 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- 目前 `~/.config/opencode/opencode.json` 只恢復了 `fetch`、`memory`、`system-manager`、`refacting-merger(false)`。
- backup config 顯示過去本地原有 MCP 還包含 `filesystem`、`sequential-thinking`，且 `refacting-merger` 原本為 enabled。
- 現有 repo 已同時存在 resident MCP 與 on-demand MCP 兩種機制，但尚未有完整的「自我搜尋/安裝外部能力」agent。

### Execution

- 以 `/home/pkcs12/.config/opencode/opencode.json.bak` 為依據，比對出 local 端原有 MCP 集合為：`filesystem`、`fetch`、`memory`、`sequential-thinking`、`system-manager`、`refacting-merger`。
- 已將目前 runtime config 補齊：
  - 新增 `filesystem` 並設為 `enabled: true`
  - 保留 `fetch` / `memory` / `system-manager` 為 `enabled: true`
  - 新增 `sequential-thinking` 並設為 `enabled: true`
  - 將 `refacting-merger` 從 `enabled: false` 恢復為 `enabled: true`
- 已新增規劃文件：`docs/specs/evolve_agent_capability_broker.md`
  - 將 `evolve agent` 初版拆成 `registry` / `broker` / `market adapter` / `installer` / `activation lifecycle` 五層。
  - 明確建議先做 in-process `CapabilityBroker`，不要先做 routing MCP。

### Validation

- `npm view @modelcontextprotocol/server-filesystem name version` ✅
- `npm view @modelcontextprotocol/server-sequential-thinking name version` ✅
- `test -f /home/pkcs12/projects/opencode/packages/mcp/refacting-merger/src/index.ts` ✅
- `./webctl.sh dev-start` ✅（runtime 已重啟，pid 47036）
- `read ~/.config/opencode/opencode.json` ✅（確認 6 個 local MCP entries 均已存在且設為 enabled）
- 補充：由於本地 web runtime 的 `/mcp/status` 需經 PAM auth，當前回合未直接做 authenticated API 驗證；但 config 已恢復且 runtime 已重新載入。
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪主要修改本機 runtime config，並新增未落地實作的規劃文件；未改變 repo 現行 architecture baseline。
