# Implementation Spec

## Goal

- 將 opencode runner 從 session-local mission continuation engine，演進為 scheduler-ready autonomous substrate：先支援 generic trigger model 與 lane-aware run queue，為後續 isolated job sessions / heartbeat / wakeup / daemon lifecycle 打下可實作基礎。

## Scope

### IN

- `packages/opencode/src/session/workflow-runner.ts` 的 run orchestration contract
- continuation / pending queue 與 workflow health 相關 substrate
- 新的 trigger typing / trigger resolution / run lane model
- queue generalization 與 per-session serialization + global concurrency contract
- runner prompt / system / architecture wording 中與新 substrate 直接耦合的描述
- 對應 tests、event、architecture sync planning

### OUT

- 本輪 plan 不直接做 full daemon rewrite
- 本輪 plan 不直接做 recurring cron persistence store
- 本輪 plan 不直接做 webhook trigger surface
- 本輪 plan 不直接移植 OpenClaw channel-centric product features
- 本輪 plan 不新增 fallback mechanism

## Assumptions

- 現有 autorunner 已具備 approved mission、todo-driven continuation、supervisor / lease / anomaly evidence，這些應保留並降階為 scheduler 的其中一種 trigger source。
- 第一個 build slice 應避免直接碰 host-wide daemon lifecycle，先從 `workflow-runner` 內部 contract 抽象化開始。
- 新 substrate 仍必須遵守 fail-fast、explicit stop gate、no-silent-fallback 原則。
- 新的 run queue 需要與現有 sidebar / planner todo contract 共存，而不是取代 planner authority。

## Stop Gates

- 若實作需要直接引入 recurring scheduler persistence、daemon restart loop、或 host-level background worker，必須先回到 plan mode 做 phase split 與 approval。
- 若 trigger model 抽象化會破壞現有 approved mission / approval / decision gate semantics，必須停下補 spec，不得邊做邊猜。
- 若 queue generalization 需要新增任何 silent retry / fallback / implicit recovery，必須停下並顯式拒絕。
- 若 isolated session / heartbeat / wakeup 需要搶先進 scope，必須先完成 Trigger + Queue 兩個前置 slice 的設計與 validation plan。

## Critical Files

- `/home/pkcs12/projects/opencode/packages/opencode/src/session/workflow-runner.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/system.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/runner.txt`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/plan.txt`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/todo.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/session/workflow-runner.test.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/test/session/planner-reactivation.test.ts`
- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_openclaw_runner_benchmark.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_openclaw_scheduler_substrate_plan.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_scheduler_substrate/handoff.md`

## Structured Execution Phases

- Phase 1 — Trigger model extraction
  - 定義 `RunTrigger` 與 trigger source taxonomy。
  - 將現有 approved mission continuation 明確歸類為其中一種 trigger，而非唯一入口。
- Phase 2 — Lane-aware run queue design
  - 抽出 `RunLane` 概念，建立 per-session serialization + global concurrency contract。
  - 將現有 pending continuation queue 升級成 generic run queue。
- Phase 3 — Workflow-runner contract refactor
  - 讓 `workflow-runner` 從 mission-only continuation coordinator，升級為 generic run orchestrator。
  - 保留現有 approval / decision / wait_subagent / blocker semantics。
- Phase 4 — Validation and architecture sync
  - 補 unit / integration / regression validation 規劃。
  - 同步 event 與 `docs/ARCHITECTURE.md` 的 runner / queue / scheduler 章節。

## Validation

- 單元層：trigger resolution、lane assignment、queue ordering、stop gate preservation。
- 整合層：mission continuation 與 generic trigger 共存、subagent wait path、不同行為 lane 間互不污染。
- 回歸層：現有 planner/todo/approval flow 不退化為 prompt-only behavior。
- 架構層：文件需明確表達「planner authority ≠ run trigger authority」的新分層。

## Handoff

- 下一輪 build 應只從 **Phase 1 + Phase 2** 開始，避免直接跨進 heartbeat / wakeup / daemon lifecycle。
- build agent 必須把 scheduler substrate 當成 runtime-level改造，而不是只改 prompt wording。
- build agent 必須保留 planner / mission contract，僅把它降階為 trigger source 之一。
- 若實作中發現必須擴張到 isolated jobs / heartbeat，需先停下回 planner 追加 spec。
