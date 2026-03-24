# Event: Google Calendar Agent Survey

## 需求

- 研究是否已有可用的 GitHub 開源方案，可作為本系統擴充 Google Calendar agent / API 的基底。
- 目標能力：透過 LLM 解讀使用者語意，管理 Google Calendar（查詢、建立、修改、刪除行程等）。

## 範圍

### IN

- 讀取既有 architecture 文件作為系統基線。
- Survey GitHub / 開源實作方向。
- 評估哪些方案適合直接 fork / vendor / 改造整合進 opencode cms。

### OUT

- 本回合不直接實作 Google Calendar 整合。
- 本回合不建立正式 plan package。
- 本回合不進行 commit / push / PR。

## 任務清單

- [x] 建立架構與文件研究基線
- [x] Survey GitHub 候選方案
- [x] 彙整整合建議與下一步

## 對話重點摘要

- 使用者要求先確認 GitHub 是否已有現成方案，優先考慮直接拿來改。

## Debug Checkpoints

### Baseline

- 任務類型為 solution survey，非 bugfix。

### Instrumentation Plan

- 以 architecture 文件確認本系統整合邊界。
- 以外部 repository survey 尋找可重用方案。

### Execution

- 已讀取 `specs/architecture.md` 作為系統基線。
- 已 survey GitHub 候選方案，重點比對 MCP server、A2A agent、完整 calendar assistant 三類實作。
- 候選重點：
  - `nspady/google-calendar-mcp`
  - `takumi0706/google-calendar-mcp`
  - `inference-gateway/google-calendar-agent`
  - `jgordley/GoogleCalendarAssistant`

## Survey Findings

### 候選 1：nspady/google-calendar-mcp

- URL: https://github.com/nspady/google-calendar-mcp
- 類型：TypeScript MCP server
- 能力：list/search/get/create/update/delete event、freebusy、respond-to-event、list-calendars、multi-account、recurring events、natural language scheduling、圖片/PDF/link 匯入事件。
- Auth：Google OAuth Desktop App。
- 可重用性：最高。與本系統同為 TypeScript / agent-tool 風格，且 README 與專門文件已明示 multi-account concurrent access，和 cms 的多帳號控制平面方向高度一致。
- 風險：它本身是獨立 MCP server，若直接內嵌進 opencode，需要拆出 auth / tool / account registry 邏輯，避免雙份 account state。

### 候選 2：takumi0706/google-calendar-mcp

- URL: https://github.com/takumi0706/google-calendar-mcp
- 類型：TypeScript MCP server
- 能力：get/create/update/delete/authenticate，支援 recurring events、partial update、manual auth。
- Auth：Google OAuth2，env 提供 client id / secret / redirect uri。
- 可重用性：中高。程式體量較輕，較適合抽取最小可用 Google Calendar service layer。
- 風險：功能面比 nspady 版本窄，且多帳號與跨 calendar 協作能力較弱。

### 候選 3：inference-gateway/google-calendar-agent

- URL: https://github.com/inference-gateway/google-calendar-agent
- 類型：Go A2A agent server
- 能力：list/get/create/update/delete event、find available time、check conflicts。
- Auth：Google credentials path / service account JSON / calendar ID 設定。
- 可重用性：中。可借鏡 agent skill / operation surface 設計，但 tech stack 為 Go，與本 repo TypeScript 主體不一致，不適合直接 vendor 進現有 runtime。
- 風險：更像獨立服務而非內嵌式模組；若採用將增加跨語言維運成本。

### 候選 4：jgordley/GoogleCalendarAssistant

- URL: https://github.com/jgordley/GoogleCalendarAssistant
- 類型：完整 app（Next.js + FastAPI + MongoDB + LangChain）
- 能力：README 描述為 LLM chatbot 處理 Google Calendar tasks。
- Auth：Google Cloud + OpenAI API + app 自建後端。
- 可重用性：低到中。較適合借 prompt / UX / full assistant workflow 概念，不適合直接 fork 進 cms。
- 風險：系統過重、依賴多、架構與 opencode 差異大。

### Root Cause

- N/A（研究任務，尚無故障根因）

### Validation

- 已驗證候選 repo 的 README / metadata / repo 結構，確認可分為：
  - 可直接改造的 MCP server：`nspady/google-calendar-mcp`、`takumi0706/google-calendar-mcp`
  - 可借鏡 agent surface 的 A2A server：`inference-gateway/google-calendar-agent`
  - 僅適合作產品/流程參考的完整 assistant app：`jgordley/GoogleCalendarAssistant`
- Architecture Sync: Verified (No doc changes)

## 建議結論

1. **最佳直接改造基底：`nspady/google-calendar-mcp`**
   - 原因：功能最完整、TypeScript、已有多帳號與多 calendar 邏輯、與本系統多帳號定位最接近。
2. **最薄可行替代：`takumi0706/google-calendar-mcp`**
   - 若想先做最小 MVP，可優先抽它的 OAuth + CRUD tool layer，再由 opencode 自己加上多帳號與語意層。
3. **A2A / 獨立 agent 路線不建議作為第一版主路徑**
   - 因為本系統已經有自己的 agent/runtime/control plane，優先應該內建 calendar tool/service，而不是再引入另一套 agent server。
4. **最新規劃決策：以 managed MCP app + app market 方式落地**
   - 使用者已明確指定：Google Calendar 不應只是單一功能，而應成為未來 app market 的第一個 installable app。

## 下一步建議

- 第一實作 slice 應為：
  1. 先建立內建 app market / MCP registry 與 install lifecycle。
  2. 以 `nspady/google-calendar-mcp` 為主要參考，抽出 Google Calendar auth + event service + tool contract。
  3. 在 opencode 內改造成 managed app，而非外掛 fallback server。
  4. 讓現有 LLM / tool-calling 透過 app capability surface 驅動 calendar CRUD / freebusy。
  5. 在 MVP build slice 補齊 validation command contract：repo guard 使用 `bun x tsc --noEmit`，managed-app acceptance command 需新增 `test:managed-app-registry`、`test:app-market-shell`、`test:google-calendar-managed-app`、`smoke:google-calendar-managed-app`。
  6. Operator 驗收以 install / configure / authorization-required / enable-disable / runtime-ready / fail-fast error states 為最低可見檢查面，且全程不得 silent fallback。

## Planning Follow-up

- 已建立 active plan：`plans/20260324_googke-agent/`
- 規劃主題已從單一 Google Calendar agent 擴展為：
  - 內建 MCP app market / registry
  - Google Calendar 作為第一個 managed app
- `/specs` 現況已確認為 semantic roots 為主：
  - `shared-context-structure`
  - `scheduler-channels`
  - `daemonization`
  - `message-bus`
  - `account-management`
  - `kill-switch`
  - `system-prompt`
  - `builder_framework`
  - `agent_framework`
  - `telemetry`
  - `codex-protocol`
- 本次 active plan 仍正確位於 `/plans/20260324_googke-agent/`，未與既有 `/specs/` formalized roots 衝突。

## Documentation Sync Requirement

- 本 feature 後續進入 build/驗收時，`docs/events` 必須補記最終 shipped 行為：managed app registry 邊界、install lifecycle、Google Calendar auth/config/runtime state、Web/TUI operator surface、fail-fast error observability、以及 beta worktree 執行與驗證註記（若適用）。
- 同步完成前，`specs/architecture.md` 必須更新為長期 SSOT，明確吸收 managed app registry authority、catalog/runtime ownership、Google Calendar managed app 與 canonical auth/account 邊界、state machine、以及 operator-visible observability contract。
- Completion gate：若 build slice 只完成程式與測試、但未逐項驗證上述 docs sync，則不得宣稱 implementation complete。
