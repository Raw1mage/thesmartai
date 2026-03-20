# Design: openclaw_reproduction

## Context

- 先前存在兩個 `openclaw*` plan，已合併為單一主計畫。
- 2026-03-16：kill-switch 控制面 Phase A-D 已交付，成為本計畫第一個具體實作切片。
- 計畫現進入 UI 表面、基礎設施擴展、與後續 Trigger/Queue 切片階段。

## Consolidation Strategy

- 保留 benchmark findings，內化到單一主計畫。
- 保留 scheduler substrate 的 build entry slice。
- 舊 plan 保留作 reference history，避免破壞可追溯性。
- kill-switch 子 specs（`specs/20260316_kill-switch/`）保留作實作細節參考，authority 歸本計畫。

## Consolidated Conclusions

### OpenClaw traits worth learning

- always-on gateway / daemon
- lane-aware queue
- heartbeat / cron as first-class trigger sources
- isolated autonomous job sessions
- restart / drain / host observability lifecycle

### Opencode already has

- approved mission gate
- todo-driven continuation
- pending continuation queue
- supervisor / lease / retry / anomaly evidence
- explicit approval / decision / blocker gates

### Portable next

- generic trigger model（Slice 2）
- lane-aware run queue（Slice 3）
- workflow-runner as generic orchestrator

### Deferred later → Stage 3（D.1-D.3, now expanded）

- D.1 isolated job sessions → Phase 8
- D.2 heartbeat / wakeup substrate → Phase 9
- D.3 daemon lifecycle / host-wide scheduler health → Phase 10

IDEF0/GRAFCET: `specs/20260315_openclaw_reproduction/diagrams/`

---

## Slice 1 Design: Kill-switch 控制面

### Architecture

```
Operator ──▶ Web Admin UI / TUI / CLI
                    │
                    ▼
            API Layer (Hono)
            POST /api/v2/admin/kill-switch/trigger
            POST /api/v2/admin/kill-switch/cancel
            POST /api/v2/admin/kill-switch/status
            POST /api/v2/admin/kill-switch/tasks/:sessionID/control
                    │
                    ▼
            ┌─────────────────────┐
            │  KillSwitchService  │
            │  - State management │
            │  - MFA verification │
            │  - Audit logging    │
            │  - Snapshot trigger  │
            └────────┬────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    Control       State       Snapshot
    Transport     Store       Backend
    (Local/Redis) (Memory)   (Local/MinIO)
```

### State Model

- States: `inactive` → `soft_paused` → `hard_killed` → `inactive`（cancel）
- State key: JSON object with `active`, `initiator`, `reason`, `initiated_at`, `mode`, `scope`, `ttl`, `snapshot_url`
- Cooldown: 5s per operator; Idempotency: 10s window for same initiator+reason

### Control Protocol

- Sequence number + ACK model（monotonic per-session）
- Events: task_started, task_progress, task_completed, task_failed, task_heartbeat
- Controls: pause, resume, cancel, snapshot, set_priority
- ACK timeout: 5s → fallback to force-cancel via `SessionPrompt.cancel()`

### Soft vs Hard Kill

- **Soft**: mark state → reject new tasks (409) → send graceful-shutdown signal via control channel
- **Hard**: after `soft_timeout` → force-terminate remaining workers → write final audit

### Snapshot Orchestration

- Async job: collects system logs (1000 lines), active sessions, outstanding tasks, provider usage
- Storage: local (default) or MinIO/S3 (via env)
- Signed URLs with 1-week expiry
- Non-blocking on failure（audit logs the failure reason）

### RBAC Model

- `kill_switch:trigger`: global kill（requires MFA）
- `task:control`: per-session control（no MFA required）
- All actions logged to audit trail

### Delivered Files (Phase A-D)

- `packages/opencode/src/server/killswitch/service.ts` — core service
- `packages/opencode/src/server/routes/killswitch.ts` — API routes
- `packages/opencode/src/cli/cmd/killswitch.ts` — CLI commands
- `packages/app/src/components/settings-kill-switch.ts` — frontend helpers
- Tests: `service.test.ts`, `killswitch.test.ts`, `session.killswitch-gate.test.ts`, `settings-kill-switch.test.ts`

### Real-time Status Push Pattern（DD-1 resolved: SSE）

Codebase 100% SSE-native（`streamSSE` from Hono），無 WebSocket 基礎設施。Kill-switch 即時狀態推送複用現有 Bus → SSE pipeline：

```
KillSwitchService.setState() / clearState()
  → Bus.publish(Event.KillSwitchChanged, state)
    → SSE stream at /api/v2/event
      → event-reducer.ts case "killswitch.status.changed"
        → store.killswitch_status = reconcile(state)
```

關鍵檔案：
- `packages/opencode/src/server/event.ts` — 定義 `KillSwitchChanged` BusEvent
- `packages/opencode/src/server/killswitch/service.ts` — 在狀態變更後 Bus.publish
- `packages/app/src/context/global-sync/event-reducer.ts` — 前端 reducer handler
- `packages/app/src/context/global-sync/types.ts` — store 新增 `killswitch_status` 欄位

### Design Decisions

| ID | Decision | Options | Status |
|----|----------|---------|--------|
| DD-1 | 即時狀態推送機制 | SSE vs WebSocket | **resolved: SSE** — codebase 100% SSE-native |
| DD-2 | MFA 整合方式 | 複用現有系統 vs 新建 | pending — scaffolding 已有 generateMfa/verifyMfa |
| DD-3 | Snapshot timing vs hard-kill window | 固定 soft_timeout vs 動態延展 | pending |

---

## Slice 2 Design: Continuous Worker（pending）

### 2A — Plan-trusting Continuation Mode（P0：核心痛點）

#### 問題陳述

有完整 implementation spec + approved mission + tasks.md，AI 還是每一步都停下來問「要不要繼續」。

原因是 continuation 有**兩層攔截**，都沒有「信任 plan」模式：

```
prompt.ts 主迴圈
  │
  ├─ 第一層：planAutonomousNextAction()（確定性，workflow-runner.ts L652-723）
  │     ├─ subagent_session → stop（合理）
  │     ├─ autonomous_disabled → stop（合理）
  │     ├─ mission_not_approved → stop（合理）
  │     ├─ blocked → stop（合理）
  │     ├─ approval_needed → stop（合理）
  │     ├─ product_decision_needed → stop（合理）
  │     ├─ wait_subagent → stop（合理）
  │     ├─ todo_complete → stop（合理）
  │     ├─ max_continuous_rounds → stop ← 有 plan 時不該有輪數上限
  │     └─ todo_pending / todo_in_progress → continue ✓
  │
  └─ 第二層：handleSmartRunnerStopDecision()（LLM-based，prompt.ts L863-1045）
        └─ 呼叫 smart-runner-governor（generateObject）做二次判斷
        └─ 可覆蓋第一層的 "continue" 為：
             ├─ ask_user → stop ← plan 已有，不需要再問
             ├─ pause_for_risk → stop ← plan 已被 approved，風險已評估
             ├─ replan_required → stop ← spec 沒變就不需要 replan
             ├─ complete → stop ← 應該信任 todo_complete 而不是 LLM 判斷
             └─ continue → 真正繼續 ✓
```

#### 目標：Plan-trusting Mode

當 session 滿足以下條件時，進入 plan-trusting mode：
- `mission.executionReady === true`
- `mission.contract === "implementation_spec"`
- `mission.source === "openspec_compiled_plan"`
- spec 檔案未被修改（hash 比對或 mtime 比對）

Plan-trusting mode 下的行為：

| 攔截點 | 正常模式 | Plan-trusting mode |
|--------|---------|-------------------|
| `max_continuous_rounds` | N 輪後停 | **跳過**（plan 控制進度，不需輪數限制）|
| smart-runner-governor `ask_user` | 停下問人 | **跳過**（plan 已有，不需再問）|
| smart-runner-governor `pause_for_risk` | 停下怕風險 | **跳過**（plan 已被 approved）|
| smart-runner-governor `replan_required` | 停下重新規劃 | **跳過，除非 spec dirty**（spec 沒變就不需要 replan）|
| smart-runner-governor `complete` | 停下說做完了 | **改用 todo_complete 判斷**（信任 todo 狀態而不是 LLM）|
| kill-switch | 停 | **不變**（blocker）|
| approval_needed | 停 | **不變**（blocker，如果 requireApprovalFor 有設）|
| blocked / provider error | 停 | **不變**（blocker）|
| todo_complete | 停 | **不變**（真的做完了）|

#### 關鍵檔案

- `packages/opencode/src/session/prompt.ts` — `handleSmartRunnerStopDecision()` (L863-1045)：加入 plan-trusting 短路
- `packages/opencode/src/session/workflow-runner.ts` — `planAutonomousNextAction()` (L652-723)：plan-trusting mode 下跳過 `max_continuous_rounds`
- `packages/opencode/src/session/smart-runner-governor.ts` — `getSmartRunnerConfig()` (L1135)：加入 `planTrusting` flag
- `packages/opencode/src/session/mission-consumption.ts` — plan-trusting 條件判斷

### 2B — Multi-source Trigger（P1：擴展性）

#### 問題陳述

目前啟動 run 只能透過 chat 訊息 → continuation。想讓不同 session 扮演不同角色（開發執行者、收信助手、YouTube 小編），需要多源觸發。

#### 目標架構

```
RunTrigger { type, source, payload, priority, gatePolicy }
  ├─ type: "continuation"  → 現有 mission continuation（降階為 trigger source 之一）
  ├─ type: "api"           → API 直接觸發（POST /api/v2/trigger）
  ├─ type: "cron"          → 定時排程
  ├─ type: "webhook"       → 外部事件觸發
  └─ type: "replay"        → 佇列重放

TriggerEvaluator
  ├─ evaluateGates(trigger) → 根據 gatePolicy 判斷是否放行
  │     ├─ mission gate（只有 continuation 型 trigger 需要）
  │     ├─ approval gate（所有 trigger 共用）
  │     ├─ kill-switch gate（所有 trigger 共用）
  │     └─ custom gates（per-trigger 可擴展）
  └─ toQueueEntry(trigger) → 轉為 queue entry（銜接 Phase 6）
```

#### 必須保留的語意（不可破壞的 gate）

| Gate | 現有位置 | 保留方式 |
|------|---------|---------|
| approved mission | `planAutonomousNextAction()` L667-673 | continuation trigger 專屬 gate |
| approval gate (push/destructive/arch) | `detectApprovalGate()` L272-319 | 共用 gate，所有 trigger type 適用 |
| decision gate | `planAutonomousNextAction()` L698-701 | 共用 gate |
| kill-switch scheduling gate | `assertSchedulingAllowed()` | 共用 gate，不可繞過 |

#### 使用者 vision

```
opencode
  ├─ 對話 session（shell）── 永遠可互動
  ├─ worker: 開發計畫執行者（按 implementation spec 跑 tasks）
  ├─ worker: 收信助手（watch email, summarize, reply）
  ├─ worker: YouTube 小編（draft scripts, schedule posts）
  └─ worker: ...任何持續性任務
```

#### 設計決定待定

| ID | 決定 | 選項 | 影響 |
|----|------|------|------|
| DD-4 | RunTrigger 是 interface 還是 discriminated union | interface + type field vs Zod discriminated union | 影響序列化和驗證 |
| DD-5 | Gate evaluation 是同步還是異步 | 同步（current） vs 異步（支援遠端 gate） | 影響 API trigger latency |
| DD-6 | Trigger 的 persistence | 記憶體 vs Storage | 影響重啟後 replay 能力 |

---

## 跨切片設計議題：Worker 呈現與對話並行

### 核心模型：Unix Process Model

採用 Linux multi-process 架構作為設計類比：

```
Terminal（shell）── 永遠可輸入，不被任何 process 佔住
  ├─ command &          → 丟到背景跑（background worker）
  ├─ jobs / ps          → 列出正在跑的 process
  ├─ fg %1              → 把背景 process 拉到前景（看它的輸出）
  ├─ kill %1            → 停掉特定 process
  ├─ kill -9 / shutdown → kill-switch（全停）
  ├─ top                → 即時 dashboard
  └─ crontab            → 排程觸發
```

### 對應關係

| Unix 概念 | opencode 對應 | 說明 |
|-----------|--------------|------|
| Terminal / Shell | 對話 session | 永遠可輸入，不被 worker 佔住 |
| Process | Worker（一次 run） | 有 worker ID，可在背景執行 |
| PID | Worker ID | 用於 jobs/kill/fg 的識別 |
| `command &` | trigger → background | trigger 送出後 worker 在背景跑 |
| `jobs` / `ps` | `/workers` | 列出所有 active worker |
| `fg %1` | `/attach <id>` | 把 worker 輸出串流到對話中 |
| `kill %1` | `/kill <id>` | 停掉特定 worker |
| `kill -9` / `shutdown` | kill-switch | 全域停止 |
| `top` | worker dashboard | sidebar 或狀態列，即時顯示 |
| `crontab` | cron trigger | 排程觸發 |
| stdout/stderr | worker 的 assistant 輸出 | 背景時靜默，fg 時串流到對話 |
| exit code | worker 完成狀態 | done / failed / killed |

### 設計原則

1. **Terminal ≠ Process** — 對話 session 是 shell，不是 process。現有的「1 session = 1 對話 = 1 worker」必須拆開。
2. **背景是預設** — trigger 產生的 worker 預設在背景跑，不佔住對話。使用者可以隨時 attach 看輸出。
3. **從對話框操作** — 所有 worker 管理透過對話輸入（slash command 或自然語言），不需要另開控制面板。
4. **Dashboard 是 `top`** — sidebar / status bar 是被動顯示，不是互動入口。互動永遠從對話框。

### 架構影響

| 面向 | 現有架構 | Unix Process Model |
|------|---------|-------------------|
| Session 對應 | 1 session = 1 對話 = 1 worker | shell session（對話）+ N worker processes |
| 對話佔用 | assistant 回覆期間，對話被鎖 | 對話永遠可輸入（worker 在背景） |
| Worker 輸出 | 直接寫入對話 message stream | 背景：寫入 worker log；`fg` 時：串流到對話 |
| 狀態顯示 | 最後一條 assistant 訊息 | `top`-like dashboard（sidebar / status bar） |
| 干預方式 | kill-switch 或等結束 | `/kill <id>`、`/pause <id>`、kill-switch |

### 設計決定

| ID | 決定 | 選項 | 狀態 |
|----|------|------|------|
| DD-10 | Shell session 與 worker 的分離方式 | (a) 對話 session 保持現有 schema，worker 是獨立的輕量 entity (b) worker 本身是 sub-session (c) worker 是新的 first-class entity，跟 session 平行 | pending |
| DD-11 | Worker 輸出的儲存與串流 | (a) Worker 輸出寫入獨立 log，`fg` 時 SSE 串流到對話 (b) Worker 輸出寫入對話 message 但標記為 background (c) 混合 | pending |
| DD-12 | Dashboard 呈現 | (a) TUI status bar + Web sidebar (b) 對話窗內浮動 overlay (c) 都支援，使用者可切換 | pending |

### 階段建議

- **Phase 5（backend）**：RunTrigger 介面 + gate evaluation 重構。不動 UI，但 worker 的資料模型要預留 shell/process 分離。
- **Phase 6（backend）**：RunQueue + lane policy。supervisor 可以多 worker 並行消費。Worker entity 的 CRUD 在這裡落地。
- **Phase 7（UI）**：worker dashboard + `/workers` + `/kill` + `/attach` 的 UI 呈現。DD-10~12 必須在此之前決定。

理由：backend 先落地讓 trigger 解耦和 queue 分道可以跑測試驗證；UI 的 shell/process 分離牽扯面更廣，值得獨立規劃。但 Phase 5/6 的資料模型設計**必須預見** Phase 7 的需求，不能到時候才發現 schema 不夠用。

---

## Slice 3 Design: Lane-aware Run Queue（pending）

### 問題陳述

目前的 pending continuation queue 是簡單的 per-session key-value（`Storage["session_workflow_queue"]`），supervisor 每 5 秒全掃一遍，先到先做。問題：

- 沒有優先級：緊急修復和背景任務排同一條隊
- 沒有並發控制（lane 層級）：只有 per-session 的 `resumeInFlight` Set
- supervisor 是全局單例，擴展性受限

### 現有架構（要改的部分）

```
Storage["session_workflow_queue", sessionID] → PendingContinuationInfo
  └─ { sessionID, messageID, createdAt, roundCount, reason, text }

ensureAutonomousSupervisor() — 5s 輪詢
  └─ resumePendingContinuations()
       └─ listPendingContinuations() → 全掃
            └─ 逐個 resume（per-session 鎖 via resumeInFlight Set）
```

### 目標架構（參考 OpenClaw queue.md）

```
RunQueue
  ├─ lanes:
  │     ├─ critical  — kill-switch recovery, approval responses（cap: 2）
  │     ├─ normal    — mission continuation, API triggers（cap: 4）
  │     └─ background — cron, webhook, replay（cap: 2）
  │
  ├─ enqueue(entry: QueueEntry) → 根據 trigger.priority 分配 lane
  ├─ dequeue(lane?) → 取最高優先級 lane 的下一個 entry
  ├─ peek() → 查看各 lane 狀態
  └─ drain() → supervisor 呼叫，按 lane 優先級消費

QueueEntry
  ├─ trigger: RunTrigger（來自 Phase 5）
  ├─ sessionID: string
  ├─ lane: "critical" | "normal" | "background"
  ├─ enqueuedAt: number
  ├─ lease: { owner, expiresAt, retryAt }（保留現有 lease 機制）
  └─ failureState: { count, category, backoffUntil }（保留現有 failure classification）

LanePolicy
  ├─ concurrencyLimit: per-lane 最大同時執行數
  ├─ preemption: critical 可搶佔 background 的 slot
  └─ overflow: 超過 cap 時的行為（reject / wait / spill to next lane）
```

### 必須保留的機制

| 機制 | 現有位置 | 保留方式 |
|------|---------|---------|
| per-session 序列化 | `resumeInFlight` Set | QueueEntry 層級的 session lock |
| lease backpressure | `leaseOwner`, `leaseExpiresAt` | 移入 QueueEntry.lease |
| failure classification | `ResumeFailureCategory` 6 種 | 移入 QueueEntry.failureState |
| exponential backoff | `15s * 2^(step-1)`, max 5min | 保留公式，per-entry |
| kill-switch 檢查 | `assertSchedulingAllowed()` | dequeue 時檢查（非 enqueue 時） |

### 設計決定待定

| ID | 決定 | 選項 | 影響 |
|----|------|------|------|
| DD-7 | Queue persistence | 記憶體 vs Storage vs Redis | 重啟後 queue 是否保留 |
| DD-8 | Supervisor 架構 | 單一輪詢 vs per-lane consumer | 擴展性 |
| DD-9 | Preemption 策略 | hard preempt（kill background run）vs soft（等 slot 釋放） | 使用者體驗 |

---

## OpenClaw 參考對照

| OpenClaw 概念 | opencode 現狀 | Phase 5/6 目標 |
|--------------|--------------|---------------|
| 多源觸發（steer/followup/collect/interrupt） | 只有 continuation | RunTrigger 多型 |
| per-session lane + global lane | per-session 鎖，無 global lane | RunQueue 三道 lane |
| queue dedup + debounce | 無 | QueueEntry dedup（Phase 6） |
| queue-policy.ts resolveAction | planAutonomousNextAction() | TriggerEvaluator.evaluateGates() |
| agent-runner.ts | workflow-runner.ts | workflow-runner 改為 queue consumer |

---

## Stage 3 Design Decisions（D.1-D.3）

| ID | Decision | Resolution | Rationale |
|----|----------|------------|-----------|
| DD-7 | Isolated session key scheme | `cron:<jobId>:run:<uuid>` for isolated, `agent:<agentId>:main` for main | Matches OpenClaw convention (`refs/openclaw/src/cron/types.ts`). UUID per run ensures no session key collision. Key encodes both job identity and run uniqueness. |
| DD-8 | Cron job store location | `~/.config/opencode/cron/jobs.json` | Aligns with existing `Global.Path.user` convention (`~/.config/opencode/`). Single JSON file sufficient for expected job count (<100). Zod schema with CronJobState for persistence. |
| DD-9 | Heartbeat interval default | 30 minutes | Matches OpenClaw default. Configurable via agent config `heartbeat.every`. Balance between responsiveness (too short = token waste) and staleness (too long = missed events). |
| DD-10 | System event queue | In-memory FIFO, max 20 per session | Matches OpenClaw `system-events.ts` pattern. Events are transient notifications (not durable state). 20-event cap prevents unbounded memory growth. Drain on heartbeat clears queue. |
| DD-11 | Daemon restart strategy | Try full process respawn first, fallback to in-process restart with generation bump | Full respawn provides clean memory state. Fallback for environments where respawn is unavailable (`OPENCLAW_NO_RESPAWN`). Generation number invalidates stale task completions. |
| DD-12 | Command lane concurrency defaults | Main=1, Cron=1, Subagent=2, Nested=1 | Main=1 ensures single-threaded session execution (matches existing behavior). Cron=1 conservative default (can be raised). Subagent=2 allows parallel delegation. Nested=1 prevents recursive explosion. |

### Stage 3 Architecture Overview

```
                     ┌─────────────────────────────┐
                     │    Schedule Timer Runtime    │
                     │  (cron/at/every expressions) │
                     └────────────┬────────────────┘
                                  │
                     ┌────────────▼────────────────┐
                     │ A2: Schedule Trigger Eval    │
                     │  - Active hours gate         │
                     │  - System event queue        │
                     │  - HEARTBEAT_OK suppression  │
                     └──────┬──────────┬───────────┘
                            │          │
              ┌─────────────▼──┐  ┌────▼──────────────┐
              │ Main session   │  │ A1: Isolated Job   │
              │ (system event  │  │  - Scoped key      │
              │  injection)    │  │  - Light context   │
              └────────────────┘  │  - Delivery route  │
                                  │  - Retention prune │
                                  └───────┬───────────┘
                                          │
                     ┌────────────────────▼────────────────┐
                     │ A4: Command Lane Queue              │
                     │  Main(1) | Cron(1) | Sub(2) | Nest(1) │
                     │  - Drain guard                       │
                     │  - Generation tracking                │
                     └────────────────────┬────────────────┘
                                          │
                     ┌────────────────────▼────────────────┐
                     │ A3: Daemon Lifecycle                 │
                     │  - Gateway lock                      │
                     │  - SIGTERM/SIGINT → shutdown (5s)    │
                     │  - SIGUSR1 → drain (90s) → restart   │
                     │  - resetAllLanes + generation bump   │
                     └────────────────────┬────────────────┘
                                          │
                     ┌────────────────────▼────────────────┐
                     │ A5: Host Observability               │
                     │  - Session count, lane sizes          │
                     │  - Health probes, event bus           │
                     └─────────────────────────────────────┘
```

---

## Stage 5 Design: Tight Loop Continuation（實驗）

### 問題的真正根因（2026-03-20 架構反思）

Phase 0 至 Stage 4 建設了完整的控制面（kill-switch、lane queue、daemon lifecycle、workspace isolation），但核心痛點從未被解決：**agent 在有完整 plan 的情況下依然以回合制模式運行。**

根因分析：

```
LLM API 是 request-response → 每個 end_turn 就是一個回合結束
                                        │
                    opencode 在此處插入了極度昂貴的銜接路徑
                                        │
                    ┌───────────────────▼───────────────────┐
                    │  decideAutonomousContinuation()       │ 14 道確定性閘門
                    │  handleSmartRunnerStopDecision()      │ LLM 二次評估（又一次 API call）
                    │  enqueueAutonomousContinue()          │ 寫入 queue
                    │  supervisor 5s 掃描                    │ 延遲
                    │  新 runLoop() 完整重啟                  │ 重新序列化 messages
                    └───────────────────────────────────────┘
```

對比 OpenClaw (Claude Code)：

```
end_turn
  → 有 pending work?
  → 是 → synthetic continue → 同一個 while loop 裡 continue
  → 否 → 真的停
```

差距不在架構，在 **end_turn 和「繼續」之間的成本**。

### Plan-trusting Mode 為什麼不夠（Phase 5A 回顧）

Phase 5A 實作了 `isPlanTrusting()` 來跳過 Governor，但：

1. **門檻過高**：需要 `openspec_compiled_plan + implementation_spec + executionReady` 三條件同時滿足。實際使用中大部分 session 達不到。
2. **仍走 enqueue 路徑**：即使跳過 Governor，`end_turn` 後仍走 `enqueueAutonomousContinue()` → supervisor 5s 掃描 → 新 `runLoop()`。回合間延遲仍然存在。
3. **模型行為層未處理**：system prompt 沒有明確抑制模型的「匯報後停下」傾向（RLHF 副產品）。

### 設計目標

從「決策模型」轉為「排水模型」：end_turn 不是需要決策的事件，而是一個 turn 的正常完成。有 todo 就自動排水到下一輪，沒有 todo 就自然停。

### 設計方案（OpenClaw Drain 模型）

#### 核心原則

對照 OpenClaw 的 `finalizeWithFollowup()` 設計：

```
OpenClaw:
  每個 run 結束 → finalizeWithFollowup() → scheduleFollowupDrain()
  queue 有東西 → drain → 下一輪
  queue 空了 → 自然停
  沒有任何「要不要繼續」的判斷

opencode Stage 5:
  end_turn → hasPendingTodos?
  有 → 注入 synthetic continue → 回到 while loop 頂端
  沒有 → 正常退出
  不問「要不要繼續」，不走閘門，不走 Governor
```

差異：OpenClaw 用 async queue drain loop（因為它是多 session 併行的 gateway），opencode 用 while loop 內 inline continue（因為是單 session 執行）。效果相同：**end_turn 被當作正常完成，不是阻塞事件。**

#### 5.1 — Drain-on-Stop（核心修改）

```typescript
// prompt.ts — result === "stop" 分支
if (result === "stop") {
  // plan-trusting drain 路徑：end_turn = 正常完成，有 todo 就排水
  if (isPlanTrustingTight(session)) {
    const hardBlock = await checkHardBlockers(sessionID, abort)
    if (!hardBlock) {
      const nextTodo = await getNextActionableTodo(sessionID)
      if (nextTodo) {
        await injectSyntheticContinueInline(sessionID, lastUser, nextTodo)
        autonomousRounds++
        continue  // ← drain：回到 while(true) 頂端
      }
    }
    // hard blocker 或 no todo → 正常退出（等同 queue 排空）
  }

  // 非 plan-trusting → 走原有流程（保持向後相容）
  const decision = await decideAutonomousContinuation(...)
  ...
}
```

與之前 tight-loop-bypass 設計的區別：**先檢查 hard blocker，再找 todo。** 因為 drain 模型的語意是「只要沒有阻塞就排」，而不是「找到 todo 再決定要不要排」。順序反映了意圖差異。

#### 5.2 — Hard Blockers（排水閥門）

排水閥門不是「閘門」——不做決策，只做事實檢查：

| Blocker | 說明 | 對應 OpenClaw |
|---------|------|--------------|
| `abort_signal` | 使用者手動中斷 | signal handler |
| `kill_switch_active` | kill-switch 啟動 | gateway drain |
| `user_message_pending` | 使用者送入新訊息 | steer mode interrupt |
| `todo_complete` | 所有 todo 完成（隱含於 getNextActionableTodo 返回 null） | queue 空了 |

**不檢查的**（全部移除，不是「降級」）：
- `max_continuous_rounds` — drain 模型無回合概念
- Governor 所有決定 — drain 模型不做決策
- `spec_dirty` / `replan_required` — 信任 plan，模型自己會發現不對
- `mission_not_consumable` — mission 已 approve 就信任

#### 5.3 — 降低 Plan-Trusting 門檻

`isPlanTrustingTight()` 條件：

```typescript
function isPlanTrustingTight(session: Session.Info): boolean {
  return (
    session.workflow?.autonomous === true &&       // autonomous toggle 開啟
    session.mission?.executionReady === true &&     // mission 已 approve
    hasPendingTodos(session.id)                    // 有未完成的 todo
  )
  // 不要求 openspec_compiled_plan
  // 不要求 implementation_spec
  // 只要有 approved mission + pending todos 就信任
}
```

#### 設計原則：該停的要停，該跑的不要問

Tight loop 不是「無條件永遠 continue」。語意是：

- **有明確 plan + todo → 持續做，不要每一步都問**
- **todo 全部完成 → 停**
- **遇到 hard blocker → 停**
- **沒有 plan / 沒有 todo → 走原有回合制流程**

也就是說，tight loop 只在使用者已經透過 mission approval 表達了「去做」的意願後才啟用。這不是自動化，而是**執行已批准的計畫**。

#### 使用者介入性（Controllability）

Tight loop 必須是**可控的持續性**，不是放出去就收不回來的火箭：

1. **使用者插話優先** — 如果使用者在 tight loop 執行期間送入新 message，loop 必須在當前回合結束後優先處理使用者訊息，而不是繼續注入 synthetic continue。現有的 `shouldInterruptAutonomousRun()` 機制可以複用。
2. **Kill-switch 即時生效** — hard blocker 檢查包含 kill-switch，所以全域或 workspace 級別的緊急停止隨時可用。
3. **Abort signal** — 使用者可以隨時透過 UI 中斷（TUI Ctrl+C / Web cancel button），abort signal 在每個回合頂端被檢查。
4. **Plan 修改 = 自然停止** — 如果使用者修改了 plan / todos（透過插話或直接編輯），下一個回合的 `hasPendingTodos` 檢查會反映最新狀態。

類比：就像 Unix 的 background process — 它在背景持續跑，但你隨時可以 `fg` 拉回來、`Ctrl+C` 中斷、或 `kill` 停掉。持續性和可控性不矛盾。
```

#### 5.4 — Autonomous Execution Prompt（輔助，非核心）

OpenClaw 的 system prompt **不告訴模型要繼續**。自治性來自基礎設施（queue drain），不是模型指令。

但 opencode 的情境不同：OpenClaw 每次 drain 都是全新的 `runReplyAgent()` call，context 輕量。opencode 的 tight loop 是同一個 while loop 的 `continue`，context 累積。所以加一段 prompt 減少不必要的 end_turn 仍有價值——不是為了「讓模型繼續」（drain 會處理），而是為了**減少無效的 end_turn → drain → 重新 load context 的成本**。

```
You are in autonomous execution mode with an approved plan.
- Do NOT stop to summarize progress or ask for confirmation.
- Execute the next task by calling the appropriate tool immediately.
- Only produce end_turn when ALL tasks are complete or you hit an unrecoverable error.
- If you need to report progress, do it as a tool call (e.g. todo update), not as a text response.
```

注意：即使模型忽略這段 prompt 繼續 end_turn，drain 會在 <1s 內銜接，所以不是 blocker。

#### 5.5 — Inline Synthetic Continue（drain 機制）

對應 OpenClaw 的 `scheduleFollowupDrain()` + `runFollowupTurn()`。在 opencode 的 while loop 架構中，drain = 注入 synthetic user message 然後 `continue`：

```typescript
async function injectSyntheticContinueInline(
  sessionID: string,
  lastUser: MessageV2.User,
  nextTodo: Todo.Item
) {
  await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID,
    parentID: lastUser.id,
    content: `Continue with next task: ${nextTodo.text}`,
    synthetic: true,
    model: lastUser.model,
    format: lastUser.format,
  })
}
```

OpenClaw 的 drain 有 ~1s debounce（用於 batch 多個 message）。opencode 的 drain 是即時的（inline `continue`），因為 single-session 不需要 batching。

### 實驗驗證計畫

在 `exp/tight-loop-continuation` branch 驗證：

1. **基準測量**：用現有架構跑一個 5-task plan，記錄每個回合間的延遲
2. **實驗組**：套用 drain-on-stop，跑同一個 plan，記錄延遲
3. **觀察指標**：
   - 回合間延遲（目標：<1s vs 現有 5-10s）
   - 是否能跑完整個 plan 不中斷
   - hard blocker 是否正確攔截（kill-switch / abort / user message）
   - 模型 end_turn 頻率（prompt 有無影響）
   - 使用者中途插話時是否正確中斷 drain

### Critical Files（Stage 5）

**Modify:**
- `packages/opencode/src/session/prompt.ts` — tight loop bypass 插入點 (L1557)
- `packages/opencode/src/session/workflow-runner.ts` — `isPlanTrustingTight()` + `checkHardBlockers()`
- `packages/opencode/src/session/prompt/runner.txt` — autonomous execution prompt

**No new files needed.** 純粹是砍邏輯、降門檻。

### Design Decisions

| ID | Decision | Options | Status |
|----|----------|---------|--------|
| DD-20 | Tight loop bypass 位置 | (a) prompt.ts result==="stop" 分支前 (b) decideAutonomousContinuation 內部短路 | **resolved: (a)** — 在閘門之前攔截，避免走任何 gate evaluation |
| DD-21 | Synthetic continue 注入方式 | (a) 真的寫 user message 到 storage (b) 只在 memory 中注入不持久化 | pending — (a) 簡單但有 IO 成本，(b) 快但需改 message loading 邏輯 |
| DD-22 | Plan-trusting 門檻 | (a) 現有三條件 (b) autonomous + executionReady + hasTodos (c) 只要 autonomous + hasTodos | pending — 實驗階段先用 (b) |

---

## Risks

- ~~若 kill-switch UI 使用 SSE 推送，需先解決 ghost responses 的 SSE 問題~~ — Phase 2 已交付，SSE 穩定
- ~~Redis transport 需確認 multi-instance pub/sub 的 message ordering guarantee~~ — Phase 3 已交付
- ~~Trigger model extraction 若破壞現有 approved mission gate semantics~~ — Phase 5B 已交付，14 種 gate 語意不變
- ~~Phase 5 的 `planAutonomousNextAction()` 重構涉及 14 種判斷路徑~~ — Phase 5B 全覆蓋，83 tests
- ~~Phase 6 的 queue persistence 選擇影響重啟行為~~ — Phase 6 已交付，Storage-backed with legacy compat
- **D.3 signal handling (SIGUSR1)** — 需在 Linux/WSL 環境測試，in-process restart 不能破壞 HTTP server
- **D.3 command queue** — 新模組，需確認與現有 supervisor loop 的互斥性，避免 double-dispatch
- **D.1 session retention reaper** — 需確認不會誤刪 active cron run-sessions（race condition）
- **D.2 heartbeat stagger** — deterministic stagger 需 stable hash，確保重啟後同一 job 得到相同 offset
- **Stage 4 workspace resolution latency** — listBusySessionIDs now resolves workspace per session instead of simple string comparison. Mitigation: workspace registry is in-memory O(1) by directory
- **Stage 4 lazy workspace at boot** — daemon boot may not have resolved all workspaces yet. Mitigation: register default lanes; register workspace-specific lanes on first session arrival
- **Stage 4 channel data loss** — custom lane policies from channel store are lost. Mitigation: channel was barely used; defaults cover all cases
- **Stage 5 tight loop token burn** — 不經 Governor 檢查意味著模型可能在錯誤路徑上持續消耗 token 而不被攔截。Mitigation: hard blocker 仍含 abort signal，使用者可手動 kill；todo 完成度是客觀指標
- **Stage 5 message 堆積** — tight loop 每回合注入 synthetic message，長時間運行可能導致 context window 膨脹。Mitigation: 現有 compaction 機制仍然生效
- **Stage 5 model 行為不可控** — 即使 system prompt 說「不要停」，模型仍可能 end_turn。Mitigation: tight loop 在 end_turn 後立即銜接，所以 end_turn 的成本從 ~10s 降到 <1s

---

## Stage 4 Design: Channel-to-Workspace Refactor

### Architectural Pivot (2026-03-17)

Channel is a redundant abstraction layer that duplicates workspace's role as "runtime scope for sessions." Both are invisible to the user — there is no "enter channel" or "enter workspace" screen. The overlap creates unnecessary indirection.

Channel was introduced to provide lane isolation and kill-switch scoping per execution context. But workspace already provides execution context — it's auto-resolved from the directory, tracks all attachments, and has lifecycle management. The useful parts (lanePolicy, killSwitchScope) move to workspace. Channel module + API + UI plans (former Stages B/C/D) are cancelled.

User's words: "應該趁channel還沒有扮演很重角色的時候取消channel的設計，重新在workspace裏把需要的控制功能重構進去。首先，不要想太複雜。以後一個session就只會放一個auto runner做一件事。"

### Design Decisions

| ID | Decision | Resolution | Rationale |
|----|----------|------------|-----------|
| DD-13 | LanePolicy ownership | **Workspace** — lanePolicy moves from ChannelInfo to WorkspaceAggregate | Workspace is the natural owner — it represents the runtime scope where sessions execute |
| DD-14 | KillSwitchScope ownership | **Workspace** — killSwitchScope moves to WorkspaceAggregate, enum changes from "channel" to "workspace" | Consistent with DD-13 |
| DD-15 | Lane composite key namespace | **workspaceId** — `workspaceId:lane` replaces `channelId:lane` | Direct replacement, same namespacing role |
| DD-16 | Kill-switch session resolution | **Workspace registry lookup** — resolve workspace from session.directory instead of matching session.channelId | WorkspaceId is derivable from directory, no explicit field needed on Session.Info |
| DD-17 | Channel data migration | **Abandoned** — channel data at ~/.config/opencode/channels/ is not migrated | Channel was recently introduced and not widely configured; default lane policies cover all current use cases |
| DD-18 | Session.Info backward compat | **Zod strip** — channelId field ignored on persisted session read | WorkspaceId derived from directory, explicit channel/workspace ID on session is redundant |
| DD-19 | Daemon boot lane registration | **Workspace-based** — resolve workspaces for known project directories, register lanes per workspace, default lanes as fallback | Workspace resolution is lazy and deterministic; on-demand registration via Bus event for new workspaces |

### Architecture

```
Project → Workspace (auto-resolved from directory)
              │
              ├─ lanePolicy: { main: 1, cron: 1, subagent: 2, nested: 1 }
              ├─ killSwitchScope: "workspace" | "global"
              ├─ attachments: { sessionIds, ptyIds, workerIds, ... }
              └─ lifecycleState: active | archived | ...
                    │
                    ├─ Session (one auto runner doing one thing)
                    │     └─ directory → workspace resolution → workspaceId
                    │
                    ├─ Lanes: workspaceId:main, workspaceId:cron, ...
                    │
                    └─ KillSwitch: scope to workspaceId or global
```

### Critical Files (Stage 4)

**Modify:**
- `packages/opencode/src/project/workspace/types.ts` — schema extension
- `packages/opencode/src/project/workspace/resolver.ts` — default values
- `packages/opencode/src/daemon/lanes.ts` — channelId → workspaceId
- `packages/opencode/src/daemon/index.ts` — boot sequence
- `packages/opencode/src/server/killswitch/service.ts` — channelId → workspaceId
- `packages/opencode/src/server/routes/killswitch.ts` — workspaceId param
- `packages/opencode/src/session/index.ts` — remove channelId

**Delete:**
- `packages/opencode/src/channel/` — entire module
- Channel API routes and tests

### IDEF0/GRAFCET Impact

The B/C/D IDEF0 diagrams (A6-A8 and L2 decompositions) and GRAFCET diagrams are now **obsolete** — they describe channel-centric features that are cancelled. The A0 context diagram should be updated to remove A6-A8.

Affected diagrams in `diagrams/`:
- `opencode_a0_idef0.json` — remove A6-A8 and associated ICOM arrows
- `opencode_a6_*.json`, `opencode_a7_*.json`, `opencode_a8_*.json` — obsolete
- `opencode_a61_*.json`, `opencode_a71_*.json`, `opencode_a81_*.json` — obsolete
- `opencode_a0_grafcet.json` — remove S7-S9 steps
- `opencode_a6_grafcet.json`, `opencode_a7_grafcet.json`, `opencode_a8_grafcet.json` — obsolete
