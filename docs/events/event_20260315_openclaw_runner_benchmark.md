# Event: openclaw runner benchmark

Date: 2026-03-15
Status: Planned
Branch: cms
Workspace: /home/pkcs12/projects/opencode

## 需求

- 使用者要求向 OpenClaw 對標，理解其 7x24 運行 agent 架構。
- 目標不是純研究報告，而是要回到現有 runner，找出可改進之處。
- 如有必要，可復刻/移植 OpenClaw 的核心設計到現有 autorunner / runner substrate。

## 範圍 (IN / OUT)

### IN

- OpenClaw 公開架構研究
- `docs/ARCHITECTURE.md` 中 autorunner / workflow-runner / continuation queue 相關章節
- `packages/opencode/src/session/workflow-runner.ts` 與相關 runner substrate 的 gap analysis
- `specs/20260315_openclaw_runner_benchmark/*`

### OUT

- 未經批准直接大規模移植第三方程式碼
- 未經研究證據支持的 daemon / scheduler 大改
- 新 fallback mechanism
- push / PR

## 任務清單

- [x] 讀取現有 autorunner 架構文件、event 與 active spec，建立研究邊界
- [x] 研究 OpenClaw 的 7x24 agent 架構與核心 loop / scheduler / state contract
- [x] 比對 OpenClaw 與現有 runner 差距，提煉可移植核心與不可直接移植部分
- [x] 更新 `specs/20260315_openclaw_runner_benchmark/*`，形成 execution-ready 改進計畫
- [x] 視收斂結果提出 build handoff / stop gates / approval point

## Debug Checkpoints

### Baseline

- 目前 autorunner 已完成 planner / bootstrap / prompt contract 對齊，但仍缺少經實戰驗證的長時間自治 runner substrate。
- `docs/ARCHITECTURE.md` 已記錄 continuation queue、supervisor、Smart Runner assist 與 mission contract，但是否足以接近 7x24 agent 仍未對標外部成熟實作。

### Instrumentation Plan

- 先用 public-architecture research 取得 OpenClaw 的 control loop、persistence、recovery、scheduler、stop gate 模型。
- 再與目前 `workflow-runner` 的 mission/todo/queue contract 對照，找出：
  1. 可直接學習的控制面
  2. 需重構 substrate 才能支撐的長時自治能力
  3. 不應移植的耦合點或隱含 fallback 行為

### Execution

- 已完成本地 benchmark 證據讀取與對標：
  - `refs/openclaw/docs/concepts/{agent-loop,queue,multi-agent}.md`
  - `refs/openclaw/docs/automation/{cron-jobs,cron-vs-heartbeat}.md`
  - `refs/openclaw/docs/cli/daemon.md`
  - `refs/openclaw/src/cli/gateway-cli/run-loop.ts`
  - `refs/openclaw/src/auto-reply/reply/{agent-runner,queue,queue-policy}.ts`
- 結論已收斂：OpenClaw 的 7x24 核心不是永不結束的 prompt，而是 **always-on gateway/daemon + lane-aware queue + heartbeat/cron triggers + isolated sessions + restart/drain lifecycle**。
- 已將結論轉成 opencode phased plan，並明確區分 lowest-risk slice 與 substrate-heavy slices。

### Root Cause

- 目前 opencode runner 的主要限制不是 planner 缺失，而是 runtime authority 仍以 **approved mission continuation** 為單一主來源。
- 這使 runner 雖能持續執行已批准任務，但尚未成為可吃多種 trigger source 的 general autonomous scheduler。
- 因此與 OpenClaw 的差距核心是 **control-plane substrate**，不是單純 prompt wording。

### Validation

- 已使用本地 `refs/openclaw` code/doc 作為主要證據來源，而非僅依賴公開網站摘要。
- 已完成 portable vs substrate-heavy vs incompatible 分類。
- 已生成 execution-ready plan，可直接作為下一輪 build 的 planning authority。

## Architecture Sync

- Architecture Sync: Deferred to next implementation slice
- 本輪為 benchmark / planning task；尚未更改 opencode runtime 架構本身，因此暫不改 `docs/ARCHITECTURE.md`。
- 下一輪若開始實作 Trigger model / lane-aware queue，則需同步更新 architecture 文件中的 runner / queue / scheduler 章節。

## Plan Follow-up

- 本 benchmark 已分流成新的 build-facing planning authority：
  - `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/*`
  - `/home/pkcs12/projects/opencode/docs/events/event_20260315_openclaw_scheduler_substrate_plan.md`
- 本檔保留為研究 / benchmark authority，不再承擔下一輪 scheduler substrate build plan 的主要 execution contract。
