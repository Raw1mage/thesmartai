# Proposal

## Why

- Subagent context dispatch 對 Codex（Responses API）每次重送 100K token parent history，無法命中 parent 的雲端 cache，浪費大量成本。
- 現有四種 agent 行為模式（Executor / Researcher / Cron / Daemon）混用同一套機制，缺乏正式分類，導致錯誤的架構選擇（例如用 task() 做 daemon 工作）。
- Cron 只能定時觸發，無法做條件觸發的常駐監控。
- Single-child invariant 阻擋 Researcher 類型的平行執行。

## Original Requirement Wording (Baseline)

- "subagent context optimization, subagent evolving to daemon"
- "真正需要委派出去的，應該是完全不同於對話的背景任務，例如啟動一個mail server，一個web server、一個mcp server等等"
- "plan execution (coding agent) 是真正可以獨立的 subagent，讓它做完整個 plan 再回來"
- "如果能用口語隨口叫出一個 agent 開始背景監守工作，應該是滿酷的事"

## Requirement Revision History

- 2026-04-01: 從討論 cache/compaction/checkpoint 架構出發，延伸至 subagent taxonomy 和 daemon evolution

## Effective Requirement Description

1. 優化 Codex subagent dispatch：傳遞 parent previousResponseId（fork）或使用 checkpoint+steps，避免重送 parent history
2. 正式化四種 agent 類型的 taxonomy，明確各自的 dispatch 合約
3. 設計 Daemon agent 架構：條件觸發、常駐、非同步通知
4. 評估 Researcher 類型的平行執行可行性

## Scope

### IN

- Codex fork dispatch（previousResponseId 傳遞）
- Checkpoint-based dispatch（provider-agnostic fallback）
- Subagent taxonomy 正式化（Executor / Researcher / Cron / Daemon）
- Daemon agent 架構設計與實作
- Parallel subagent 可行性評估

### OUT

- 修改 Cron 排程機制本身（已穩定）
- 修改 task() tool 的 schema（向後相容）
- 跨 provider 的 cache 機制統一（各 provider 行為差異太大）

## Non-Goals

- 不做 multi-child 平行執行的完整實作（本 plan 只做可行性評估）
- 不修改 Anthropic/Gemini 的 context dispatch 路徑（stable prefix 已有效）

## Constraints

- Codex fork 只對 `providerId === "codex"` 生效，不影響其他 provider
- Daemon 必須整合現有 Bus / ProcessSupervisor / Lanes 基礎設施，禁止重複造輪子
- Single-child invariant 的任何放寬需要充分的 race condition 審查

## What Changes

- `task.ts`：dispatch 時讀取 parent codexSessionState，傳遞 previousResponseId
- `prompt.ts`：child session 判斷 Codex fork 時跳過 parentMessagePrefix 注入
- 新增 Daemon agent 類型及其 lifecycle 基礎設施
- subagent taxonomy 文件化，並在 `task()` tool schema 中正式標記類型語意

## Capabilities

### New Capabilities

- **Codex fork dispatch**：subagent 第一 round 不重送 parent history，直接讀雲端 cache
- **Checkpoint-based dispatch**：有 checkpoint 時用 summary+steps 取代 full history（all providers）
- **Daemon agent**：口語啟動常駐背景監控，條件觸發，Bus 事件通知
- **Subagent taxonomy**：Executor / Researcher / Cron / Daemon 各有明確語意和合約

### Modified Capabilities

- **Context sharing V2**：Codex 路徑改走 fork，non-Codex 路徑維持現有 stable prefix
- **task() dispatch**：增加 Codex fork 邏輯分支

## Impact

- `packages/opencode/src/tool/task.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/llm.ts`（codexSessionState 讀取介面）
- 新增 `packages/opencode/src/daemon/agent-daemon.ts`（或類似路徑）
- `specs/architecture.md` 需同步更新
