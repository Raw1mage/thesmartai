# Event: autorunner autonomous agent completion

Date: 2026-03-13
Status: Completed
Branch: autorunner
Workspace: /home/pkcs12/projects/opencode-runner

## 需求

- 以 `/home/pkcs12/projects/opencode-runner` 的 `autorunner` branch 為主戰場，將 autonomous agent / autorunner 的核心開發推進到可用完成態。
- 本輪完成後，需評估並規劃如何把 runner 上成熟的變更同步/併回 `cms` branch。
- 不接受只停留在抽象規劃；需要從既有 planner revival + daemon architecture 規劃，收斂出可落地、可驗證的實作切片。
- 使用者提出兩個架構想法，但明確要求先做可行性分析，不能直接升格成正式規格：
  - 24x7 daemon，讓 runner 可持續背景工作，而 TUI / WebApp 能自由 detach / attach，不受網路影響
  - 同一個 opencode runtime 同時提供 TUI 與 Web access，可視為 multi-access server 架構的可能前導型態
- 使用者新增 workflow 規範：往後只要是有明確選項的選擇題，預設都要用 MCP `question` 呈現。
- 使用者已進一步定義 runner 的第一個真實用例：runner 只能執行**已批准且已完整編譯的 OpenSpec 計畫文件**；第一個具體實例就是執行 repo `/specs` 內的開發計畫，並代替人類委派各種 agents 持續推進。

## 範圍 (IN / OUT)

### IN

- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/**`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/tool/**`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/process/**`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/src/server/**`
- `/home/pkcs12/projects/opencode-runner/packages/opencode/test/**`
- `/home/pkcs12/projects/opencode-runner/docs/specs/planning_agent_*.md`
- `/home/pkcs12/projects/opencode-runner/docs/specs/autorunner_daemon_architecture.md`
- `/home/pkcs12/projects/opencode-runner/docs/events/event_20260313_autorunner_autonomous_agent_completion.md`

### OUT

- 直接在本輪改動 cms branch
- 未經驗證的大範圍 daemon mesh 一次性翻修
- 未經批准的新 fallback mechanism
- push / PR

## 任務清單

- [x] 確認本輪工作目標切回 runner repo `autorunner` branch
- [x] 重新讀取 architecture / event / specs，建立本輪 event ledger
- [x] 盤點 current autorunner substrate 與缺口（journal / reducer / lease / worker truth / planning handoff）
- [x] 以 runner-local OpenSpec artifact set 固化本輪規格（implementation-spec/proposal/spec/design/tasks/handoff）
- [x] 選定第一個最小可見且可驗證的實作切片
- [x] 完成切片實作與對應測試
- [x] 更新 event validation 與 architecture sync
- [x] 定義後續同步回 cms 的策略與 gate

## Debug Checkpoints

### Baseline

- runner 端已具備 planner reactivation / OpenSpec-grade artifact contract，planning path 已恢復基本可達性。
- 但 autorunner 的核心 execution substrate 仍停留在 conversation-turn centric：prompt loop / synthetic continue / in-process supervisor 仍是主軸。
- 既有 planning 文檔已清楚指出缺口：缺少 unified runtime event journal、canonical reducer、daemon-owned lease/heartbeat、以及 worker-supervisor truth。
- 上述方向目前仍屬 hypothesis；是否納入正式 implementation roadmap，需以本輪可行性分析結果決定。

### Instrumentation Plan

- 先以 search-then-read 方式盤點 runner 端目前與 autonomous progression 直接相關的 runtime 模組。
- 針對第一個切片，明確記錄：
  1. 目前真相來源在哪裡
  2. 哪些狀態仍是分散式推導
  3. 要新增的最小 event / reducer / observability 契約是什麼
- 驗證以 targeted tests 為主，必要時補最小 integration-style regression test。

### Execution

- 使用者明確指出本輪應先用剛建立的 OpenSpec/planner 機制，把 runner/autorunner 的規格書寫清楚，再進入實作。
- 因此前一輪「直接往 runtime 模組收斂第一刀」已被中止，改回規格先行。
- 已在 runner repo 建立 change unit：
  - `/home/pkcs12/projects/opencode-runner/specs/changes/autorunner-autonomous-agent-substrate/implementation-spec.md`
  - `/home/pkcs12/projects/opencode-runner/specs/changes/autorunner-autonomous-agent-substrate/proposal.md`
  - `/home/pkcs12/projects/opencode-runner/specs/changes/autorunner-autonomous-agent-substrate/spec.md`
  - `/home/pkcs12/projects/opencode-runner/specs/changes/autorunner-autonomous-agent-substrate/design.md`
  - `/home/pkcs12/projects/opencode-runner/specs/changes/autorunner-autonomous-agent-substrate/tasks.md`
  - `/home/pkcs12/projects/opencode-runner/specs/changes/autorunner-autonomous-agent-substrate/handoff.md`
- 目前已將本輪第一個可落地切片正式收斂為：
  - runner authority 只來自 approved OpenSpec compiled plans
  - `/specs` 開發計畫作為第一個 mission contract
  - runtime event journal baseline
  - stale `wait_subagent` mismatch anomaly capture
  - fail-fast / no-silent-fallback evidence path
- 另依使用者新要求，已更新 planning workflow 規範：choice-shaped 問題預設使用 MCP `question`，並同步到 project/template AGENTS 與 planning question contract。
- 本輪已完成第一個真正的 runner authority baseline implementation：
  - `Session.Info` 新增 canonical `mission` contract
  - `plan_exit` 在 planner artifacts 完整且使用者批准後，會把 approved OpenSpec compiled plan 寫入 session mission
  - `workflow-runner` 現在要求 session 必須帶有 `openspec_compiled_plan + implementation_spec + executionReady=true` 的 mission contract，否則 autonomous runner 不得續跑
  - 這讓 runner 的自主權第一次真正從「模糊對話 / synthetic continue」收斂到「已批准的 OpenSpec 計畫契約」
- 本輪進一步完成 mission-driven execution baseline：
  - autonomous synthetic continuation (`enqueueAutonomousContinue`) 會附帶 mission metadata（source/contract/planPath/artifacts）
  - `prompt.ts` 現在會對 `mission_not_approved` 做正式 workflow stop state（`waiting_user` + `stopReason=mission_not_approved`）
  - 新增測試保護 mission metadata 注入與 `mission_not_approved` narration
- 本輪亦完成 runtime event service baseline：
  - 新增 `packages/opencode/src/system/runtime-event-service.ts`
  - 第一版 schema 已固定包含 `ts/level/domain/eventType/sessionID/todoID?/anomalyFlags[]/payload`
  - 提供 session-scoped `append/list(limit)/clear` 最小 API
  - 已以獨立測試驗證 persistence 與 recent-event limit 行為
- 本輪再完成 stale `wait_subagent` mismatch anomaly integration：
  - 新增 `detectWaitSubagentMismatch(...)` helper
  - `decideAutonomousContinuation(...)` 在命中 `wait_subagent` 且 `activeSubtasks===0` 時，會寫入 `workflow.unreconciled_wait_subagent` anomaly event
  - anomaly payload 會保留 waiting todo ids / contents 與 activeSubtasks 證據
  - 保持 fail-fast / explicit evidence，沒有新增 fallback 掩蓋狀態

### Root Cause

- 目前規劃層 root cause 已可先確立：
  1. autorunner 的 execution substrate 仍是 conversation-turn centric
  2. delegated subagent 相關真相分散於 todo / workflow / process / message surfaces
  3. 缺乏統一 event journal，導致 stale `wait_subagent` 類 mismatch 難以被 runtime 明確表述
  4. 若不先建立規格與 evidence substrate，就會在 reducer / daemon refactor 前失去邊界控制
  5. 在本輪實作前，runner 甚至沒有 canonical mission authority；autonomous work 只知道「還有 todo 可以做」，卻不知道「自己是否真的被正式授權去做這份 spec work」

### Validation

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/system/runtime-event-service.test.ts"`
- 結果：2 pass / 0 fail ✅
- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- 結果：33 pass / 0 fail ✅
- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/system/runtime-event-service.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/index.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/session/planner-reactivation.test.ts"`
- 結果：16 pass / 0 fail ✅
- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/todo.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- 結果：44 pass / 0 fail ✅
- 驗證覆蓋：
  - approved mission contract 可以寫入 / 清除 session
  - `plan_exit` 會把完整 OpenSpec handoff 寫成 session mission
  - autonomous runner 在沒有 approved mission contract 時會 fail-fast 停下
  - autonomous runner 在有 approved mission contract 時才允許繼續推進 todo
  - autonomous synthetic continuation 會攜帶 mission metadata，讓後續執行鏈路可追溯到 approved OpenSpec plan
  - runtime event service 可持久化 session-scoped structured events，並支援 recent-event 視圖
  - `wait_subagent` stale mismatch 會留下 `workflow.unreconciled_wait_subagent` anomaly event，而不是靜默停在舊狀態
  - `Todo.reconcileProgress(... taskStatus: "error")` → `waitingOn=subagent` → `decideAutonomousContinuation()` → `workflow.unreconciled_wait_subagent` 的 regression chain 已被測試覆蓋

## Architecture Sync

- Architecture Sync: Updated ✅
- 比對結論：本輪已新增長期 runtime contract，必須同步 `docs/ARCHITECTURE.md`：
  - `session.mission`：session-local runner authority boundary
  - `runtime-event-service`：session-scoped structured runtime evidence substrate
  - `mission_not_approved`：autonomous continuation 的正式 stop reason
  - `workflow.unreconciled_wait_subagent`：第一個 anomaly evidence contract

## Next Phases / cms Sync Gate

### Next Phases

1. health / queue / anomaly surface convergence
   - 逐步把 queue ownership、health summary、anomaly evidence 收斂到同一個 runner truth surface。
2. delegated orchestration extension（new slice）
   - 在既有 delegated execution baseline 之上，才評估是否擴張為完整 task-tool delegation/worker orchestration。

### cms Sync Gate

- 目前先**不要**把這批 runner-only substrate 直接同步回 cms。
- Gate：已完成 mission authority + mission consumption + delegated execution baseline（含對應 validation）後，才評估是否將 `session.mission` / event journal / anomaly path 以產品化形式移植到 cms。
- 理由：最小閉環現已存在（approved mission → consumption → bounded delegated continuation），但完整 orchestration / queue ownership 仍屬後續切片。

## Follow-up Note (2026-03-14)

- mission consumption baseline 已於後續 slice 完成並 commit：
  - runtime 現在會實際讀取 `implementation-spec.md` / `tasks.md` / `handoff.md`
  - 成功時，synthetic continuation metadata 會帶 `missionConsumption` trace
  - 失敗時，autonomous continuation 會以 `mission_not_consumable` fail-fast 停止，並寫入 `workflow.mission_not_consumable` anomaly event
- 因此下一個正式 slice 已改為 **delegated execution baseline**，而不再是 mission consumption baseline。

## Follow-up Note (2026-03-14, delegated baseline)

- delegated execution baseline 已實作完成（bounded scope）：
  - runtime 會在 continuation 產生 delegation metadata contract，並保留 synthetic continuation trace
  - role set 維持 bounded：`coding` / `testing` / `docs` / `review` / `generic`
  - 角色推導無法安全判定時，會保留 `generic`，不偽裝成已授權多代理委派
- mission consumption stop/anomaly path 持續生效：
  - mission artifacts 不可消費時，autonomous continuation 仍以 `mission_not_consumable` fail-fast 停止
  - 同步保留 `workflow.mission_not_consumable` evidence event（無 silent fallback）

## Follow-up Note (2026-03-14, health snapshot convergence)

- 已開始推進下一個正式 slice：**health / queue / anomaly surface convergence**。
- 本輪先完成最小 runtime truth surface，而不是直接跳進完整 worker orchestration：
  - `packages/opencode/src/session/workflow-runner.ts`
    - 新增 `summarizeAutonomousWorkflowHealth(...)`
    - 新增 `getAutonomousWorkflowHealth(sessionID)`
  - 目的：把下列分散真相收斂成單一可讀 snapshot
    - `workflow.state / stopReason`
    - pending continuation queue
    - supervisor retry/failure state
    - recent anomaly evidence（來自 `RuntimeEventService`）
- 新 snapshot contract 目前輸出：
  - `state`
  - `stopReason`
  - `queue`（是否排隊、roundCount、reason、queuedAt）
  - `supervisor`（lease/retry/failure summary）
  - `anomalies`（recentCount、latestEventType、flags、countsByType）
  - `summary`（`healthy | queued | paused | degraded | blocked | completed` + label）
- 這一刀的目的不是新增 UI 或 fallback，而是建立 runner 內部可複用的 **單一健康摘要介面**，讓後續 session summary / server route / detached attach surface 能引用同一份 runtime health truth。

### Validation (health snapshot slice)

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- 結果：`39 pass / 0 fail` ✅
- 新增覆蓋：
  - queue + supervisor + anomaly event 可被收斂成單一 health snapshot
  - persisted pending continuation + runtime events 可被 `getAutonomousWorkflowHealth(sessionID)` 正確讀回

### Architecture Sync (health snapshot slice)

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪新增的是 `workflow-runner` 內部 health snapshot helper / summary contract，尚未擴張成新的外部 API、持久化 schema 或跨模組 runtime ownership 邊界；因此 `docs/ARCHITECTURE.md` 暫不需改寫。

## Follow-up Note (2026-03-14, health API surface)

- 已將 health snapshot 接到 session server route：
  - `GET /session/:sessionID/autonomous/health`
- route 目前直接回傳 converged snapshot：
  - `state`
  - `stopReason`
  - `queue`
  - `supervisor`
  - `anomalies`
  - `summary`
- 掛載策略：
  - 不新增平行 API namespace
  - 直接掛在既有 `session.autonomous` family 下，作為 autonomous runner 真相面
- 本輪 also 修正一個 implementation 細節：
  - `server/routes/session.ts` 的 OpenAPI schema 若直接引用 `Session.WorkflowState`，在測試載入順序下會踩到 barrel / circular timing
  - 已改成 eager-safe 字面 enum，避免 module-load 時 `Session.WorkflowState` 尚未可用

### Validation (health API slice)

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/test/server/session-autonomous.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- 結果：`42 pass / 0 fail` ✅
- 新增覆蓋：
  - `GET /session/:sessionID/autonomous/health` 可正確回傳 queue/supervisor/anomaly convergence
  - health snapshot runtime helper 與 route contract 一致

### Architecture Sync (health API slice)

- Architecture Sync: Verified (No doc changes)
- 比對依據：雖然新增了一條 session route，但它只是把既有 workflow-runner / runtime-event / pending-continuation 真相面對外暴露，未新增新的 ownership 邊界或 runtime flow，因此 `docs/ARCHITECTURE.md` 暫不需改寫。

## Follow-up Note (2026-03-14, web summary integration)

- 已將 `GET /session/:sessionID/autonomous/health` 接入 Web session status panel。
- 本輪新增：
  - `packages/app/src/pages/session/use-autonomous-health-sync.ts`
    - status panel 開啟時，以最小輪詢 + event-trigger 方式同步 autonomous health snapshot
  - `packages/app/src/pages/session/session-side-panel.tsx`
    - status summary 現在會吃 `autonomousHealth`
  - `packages/app/src/pages/session/helpers.ts`
    - `getSessionStatusSummary(...)` 現在可顯示：
      - `Health: <label>`
      - `Queue: ...`
      - `Anomalies: ...`
      - `Latest anomaly: ...`
      - `Anomaly flags: ...`
- 整合策略：
  - 暫不等待 SDK codegen 新 method
  - 先透過 `sdk.fetch` 直接打新 route，避免本輪 scope 被 SDK generation 綁住
  - 只在 status 視圖啟用，避免把新輪詢擴散到整個 session 頁面

### Validation (web summary integration)

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/server/session-autonomous.test.ts" "/home/pkcs12/projects/opencode-runner/packages/app/src/pages/session/helpers.test.ts" --test-name-pattern "(Session workflow runner|session.autonomous|getSessionStatusSummary)"`
- 結果：`51 pass / 0 fail` ✅
- 新增覆蓋：
  - UI summary 會呈現 health label / queue / anomaly convergence
  - route + runtime helper + summary helper contract 一致

### Architecture Sync (web summary integration)

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪是既有 session status panel 的資料補強與新 helper hook，未新增新的模組邊界或狀態機類型；因此 `docs/ARCHITECTURE.md` 暫不需改寫。

## Follow-up Note (2026-03-14, queue-ownership resume gate hardening)

- 已完成下一個 mainline slice：**runtime-side queue ownership hardening（detached resume guard）**。
- 變更重點放在 `workflow-runner` 的 resume 選擇規則，目標是避免 supervisor 在 detached sweep 時重新啟動本來就應停在 user-gated 狀態的 session。
- 本輪新增：
  - `shouldResumePendingContinuation(...)` 現在會讀取 converged health（含 `state/stopReason/supervisor`）再判定是否可 resume。
  - 若 session 目前屬 `waiting_user` 且 stop reason 屬於明確 non-resumable gate，resume 會被拒絕（例如：`approval_needed` / `product_decision_needed` / `mission_not_approved` / `mission_not_consumable` / `wait_subagent` / `max_continuous_rounds` / `manual_interrupt` / `risk_review_needed`）。
  - `pickPendingContinuationsForResume(...)` 排程時新增 health-aware 排序，優先處理較健康候選，降低 degraded queue 在 detached sweep 中搶佔恢復配額。
  - `resumePendingContinuations(...)` 在組裝 candidate 時，會同時收斂 recent anomalies（透過 `RuntimeEventService`）形成 health snapshot，供 scheduler 使用。
- 設計意圖：
  - queue 依舊是 runtime-owned durable record；
  - 但「是否該 resume」不再只看 queue + idle + lease/retry，而是由 health surface 統一裁決；
  - 讓 detached attach / cross-session supervisor decisions 更接近單一 runner truth，且不新增 fallback 行為。

### Validation (queue-ownership resume gate hardening)

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/server/session-autonomous.test.ts"`
- 結果：`42 pass / 0 fail` ✅
- 新增覆蓋：
  - `waiting_user + approval_needed` 不可被 detached resume sweep 重啟
  - `waiting_user + wait_subagent` 不可被 detached resume sweep 重啟

### Architecture Sync (queue-ownership resume gate hardening)

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪屬於既有 `workflow-runner` scheduler decision 強化，沒有新增新的外部 API、持久化 schema、或新的跨模組 ownership 邊界；`docs/ARCHITECTURE.md` 現有 autonomous/health/queue contract 仍成立。

## Follow-up Note (2026-03-14, queue inspection/control surface)

- 已完成下一個 mainline slice：**pending continuation queue inspection surface（operator/runtime 可審計）**。
- 本輪目標不是改 queue ownership，也不是新增 fallback；而是把「queue 是否可 resume、為何被阻擋」以單一路徑顯式化，與既有 health surface 對齊。
- 本輪新增：
  - `packages/opencode/src/session/workflow-runner.ts`
    - 新增 `inspectPendingContinuationResumability(...)`：輸出 `resumable + blockedReasons[] + health`，將 detached resume gate 決策理由結構化。
    - `shouldResumePendingContinuation(...)` 改為重用上述 inspection helper，避免 route/scheduler 各自重算不同判準。
    - 新增 `getPendingContinuationQueueInspection(sessionID)`：回傳
      - pending continuation payload（若存在）
      - runtime status (`idle|busy|retry`)
      - in-flight 標記
      - `resumable` 與 `blockedReasons`
      - converged `health`
  - `packages/opencode/src/server/routes/session.ts`
    - 新增 `GET /session/:sessionID/autonomous/queue`
    - 將 queue inspection 作為 session.autonomous family 下的 operator-facing inspect route
    - schema 直接暴露 blocked reason 列表，讓 Web/TUI/supervisor 可用同一語義判讀 queue gate
  - `packages/opencode/src/server/user-daemon/manager.ts`
    - 新增 `callSessionAutonomousQueue(...)`，維持 per-user daemon routed read path 一致性
- 目前已涵蓋的 block reason 分類（最小可用集）：
  - `no_pending_continuation`
  - `in_flight`
  - `status_busy` / `status_retry`
  - `autonomous_disabled`
  - `workflow_blocked` / `workflow_completed`
  - `waiting_user_non_resumable:<stopReason>`
  - `supervisor_retry_backoff`
  - `supervisor_foreign_lease`

### Validation (queue inspection/control surface)

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/server/session-autonomous.test.ts"`
- 結果：`44 pass / 0 fail` ✅
- 新增覆蓋：
  - helper 可區分 `resumable` 與 `blocked` queue，並回傳 block reasons
  - `GET /session/:sessionID/autonomous/queue` 會回傳 pending payload + blocked reason + health 對齊資訊

### Architecture Sync (queue inspection/control surface)

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪新增的是既有 autonomous health/queue truth 的 inspection route 與可審計分類欄位，未引入新的持久化 schema、ownership boundary 或新的 runtime flow；`docs/ARCHITECTURE.md` 現有 contract 仍可覆蓋。

## Follow-up Note (2026-03-14, queue control mutation + operator control surface)

- 已連續完成下一個 dependency-ready mainline slices：
  1. **queue control mutation baseline（runtime/operator 可執行）**
  2. **operator control surface wiring（server + daemon route + web status panel actions）**
- 本輪重點是把 queue 從「只能 inspect」補齊到「可明確 mutate」：
  - `packages/opencode/src/session/workflow-runner.ts`
    - 新增 `mutatePendingContinuationQueue(...)`，支援：
      - `resume_once`：僅在 queue inspection 判定可 resume 時觸發單次 resume
      - `drop_pending`：移除 pending continuation queue item
    - 新增 operator mutation result contract：`action/applied/reason/blockedReasons?/inspection`
    - `pickPendingContinuationsForResume(...)` 新增 `preferredSessionID`，讓 `resume_once` 可精準優先調度指定 session
    - queue mutation 會寫入 runtime events：
      - `workflow.pending_continuation_dropped`
      - `workflow.pending_continuation_resume_requested`
      - `workflow.pending_continuation_resume_dispatch_skipped`（含 anomaly flag）
  - `packages/opencode/src/server/routes/session.ts`
    - 新增 `POST /session/:sessionID/autonomous/queue`
    - `action` 目前開放 `resume_once | drop_pending`
    - route 直接回傳 post-mutation inspection，讓 operator 不必二次查詢才能知道結果
  - `packages/opencode/src/server/user-daemon/manager.ts`
    - 新增 `callSessionAutonomousQueueControl(...)`
    - 讓 per-user daemon routed mode 保持 queue control mutation path 對齊
  - `packages/app/src/pages/session/session-side-panel.tsx`
    - status panel 在有 pending queue 時新增最小 operator controls：
      - `Resume once`
      - `Drop pending`
    - action 完成後會強制 refresh autonomous health，並回填錯誤訊息
  - `packages/app/src/pages/session/use-autonomous-health-sync.ts`
    - 新增 `forceRefresh()` 對外 API，供 queue control action 後立即拉回最新 health/queue truth
- 設計邊界：
  - 不新增 fallback；resume 仍受既有 resumability gate 約束
  - queue control mutation 只操作既有 queue/supervisor truth，不繞過 workflow stop gate
  - 保持 `session.autonomous` family 的單一路徑，避免平行控制面分裂

### Validation (queue control mutation + operator control surface)

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts" "/home/pkcs12/projects/opencode-runner/packages/opencode/test/server/session-autonomous.test.ts"`
- 結果：`48 pass / 0 fail` ✅
- 新增覆蓋：
  - runtime queue mutation 可正確 drop pending item
  - `resume_once` 在 blocked queue 會回傳 `not_resumable + blockedReasons`，不會繞過 gate
  - `POST /session/:sessionID/autonomous/queue` route contract 與 runtime mutation contract 對齊
- `bun test "/home/pkcs12/projects/opencode-runner/packages/app/src/pages/session/helpers.test.ts" --test-name-pattern "getSessionStatusSummary"`
- 結果：`9 pass / 0 fail` ✅
- 備註：`helpers.test.ts` 的 `focusTerminalById` 子測試依賴 DOM，需在 jsdom 環境跑；本輪針對 queue/operator 整合僅執行 `getSessionStatusSummary` 目標測試。

### Architecture Sync (queue control mutation + operator control surface)

- Architecture Sync: Verified (No doc changes)
- 比對依據：本輪新增的是既有 autonomous queue truth 的 mutation/control API 與 UI 操作入口，未新增新的持久化 schema 或跨模組 ownership 邊界；`docs/ARCHITECTURE.md` 既有 autonomous health/queue/operator 面向描述仍可覆蓋。
