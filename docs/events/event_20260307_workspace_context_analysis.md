# Event: Remote Workspace / WorkspaceContext analysis

Date: 2026-03-07
Status: Done

## 需求

- 針對 upstream Remote Workspace / WorkspaceContext / `workspace_id` 能力做 cms 適配分析
- 依「功能價值優先」原則，評估是否存在可安全切入的最小第一片（first slice）
- 嚴禁直接 merge / cherry-pick upstream；僅允許分析後依 cms 架構重構導入

## 範圍

### IN

- upstream commits:
  - `c12ce2ffff38fae11e22762292c56f1e71c387e7`
  - `cec16dfe953a67cce9c0b6e597d323fb78600c57`
  - `3ee1653f40360fc0a221251f7241425cc7c58d28`
- cms 現有 web multi-user daemon topology / control-plane / session API 邊界比對
- workspace 功能的最小可落地切片定義

### OUT

- 本輪不直接實作完整 remote workspace 系統
- 不直接改寫 session/storage/provider 既有主架構
- 不導入大規模 schema / control-plane wave，除非確認有極小且安全的第一片

## 任務清單

- [x] 讀取 `docs/ARCHITECTURE.md` workspace 相關段落
- [x] 建立 workspace 專題 event
- [x] 分析 upstream workspace 三個關鍵 commits 的實際能力面
- [x] 標記與 cms 架構的衝突點 / 相容點
- [x] 定義 minimum safe first slice（若存在）
- [x] 決定：實作 / 延後
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- cms 現況已具備 web multi-user daemon topology、daemon-routed API domains、以及 per-user runtime ownership。
- upstream workspace wave 不只是 UI/route，還包含 control-plane、workspace server、SSE、DB schema 與 session table 擴充。
- 先前 portability analysis 已明確把 workspace 類變更列為「值得深挖但不可直接搬運」項目。

### Execution

- Upstream workspace wave capability breakdown:
  - `c12ce2ffff38fae11e22762292c56f1e71c387e7` introduces a new workspace control-plane subsystem (`workspace server`, `workspace routes`, `session-proxy-middleware`, `control-plane SSE`, `workspace table`).
  - `cec16dfe953a67cce9c0b6e597d323fb78600c57` adds `WorkspaceContext` as a server-side request/runtime context bridge.
  - `3ee1653f40360fc0a221251f7241425cc7c58d28` extends session persistence with `workspace_id`, making session/workspace affiliation a storage-level contract.
- cms current-state comparison:
  - cms has **workspace UI/worktree concepts** in app sidebar (`sidebar-workspace.tsx`) and multi-project UX.
  - cms does **not** currently contain the upstream `control-plane/workspace*` runtime subsystem.
  - cms backend server currently routes through existing `project`, `session`, `provider`, `account`, `config`, `pty`, and per-user daemon domains; there is no parallel `workspace` routing layer or workspace-scoped session proxy.
  - cms current web multi-user topology already uses `gateway + per-user daemon` architecture. This overlaps conceptually with upstream workspace routing, but the implementation model is different enough that direct file-porting is unsafe.
- Conflict / compatibility assessment:
  - **Compatible direction**: workspace concept aligns with cms multi-project / sandbox direction and has real product value.
  - **Conflict**: upstream assumes new control-plane primitives and DB schema that are absent in cms.
  - **Conflict**: `workspace_id` on session is not a cosmetic field; it changes persistence, query shape, and runtime ownership boundaries.
  - **Conflict**: `WorkspaceContext` depends on request-scoped server plumbing that does not map 1:1 onto cms current gateway + per-user-daemon model.
- Minimum safe first slice decision:
  - No safe first slice exists **inside this tail-pass scope**.
  - Any meaningful implementation would require at least one of:
    1. new workspace persistence contract,
    2. new routed workspace API domain,
    3. explicit integration design between workspace context and per-user daemon routing.
  - Therefore this initiative should be treated as a **dedicated architecture project**, not a tail patch.
- Decision:
  - **Defer implementation for now**.
  - Keep as P1 roadmap item, but it requires a separate design/implementation track instead of incremental tail-porting.

### Validation

- Analysis-only pass completed.
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅完成 workspace capability analysis，未改動 runtime, storage, routing, or control-plane code.
