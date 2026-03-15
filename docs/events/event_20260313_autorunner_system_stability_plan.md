# Event: autorunner system stability plan

Date: 2026-03-13
Status: Planning
Branch: autorunner
Workspace: /home/pkcs12/projects/opencode-runner

## 需求

- 為 autonomous runner / delegated subagent runtime 建立高優先的系統穩定性開發計畫。
- 不以「最小修正」為主要導向，而是從 system-level 提出長期可維護的架構改良方案。
- 聚焦以下主題：
  - unified syslog / observability service
  - workflow / task / todo / session state convergence
  - runtime supervision / daemon topology
  - operator-facing health / anomaly surfaces
  - phased migration roadmap

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/**`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/tool/task.ts`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/process/**`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/server/**`
- `/home/pkcs12/projects/opencode-runner/packages/app/src/pages/session/**`
- `/home/pkcs12/projects/opencode-runner/docs/ARCHITECTURE.md`
- `/home/pkcs12/projects/opencode-runner/docs/events/event_20260313_autorunner_system_stability_plan.md`

### OUT

- 本輪不直接提交 runtime 行為修補
- 本輪不直接實作 daemon split 或 workflow reducer
- 本輪不引入未經批准的 fallback mechanism
- 本輪以規劃、分層與 migration path 為主

## 任務清單

- [x] 重新確認 `docs/ARCHITECTURE.md`、`AGENTS.md`、Smart Runner / syslog 相關事件文件
- [x] 基於已知 RCA 收斂當前系統問題模型
- [x] 提出 unified syslog / observability service 方向
- [x] 提出 workflow convergence / canonical state reducer 方向
- [x] 提出 daemonized supervision topology 方向
- [x] 提出 operator health surface / anomaly model
- [x] 提出 phased roadmap 與 branch-level execution strategy

## Debug Checkpoints

### Baseline

- 已知近期實際症狀不是 generic web startup crash，而是 autonomous session 在 delegated subagent timeout/error 後，父 session 的 workflow / todo / monitor / UI 狀態未能一致收斂。
- 已有硬證據顯示：subagent task part 可進入 `error`，但 parent todo 仍停在 `in_progress + waitingOn=subagent`，使 workflow 持續被判為 `wait_subagent` 類語義。
- 現有系統雖已有多種 observability 元件，但仍屬分散式觀測：
  - debug logs
  - workflow fields
  - Smart Runner trace/history
  - Session monitor rows
  - UI side panel summary
- 問題不在單一 log 缺失，而在於：
  1. 缺少單一 system-level event journal
  2. 缺少 state convergence authority
  3. 缺少對 long-running autonomous / subagent lifecycle 的正式 supervisor topology

### Instrumentation Plan

- 本輪規劃文件不再追 symptom，而是針對架構缺口設計 system-level 改良面：
  1. **Observability plane**：事件如何被統一記錄、查詢、關聯
  2. **Control plane**：workflow / todo / task / worker 的 canonical 狀態由誰決定
  3. **Execution plane**：哪些 process 應留在 in-process，哪些應 daemonize
  4. **Operator plane**：UI / CLI 應看到什麼健康訊號，而非從碎片狀態自行猜測
  5. **Migration plane**：如何分 phase 導入，避免一次性高風險重構

### Execution

## 問題模型（Problem Frame）

目前 autonomous runner 的脆弱點可分為四層：

1. **Event fragmentation**
   - task timeout、todo waiting、workflow stop reason、session monitor、UI working state 各自存在，但缺少共用事件流。
2. **State convergence ambiguity**
   - 多個模組都能局部決定狀態，卻沒有單一 reducer 收斂成 canonical truth。
3. **Lifecycle supervision weakness**
   - delegated subagent / worker lifecycle 主要仍由 prompt/runtime in-process 路徑承擔，缺少獨立監理與 orphan recovery。
4. **Operator perception gap**
   - UI 往往從多個 partial signals 拼湊系統現況，容易把「degraded / stuck / unreconciled」感知成「offline」。

## 架構主張

### 1. Unified System Journal / Syslog Service（建議最高優先）

將目前零散的 log / trace / history 升級為統一的 structured event journal service。

#### 建議模組

- `packages/opencode/src/system/runtime-event-service.ts`
- 或 `packages/opencode/src/system/system-journal.ts`

#### 設計目標

- 成為 session / workflow / task / worker / daemon / websync 的共用事件管道
- 讓 runtime 與 operator 可以回答「發生了什麼、誰影響了誰、哪裡沒有收斂」
- 不只是文字 log，而是可 query、可 correlation、可 anomaly detect 的 event stream

#### 建議事件欄位

```json
{
  "ts": 0,
  "level": "debug|info|warn|error",
  "domain": "session|workflow|task|todo|worker|daemon|websync|governor",
  "eventType": "task.timeout",
  "sessionID": "...",
  "parentSessionID": "...",
  "subSessionID": "...",
  "messageID": "...",
  "partID": "...",
  "todoID": "...",
  "runID": "...",
  "workerID": "...",
  "correlationID": "...",
  "payload": {},
  "anomalyFlags": []
}
```

#### 必收錄事件族群

- session lifecycle
- workflow transition
- todo transition
- task / subagent delegation lifecycle
- worker spawn / heartbeat / timeout / cancel / reap
- supervisor lease / resume / retry / failure
- governor advisory / host adoption / refusal
- web sync / SSE stale / forced hydration
- daemon route / health / unavailable

### 2. Workflow Convergence Engine（Canonical State Reducer）

不再讓 `task.ts`、`todo.ts`、`workflow-runner.ts`、monitor/UI 各自持有局部真相，而是建立單一 convergence layer。

#### 建議模組

- `packages/opencode/src/session/workflow-state-reducer.ts`
- 或 `packages/opencode/src/session/runtime-coordinator.ts`

#### 設計原則

- raw facts 與 derived states 分離
- 每個 event 先進 journal，再交由 reducer 產生 canonical state
- UI / monitor / session API 盡量讀 canonical derived view，而不是自行拼裝

#### 可能的 canonical state slices

- `workflow.lifecycleState`
  - `idle | running | waiting_user | blocked | completed | degraded`
- `workflow.executionState`
  - `healthy | waiting_subagent | unreconciled_error | resuming | stuck`
- `workflow.operatorState`
  - `safe_to_continue | human_decision_needed | approval_needed | degraded_needs_review`

#### 關鍵規則

- task part `error` + no active worker + todo waitingOn=subagent => 不能繼續被視為正常等待；應收斂成可觀測 anomaly / degraded state
- workflow 是否 `running`，不能只看 todo waitingOn，也要看 worker registry / active leases / last transition evidence

### 3. Daemonized Supervision Topology（分層 daemonize，而非一次拆全系統）

本計畫不建議把所有 runtime 一次性 daemonize；應只把長生命週期、可孤兒化、需要恢復的部位拆成正式受監理層。

#### 建議拓撲

1. **Gateway / Web API Layer**
   - 處理 auth、HTTP、UI routing、session query surfaces
   - 不直接承擔 long-running autonomous orchestration 真相

2. **Session Runtime Daemon**
   - 管 autonomous continuation queue
   - 管 workflow leases / resume policy
   - 持有 per-session runtime coordinator

3. **Worker Supervisor / Subagent Manager**
   - 管 subagent worker spawn / heartbeat / timeout / cancellation / orphan cleanup
   - 與 task tool part 分離：tool part 是觀測結果，不是 worker 存活真相

4. **System Journal Service**
   - 負責事件持久化、查詢、最近事件窗口、anomaly feed

#### 原則

- 先 daemonize：autonomous supervisor、subagent worker manager、journal collector
- 先不 daemonize：普通同步 user turn、簡短工具執行、純 UI hydration

### 4. Operator Health Surface（不要再讓 UI 猜系統狀態）

UI/CLI 應改讀後端輸出的 derived health view，而不是從多個零碎訊號推論。

#### 建議新增 runtime health view

```json
{
  "runtimeState": "alive|degraded|unavailable",
  "workflowState": "running|waiting_user|blocked|completed|degraded",
  "workerState": "healthy|waiting|timed_out|orphaned|unreconciled",
  "syncState": "connected|stale|recovering",
  "lastAnomaly": "task_error_todo_waiting_subagent",
  "operatorHint": "Parent workflow is still waiting on a timed-out subagent"
}
```

#### 使用面

- session side panel
- CLI inspect / debug view
- server health/admin diagnostics
- automated recovery policies（後續）

### 5. Anomaly Contract（把脆弱點正式產品化）

#### A. State mismatch anomalies

- task part = `error` 但 todo 仍 `waitingOn=subagent`
- workflow stop reason = `wait_subagent` 但 active worker count = 0
- session.status = `busy/working` 但 supervisor 無 lease / 無 running worker

#### B. Lifecycle anomalies

- child session terminal 但 parent workflow 未收斂
- parent cancelled 但 worker 仍存活
- worker timeout 但 queue lease 未回收

#### C. Perception anomalies

- backend alive 但 session sync 長期 stale
- SSE disconnected 且 force hydration 無法更新狀態
- operator-facing state 顯示 `running`，但底層已無任何可進展 execution

### 6. 與 Smart Runner 的關係

Smart Runner 不應成為解這類穩定性問題的主力，而應建立在更強的 system substrate 上。

#### 原則

- Smart Runner trace 應視為 journal 的一個 domain，而不是 observability 主體
- host adoption / refusal / question / replan 事件都應進入統一 journal
- governor 只參與 advisory / bounded decision，不持有 worker truth、queue truth、orchestration truth

### 7. Branch-level execution strategy

因為這是高風險穩定性計畫，獨立 branch `autorunner` 是合理的。

#### 建議在本 branch 的工作方式

- 先完成 planning / doc / interfaces
- 再做 dry-run observability slice
- 再做 reducer / supervisor refactor
- 最後才考慮 daemon split / operator health API 對外穩定化

#### 不建議一開始就做的事

- 直接把所有 session runtime 重寫成 daemon mesh
- 直接用 fallback 掩蓋 unreconciled states
- 讓 UI 先 patch 顯示文案而不處理 canonical state source

## Phase Roadmap

### Phase 0 — Planning / contracts（本輪）

- 完成 system-level planning doc
- 定義 event schema、reducer responsibilities、daemon topology、anomaly matrix
- 確認 branch-level execution strategy

### Phase 1 — Journal first

- 導入 unified system journal / event bus contract
- 加入 correlation IDs / run IDs / worker IDs
- 先做 dry-run capture，不改現有控制流

### Phase 2 — Convergence layer

- 導入 workflow state reducer / runtime coordinator
- 將 task/todo/workflow 收斂邏輯集中化
- 建立 canonical derived health view

### Phase 3 — Supervisor hardening

- 建立 subagent worker registry + heartbeat + timeout cleanup
- 明確 lease / orphan / recovery contract
- 讓 wait_subagent 不再只依賴 todo metadata

### Phase 4 — Daemon split

- 拆出 autonomous session runtime daemon 與 worker manager
- gateway 只保留 API / auth / routing
- journal/health query surfaces 對外穩定化

### Phase 5 — Operator surfaces

- session side panel / CLI inspect / admin view 讀 derived health state
- 提供 anomaly timeline / recent event window / operator hints

## Smart Runner project 歷史回顧與未完成項目

### 已完成的部分（從歷史規劃到現況）

根據 `smart runner project` 與 `autonomous session workflow design` 歷史，前一版 autonomous / Smart Runner 已經完成大量 groundwork：

1. **Autonomous workflow metadata 與狀態機**
   - session 已持久化 `workflow.autonomous`、`workflow.state`、`stopReason`、`lastRunAt` 等欄位
2. **In-process auto-continue skeleton**
   - assistant 回合結束後可依 todo / policy 自動插入 synthetic continue turn
3. **Durable pending continuation foundation**
   - pending continuation 已可寫入 storage，具備最小 resume 基礎
4. **In-process supervisor foundation**
   - server runtime 啟動後可掃描 pending continuation 並重新進入 session loop
5. **Planner / todo / action metadata path**
   - 已開始從 freeform todo 升級到 structured action metadata、dependency、auto-advance
6. **Smart Runner governor / bounded assist / host adoption**
   - 已建立 advisory trace、assist、ask-user/replan/approval/risk pause/complete proposal 與部分 host adoption path
7. **Operator-facing observability**
   - sidebar / monitor / history / narration / AI layer summary 已補了大量可視化

### 尚未完成、且正是 daemon 化卡住的部分

1. **Continuation 仍是 synthetic conversation turn 驅動**
   - 系統雖已能自動續跑，但本質仍是在 prompt loop 內「再塞一則 synthetic user message」來推動下一回合
   - 這代表 orchestration DNA 仍是 conversation-turn centric，而不是 job/daemon centric
2. **Supervisor 仍是 in-process interval，不是正式 daemon**
   - 目前 resume supervisor 仍附著在 server process 內
   - 缺少獨立 process boundary、worker registry、跨 process lease 與更強恢復語義
3. **Worker truth 仍混在 task/tool/message surface 中**
   - subagent timeout、task part state、todo waiting、workflow stop reason 尚未由獨立 worker supervisor 收斂
4. **State convergence authority 尚未建立**
   - 雖已有 planner、host adoption、workflow metadata，但沒有單一 reducer/coordinator 統一收斂 canonical state
5. **Scheduler fairness / budget / retry 雖已有基礎，但仍是 runtime-local**
   - 還不是 24x7 daemon service 的正式資源仲裁層
6. **Smart Runner 已有大量治理邏輯，但仍寄生在 prompt-turn life cycle 上**
   - 這讓它更像「對話迴圈上的高階主持插件」，而不是真正 session daemon 的治理腦

### 關鍵判斷

前一版 autonomous runner 之所以一直改不掉「對話回合制 DNA」，不是因為實作不夠多，而是因為其核心驅動單位仍是：

- prompt loop
- synthetic user continuation
- assistant turn completion hooks

也就是說，**目前系統把 autonomous 視為 conversation loop 的延伸模式，而不是把 session 視為可長時間存活、可被守護、可被恢復的 daemonized job**。

因此，若目標是「24x7 在線控制 session、代理使用者持續驅動既定計畫」，單純再強化現有 loop/planner/governor，邊際效益會越來越低；必須提升到 daemon architecture。

### 可行性評估

**做得到，但屬於可分期重構，不適合一次翻修。**

原因：

1. **已具備可遷移的基礎件**
   - workflow metadata
   - durable pending continuation
   - planner/action metadata
   - supervisor lease / retry / blocker taxonomy
   - Smart Runner advisory/host-adoption contract
   - operator observability surfaces
2. **真正缺的是 execution substrate，而不是 planning intelligence**
   - 缺的是 daemonized runtime / worker supervision / canonical state convergence
   - 不是再多加幾條 prompt 或再多寫幾個 governor proposal
3. **現有實作可以視為 daemon rewrite 的 Phase 0~1 資產**
   - 不需要全部推倒重來
   - 但需要改變 primary execution model

### 重構可行，但需接受的架構轉向

若要真正 daemon 化，建議把系統主語從：

- 「一個 session 由對話回合驅動」

轉成：

- 「一個 session 是長壽命 job / actor，由 daemon 負責推進；conversation turn 只是它的一種 I/O 事件」

這是可行的，但代表：

1. prompt loop 不再是最高權威
2. synthetic user turn 不再是主要 continuation primitive
3. session 需要有 daemon-owned lifecycle / lease / heartbeat / checkpoint
4. task/subagent 需要有獨立 worker truth
5. UI 讀的是 job/session health，而不只是 message timeline

### 建議的重構結論

- **可重構成 daemon-based autorunner**：是
- **能否保留現有大量程式資產**：大部分可以，尤其是 workflow metadata、planner、Smart Runner governance、UI observability
- **最大重構點**：從 conversation-driven continuation 改成 daemon-driven session execution
- **最大風險**：同時維持舊 prompt-loop 語義與新 daemon 語義，容易形成雙主控 source-of-truth
- **建議策略**：先建立 daemon substrate，再逐步讓 prompt loop 降級為 daemon 的一個 execution adapter，而不是繼續當主體

### 外部參考補充

- 已加入 `/home/pkcs12/projects/opencode-runner/refs/clawbot/` 作為 autorunner 實作參考：
  - `clawbot_system_architecture.md`
  - `opencode_autorunner_mapping.md`
- 其核心參考價值在於：
  - 將 autonomy 視為 durable workflow，而不是 prompt wrapper
  - 強調 orchestrator/control plane 與 LLM 的責任切分
  - 強調 observability 與 recoverability 必須是架構核心
- 採納策略：只引用其 system-level 拓撲思路，不直接照搬 fallback-heavy 恢復策略；仍遵守本 repo fail-fast / no silent fallback 原則。

### 建議下一階段

在 `autorunner` branch 的下一份正式 design doc 中，應明確回答：

1. Session daemon 的 canonical lifecycle state machine
2. prompt loop 與 daemon coordinator 的權責切線
3. durable queue / lease / heartbeat / checkpoint model
4. subagent worker supervisor 與 task tool state 的雙層模型
5. conversation event 如何降級為 daemon input/output，而不是主驅動器

### Root Cause（planning-level）

- 真正的根因不是單一 timeout bug，而是：
  1. autonomous runtime 尚未被設計成正式的 supervised subsystem
  2. event/log/trace 無統一 journal
  3. state transitions 缺少單一 convergence authority
  4. operator surface 缺少 canonical health view
- 因此任何單點修補都只能降低一個 symptom，不能根治同類故障。

## Validation

- 已重新讀取：
  - `docs/ARCHITECTURE.md`
  - `AGENTS.md`
  - `docs/events/event_20260310_smart_runner_governor_design.md`
  - `docs/events/event_20260310_syslog_debug_contract.md`
- planner reactivation 已完成的最小可見切片：
  - `packages/opencode/src/tool/registry.ts`
    - 將 `plan_enter` / `plan_exit` 從「experimental + cli only」放寬為所有互動型 client（`app` / `cli` / `desktop`）可註冊
    - 目的：恢復既有 plan-mode runtime 入口的可達性，讓 planning path 有機會在一般 session 中被喚醒
  - `packages/opencode/test/tool/registry.test.ts`
    - 新增 regression test，驗證非 CLI 互動 client 也能拿到 `plan_enter` / `plan_exit`
  - `packages/opencode/src/session/system.ts`
    - 將 planning-first flow 正式寫入主系統工具/工作規則，明確指示非瑣碎 multi-step dev / autonomous / architecture-sensitive work 優先使用 `plan_enter()`
  - `packages/opencode/src/session/prompt/claude.txt`
  - `packages/opencode/src/session/prompt/anthropic-20250930.txt`
    - 補強主代理執行指令：對非瑣碎開發/自治需求，優先先進 planning-first flow，而不是直接實作
  - `packages/opencode/src/session/prompt/plan.txt`
  - `packages/opencode/src/session/prompt/plan-reminder-anthropic.txt`
  - `packages/opencode/src/session/reminders.ts`
    - 將 plan mode 的任務目標升級為：產出「可供後續 AI 自動執行全套流程」的 planner artifact set
    - 明確要求 planner workspace 以 `implementation-spec.md` 為主軸，並同步維護 `proposal.md` / `spec.md` / `design.md` / `tasks.md` / `handoff.md`
  - `packages/opencode/src/session/prompt.ts`
    - 新增最小 auto-plan heuristic：當使用者未明確指定 agent、且請求呈現 non-trivial 多步驟開發/自治/架構關鍵字與足夠描述長度時，主流程自動改走 `plan` agent
    - 目的：讓 planner 不只是「工具存在」，而是真正在一般互動 session 中被主動喚醒
  - `packages/opencode/src/session/index.ts`
    - 將 planner 基地從舊的 `.opencode/plans/*.md` 遷移為 repo-native `specs/<change-slug>/implementation-spec.md`
    - 新增 `Session.planRoot()`，讓 planner 可以圍繞同一個 change root 維護多檔 artifact
    - 目的：讓 planner 的產物正式落在 repo spec substrate，而不是暫時性工作檔
  - `packages/opencode/src/tool/plan.ts`
    - 升級 `plan_exit` 的 synthetic build handoff text 與 metadata
    - handoff 現在明示 build agent：plan file 是 implementation specification，先讀規格、轉成 structured todos/action metadata，再開始執行
    - 新增最小 plan materializer：會從 plan file 的 `## Structured Execution Phases` / `## Execution Phases` / `## Handoff` / `## Scope` / `## Validation` 抽取內容，直接建立 runtime todo graph
    - 新增 fixed structured-spec template：`plan_enter` 若發現 plan file 不存在，會直接建立標準模板
    - 新增 artifact bootstrap：`plan_enter` 現在會同時建立 `proposal.md` / `spec.md` / `design.md` / `tasks.md` / `handoff.md`
    - 新增 artifact aggregation：`plan_exit` handoff metadata 會回報多檔 artifact 路徑與缺漏的必填章節
  - `packages/opencode/test/session/planner-reactivation.test.ts`
    - 新增 regression tests：
      - 驗證 planner spec path 會落在 `repo/specs/.../implementation-spec.md`
      - 驗證 `plan_enter` 會在缺檔時建立 structured spec template
      - 驗證 `plan_enter` 會同時建立 `proposal/spec/design/tasks/handoff` 五檔 artifact
      - 驗證 non-trivial request 會自動切到 `plan` agent
      - 驗證 `plan_exit` 會注入 structured handoff metadata
      - 驗證 `plan_exit` 會把 plan spec materialize 成 session todos
      - 驗證 handoff metadata 會回報缺漏的必填章節與 artifact paths
  - `packages/opencode/src/session/todo.test.ts`
    - 既有 todo metadata / reconcile tests 持續作為 planner handoff materialization 的保護網
- 驗證結果：
  - `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/test/tool/registry.test.ts"` ✅
  - `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/test/session/planner-reactivation.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/tool/registry.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/todo.test.ts"` ✅
  - 最新回歸補強：
    - `planner-reactivation.test.ts` 新增「status-only 不自動切 plan agent」負向測試 ✅
    - `planner-reactivation.test.ts` 新增 `plan_exit` schema gate（Scope 必須含 `### IN/OUT`）測試 ✅
    - `planner-reactivation.test.ts` 新增 `tasks.md` placeholder/不可執行 gate 測試 ✅
    - `planner-reactivation.test.ts` 新增 companion artifacts incomplete gate（proposal/spec/design/handoff 缺必填章節時 fail-fast）✅
    - `planner-reactivation.test.ts` 加入 session-aware pending-question polling，消除 multi-file targeted run 的 flaky race ✅
  - `packages/opencode/src/tool/plan.ts` 本輪已補強為 OpenSpec-grade planner contract：
    - `proposal.md` 強制包含 `Why / What Changes / Capabilities / Impact`
    - `spec.md` 強制包含 `Purpose / Requirements / Acceptance Checks`，且至少 1 個 `Requirement` + `Scenario`
    - `design.md` 強制包含 `Context / Goals / Non-Goals / Decisions / Risks / Critical Files`
    - `handoff.md` 強制包含 `Execution Contract / Required Reads / Stop Gates In Force / Execution-Ready Checklist`
    - `plan_exit` handoff metadata 現在會攜帶 `artifactIssues` 與 `executionReady`，供 runner 明確判斷是否能安全接手
    - `plan_exit` handoff metadata 現在也會攜帶 `clarificationMapping`，將 scope / validation / stop gates / delegation / risk posture / decisions 對應到具體 artifact 欄位，讓「問題答案已沉澱到哪裡」成為 runtime-visible contract，而不只是 prompt discipline
  - 已新增方法論文件：`/home/pkcs12/projects/opencode-runner/docs/specs/planner_spec_methodology.md`
  - planner 現在已從單檔 `implementation-spec.md` 進一步升級為以 `implementation-spec.md` 為主軸、並帶有 `proposal/spec/design/tasks/handoff` companion artifacts 的 repo-native specs base
  - 已重新讀回 `plan.txt` / `plan-reminder-anthropic.txt` / `reminders.ts`，確認 planner prompt 已正式反映 multi-artifact workflow，而不是只維護單一 plan file
- 本輪仍未：
  - 新增 fallback mechanism
  - 實作 daemon/process 重構
  - 讓 planner 更積極把對話內容分流寫進 `proposal.md` / `spec.md` / `design.md` / `tasks.md` / `handoff.md`，而不只是先建立模板與提醒保持一致
  - 將 current markdown-template parser 升級為更嚴格的 machine schema（例如 frontmatter / JSON sidecar / schema validation）
  - 將 clarification round 的答案從 metadata mapping 再提升為 planner runtime 直接回填/維護 artifact 欄位（目前已能 runtime-visible 對映，但尚未自動寫回）

## Architecture Sync

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪改動聚焦 planner artifact contract 強化（OpenSpec-style companion artifact gates、handoff metadata、測試穩定性修正），未新增/改寫長期模組邊界、資料流拓撲或 session/daemon architecture contract；`docs/ARCHITECTURE.md` 既有對 session workflow / prompt runtime / per-user daemon 邊界描述仍成立。

## Next Step Proposal

1. 已新增正式 design doc：
   - `/home/pkcs12/projects/opencode-runner/docs/specs/autorunner_daemon_architecture.md`
2. 已新增 planning revival spec：
   - `/home/pkcs12/projects/opencode-runner/docs/specs/planning_agent_revival.md`
3. 近期優先順序建議改為：
   - 先恢復 planning agent / question-driven clarification contract
   - 再把 planning output 直接 handoff 到 continuous work mode
   - 最後才逐步導入 daemon substrate implementation specs
4. daemon implementation specs 仍建議後續拆成：
   - `runtime_event_journal.md`
   - `workflow_state_reducer.md`
   - `session_daemon_lease_model.md`
   - `worker_supervisor_registry.md`
5. 已新增 planning question contract：
   - `/home/pkcs12/projects/opencode-runner/docs/specs/planning_agent_question_contract.md`
6. 已新增 planning runtime reactivation spec：
   - `/home/pkcs12/projects/opencode-runner/docs/specs/planning_agent_runtime_reactivation.md`
7. 若要進入實作，最小產品可見切片建議是：
   - 讓 non-trivial autonomous/dev request 預設先進 planning mode
   - 用既有 `plan_enter / plan_exit / plan reminder` runtime 基礎重新喚醒 planning path
   - 每輪先問 1–3 個高影響 MCP `question`
   - 產出 structured draft plan + handoff package
   - 確認 planning-complete 後 handoff 到 continuous work mode
