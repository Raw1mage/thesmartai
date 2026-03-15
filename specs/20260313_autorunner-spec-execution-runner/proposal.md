# Proposal

## Why

- `autorunner` 目前已具備 planner revival、autonomous workflow metadata、pending continuation queue、以及 Smart Runner governance，但主執行模型仍以 prompt loop / synthetic continuation 為中心。
- 實際故障已證明，subagent timeout/error 後，parent workflow / todo / process state 容易出現 stale mismatch，尤其是 `wait_subagent` 類狀態缺少單一真相來源。
- 在這種前提下，若直接嘗試一次性 daemon 化，風險過高且缺乏最小可驗證 substrate。
- 目前有一個待驗證的產品方向假設：runner 未來可能需要 24x7 背景工作，而 TUI / WebApp 可自由 detach / attach，不受前端連線或網路波動影響。
- 另一個待驗證假設是：若同一個 opencode runtime 能在背景持有 server，並同時接受 TUI attach 與 Web access，可能可視為 daemon/multi-access server 架構的早期落地版本。

## What Changes

- 將本輪 autonomous agent 大計畫正式收斂為 OpenSpec-style change unit。
- 明確定義 runner 的第一個真實產品用例：**消費 `/specs` 中已完整編譯並批准的開發計畫，然後委派 coding/testing/docs/review 等 agents 去執行。**
- 先以 **最小 runtime substrate 切片** 為第一階段目標，而不是直接重寫整個 daemon topology。
- 第一個底層切片聚焦：
  - runtime event journal baseline
  - stale `wait_subagent` / subagent error mismatch anomaly capture
  - 將這些 anomaly 轉為 runtime-visible evidence，而不是只停留在散落的 todo / monitor / process 判斷

## Capabilities

### New Capabilities

- `autorunner-runtime-journal-baseline`
  - 可持久化最小 runtime events，作為後續 reducer / health view 的基底。
- `autorunner-subagent-mismatch-anomaly`
  - 當 subagent task part error、process truth 消失、但 todo/workflow 仍維持 `wait_subagent` 語義時，系統能顯式記錄 anomaly，而不是靜默停留在舊狀態。
- `autorunner-daemon-target-architecture`
  - 若可行性分析成立，session execution 的長期目標可演進為 daemon-owned runtime，由 attachable TUI/Web surfaces 觀測與控制，而不是由前端連線生命週期擁有。
- `autorunner-multi-access-runtime`
  - 若可行性分析成立，同一份 background runtime truth 應可同時被多種 access surface（TUI / Web）存取，而不是各自啟一套互相脫節的 execution island。
- `autorunner-spec-execution-runner`
  - runner 可把 `/specs` 中已完成 OpenSpec 編譯與批准的開發計畫，轉成可委派的 execution contract，並驅動 coding/testing/docs/review agents 持續推進。

### Modified Capabilities

- `autonomous-workflow-observability`
  - 從 scattered signals，提升為至少有一條 event-based evidence path。
- `planner-to-runtime-handoff`
  - 這次 change 會把大計畫先固化為 OpenSpec artifact set，讓後續每個實作切片都能掛在同一個規格基底上。

## Impact

- 影響 `packages/opencode/src/session/**`、`packages/opencode/src/tool/task.ts`、可能新增 `packages/opencode/src/system/**` 或相近 runtime substrate 模組。
- 影響 session/workflow observability contract，後續可能需要同步 `docs/ARCHITECTURE.md`。
- 不包含直接修改 cms branch；cms 只在 runner 端切片成熟後再做同步評估。
- 長期上也會影響 attach contract：TUI / WebApp 將被重新定位為 attach/detach tolerant 的 control surfaces，而不是 execution owner。
