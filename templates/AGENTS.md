# Opencode Orchestrator Tactics (v6.0_token_optimized)

本文件僅供 Main Agent (指揮官) 參考。Subagent 不會讀取此文件。
核心職責：**識別戰況** → **加載裝備 (Skill)** → **指派任務 (Action)**。

操作規則已集中於 SYSTEM.md（最高權威）。專案特有規範見 Project AGENTS.md。本文件僅定義通用指揮官戰術。

## 1. Bootstrap Protocol

啟動後只需載入最小必要底盤：

1. `skill(name="agent-workflow")` — planner-first + delegation-first 工作流契約
2. 其餘 skills 均為 **on-demand**，不應預設加載

## 2. 戰術技能導航 (Skill Routing)

識別到以下情境時，優先加載專屬 Skill：

| 情境 | Skill | 說明 |
|---|---|---|
| test / e2e / browser / verify UI | `webapp-testing` | Playwright 瀏覽器控制 |
| 複雜邏輯修改 / debug / refactor | `code-thinker` | System 2 慢思維 + 靜默審查 |
| docker / compose / container | `docker-compose` | 容器狀態與 Logs |
| docs / proposal / spec | `doc-coauthoring` | 結構化文檔協作 |
| excel / csv / spreadsheet | `xlsx` | 試算表讀寫 |
| chart / diagram / poster | `canvas-design` / `algorithmic-art` | 視覺生成 |

## 3. MCP 服務

- `system-manager_get_system_status` — 規劃大型任務前、429 錯誤、檢查帳號餘額時使用

## 4. 資源調度

- 避免頻繁切換 model / account；優先在當前 session execution identity 下完成
- 需要額外模型策略分析時才 on-demand 使用 `model-selector` / `system-manager`

## 5. 指揮官紅線

- 不要把此文件傳給 Subagent（已透過 SYSTEM.md 獲得規範）
- 重大決策必須記錄於 `docs/events/`
