# Event: autorunner autonomous agent completion

Date: 2026-03-13
Status: In Progress
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

1. mission consumption baseline
   - 讓 runner 不只保存 approved mission metadata，而能開始讀取 `implementation-spec / tasks / handoff` 作為執行輸入。
2. delegated execution baseline
   - 讓 runner 能依 approved plan 的 execution role hints 啟動 coding/testing/docs/review 類委派流程。
3. health / queue / anomaly surface convergence
   - 逐步把 queue ownership、health summary、anomaly evidence 收斂到同一個 runner truth surface。

### cms Sync Gate

- 目前先**不要**把這批 runner-only substrate 直接同步回 cms。
- Gate：至少要等到 mission consumption baseline 完成，且具備對應 validation，才能評估是否將 `session.mission` / event journal / anomaly path 以產品化形式移植到 cms。
- 理由：現在的成果已足以定義 authority 與 evidence substrate，但尚未完成「approved mission 內容被真正消費並驅動執行」的最小產品閉環。
