# Implementation Spec

## Goal

在 `autorunner` branch 上，先完成 autonomous-agent 大計畫的第一個可驗證 substrate 切片：

1. 明確建立 runner 的 execution authority 只能來自**已批准且已完整編譯的 OpenSpec 計畫文件**
2. 將 runner 的第一個真實產品用例鎖定為：**執行 `/specs` 中的開發計畫，並委派適合的 agents 持續推進**
3. 建立最小 runtime event journal，並把 stale `wait_subagent` 狀態收斂成 explicit anomaly evidence，作為後續 reducer / lease / daemon refactor 的基底

這個切片目前只承諾建立 runtime evidence substrate。

至於 24x7 background daemon 與「同一個 opencode server runtime 同時被 TUI attach 與 Web access」是否應成為正式里程碑，仍待可行性分析完成後再決定。

## Scope

### IN

- `specs/**/*.md`
- `packages/opencode/src/session/workflow-runner.ts`
- `packages/opencode/src/tool/task.ts`
- `packages/opencode/src/session/todo.ts`
- `packages/opencode/src/process/supervisor.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/storage/storage.ts`
- 新增最小 runtime event service 模組與對應測試

### OUT

- 一次性 daemon mesh 重構
- 完整 workflow state reducer
- 完整 worker supervisor registry 拆分
- 直接同步到 cms branch
- 任何新的 silent fallback behavior

## Problem Statement

目前 autorunner 最大的實際缺口不只在 runtime evidence substrate，也在 runner 還沒有被定義成「approved spec execution owner」：

- `/specs` 已能承載 OpenSpec-style plan artifacts，但尚未成為 runner 的正式 execution contract
- runner 還不能把已批准的 spec 計畫轉成可委派的持續執行流程
- autonomous continuation 決策仍主要依賴 prompt loop 與 todo/action metadata
- delegated subagent timeout/error 後，parent session 可能停留在 `wait_subagent` 類語義
- `task.ts` / `todo.ts` / `workflow-runner.ts` / `process.supervisor.ts` 各自持有局部真相，但沒有單一 event-based evidence path

結果是：

- operator 能看到「卡住了」
- 但 runtime 無法以結構化方式回答「為什麼還在 wait_subagent、哪個 truth 已失效」

## Assumptions

- 現有 planner/OpenSpec artifact contract 已足夠支撐本輪規格先行。
- 第一個切片應先保留現有執行模型，只增加最小 journal / anomaly layer。
- `ProcessSupervisor` 雖然仍是 in-memory，但可先作為第一個切片的 process-truth 來源之一。

## Design Summary

1. 建立 runner-plan contract baseline
   - 只接受已批准的 OpenSpec compiled plan
   - 第一個 mission source 為 repo 內 `/specs` 開發計畫
2. 新增最小 runtime event service
   - 使用固定 schema 寫入 event
   - 支援 append / list recent events by session
3. 在 workflow evaluation path 偵測 stale `wait_subagent` mismatch
   - 關鍵條件：todo/workflow 語義仍在等 subagent，但 active subtask / process truth 已無支撐
4. mismatch 發生時：
   - 記錄 anomaly event（`unreconciled_wait_subagent`）
   - 不新增 fallback，不用模糊 heuristics 自動掩蓋問題
5. 新增的 event substrate 必須可被 detached UI 重新 attach 後讀回
   - 也就是 event 與 runtime state 不能只存在於 attach 中的前端記憶體或單次 prompt loop 生命週期中

## Structured Execution Phases

### Phase 1 — Runner plan authority baseline

- 定義 runner 只接受「已批准 + 已完整編譯」的 OpenSpec plan 作為 execution authority
- 定義 `/specs` 開發計畫到 runtime execution contract 的最小映射

### Phase 2 — Runtime event service baseline

- 建立 `runtime-event-service` 模組
- 定義最小 event schema
- 提供 session-scoped recent event query

### Phase 3 — Stale wait_subagent anomaly integration

- 在 `workflow-runner.ts` 評估 continuation 時加入 mismatch detection
- 將 mismatch 寫入 anomaly event

### Phase 4 — Regression protection

- 新增 runner-plan contract / `/specs` mission mapping 測試
- 新增 event service 測試
- 新增 workflow-runner mismatch anomaly 測試
- 跑 targeted tests 並更新 event ledger

## Validation

- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/todo.test.ts"`
- `bun test <runner plan contract test file>`
- `bun test <new runtime-event-service test file>`

## Stop Gates

- 若要把 event baseline 擴張成完整 reducer / daemon queue ownership，需先回到 spec 討論，不得在本切片中偷偷升級範圍。
- 若偵測條件顯示僅憑現有 session/process facts 無法可靠判定 mismatch，需要先補一輪 spec clarification，再動更大刀。
- 若需要變更 cms branch，必須等 runner 切片驗證通過後另行評估同步策略。
- 若可行性分析後確定採納 daemon/multi-access 方向，屆時再把 execution ownership 與 TUI/Web attach 邊界納入正式 stop gate。

## Handoff

- 本 implementation spec 對應的 companion artifacts：
  - `proposal.md`
  - `spec.md`
  - `design.md`
  - `tasks.md`
  - `handoff.md`
- 後續 build/execution 應優先依本 spec 的 IN/OUT、Phases、Validation 與 Stop Gates 落地，不得回退成只靠對話臨時理解。
