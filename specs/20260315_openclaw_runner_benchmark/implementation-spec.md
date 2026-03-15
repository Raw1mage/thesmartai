# Implementation Spec

## Goal

- 以 OpenClaw 的 7x24 agent 控制面為 benchmark，為 opencode 制定一個可逐階段實作的 runner 演進計畫：從 session-local continuation engine，升級成 trigger-driven autonomous scheduler substrate。

## Scope

### IN

- OpenClaw 的公開架構、控制迴圈、排程、狀態持久化與恢復模型研究
- 現有 `workflow-runner` / continuation queue / mission contract / supervisor 對標分析
- 形成 runner substrate 改進提案、移植候選與 stop gates

### OUT

- 本輪不直接實作大規模 daemon / scheduler rewrite
- 本輪不直接引入未審核第三方程式碼
- 本輪不新增 fallback mechanism

## Assumptions

- OpenClaw 的可公開觀測材料足以提煉其控制面思路，但未必能完整取得所有內部實作細節。
- 本輪以 architecture benchmark 與 execution plan 為主，不預設立即 build。

## Stop Gates

- 若 OpenClaw 研究需要存取不可公開或無法驗證的實作細節，必須停在不確定性邊界，不得臆測。
- 若提案牽涉大規模 daemon / queue substrate 重構，需先形成明確 phases 與 approval gate，再進 build。
- 若發現可移植設計隱含 silent fallback 或與本 repo fail-fast 原則衝突，必須顯式列為 rejected / non-portable。

## Critical Files

- `/home/pkcs12/projects/opencode/docs/ARCHITECTURE.md`
- `/home/pkcs12/projects/opencode/docs/events/event_20260315_openclaw_runner_benchmark.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/proposal.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/spec.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/design.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/tasks.md`
- `/home/pkcs12/projects/opencode/specs/20260315_openclaw_runner_benchmark/handoff.md`

## Structured Execution Phases

- Phase 1 — Baseline and boundary confirmation
  - 確認現有 `workflow-runner` 已具備的 mission / todo / continuation / supervisor / lease / anomaly surfaces。
  - 確認哪些能力是 runtime substrate，哪些仍只是 prompt / workflow contract。
- Phase 2 — OpenClaw control-plane capture
  - 以本地 `refs/openclaw` 為主證據，提煉其 daemon / gateway、lane-aware queue、heartbeat、cron、isolated session、restart-drain contract。
- Phase 3 — Portability classification
  - 將 OpenClaw 特徵分成：already-present / portable-next / substrate-heavy / incompatible。
- Phase 4 — Runner evolution planning
  - 輸出 opencode 的 phased implementation plan：
    1. generic trigger model
    2. lane-aware run queue
    3. isolated autonomous job sessions
    4. heartbeat / wakeup / cron substrate
    5. daemon lifecycle / scheduler observability

## Proposed Implementation Slices

### Slice A — Trigger model extraction (lowest-risk entry)

- 從 `workflow-runner` 目前的 mission continuation 邏輯中抽出通用 `trigger` 概念。
- 建議 trigger types：
  - `user_message`
  - `mission_continue`
  - `heartbeat`
  - `scheduled_job`
  - `manual_resume`
  - `external_hook`（保留未來 webhook / MCP / system event）
- 目的：讓 runner 不再只吃 planner-derived continuation。

### Slice B — Queue substrate generalization

- 將現有 pending continuation queue 升級成 generic run queue。
- 增加 lane 概念：
  - `session:<id>`
  - `main`
  - `subagent`
  - `scheduler`
- 每個 session lane 仍維持單線序列化；全域 lane 控制總併發。

### Slice C — Isolated autonomous job sessions

- 新增非對話型 session / run 類型，例如：
  - `job:<jobId>`
  - `heartbeat:<scope>`
  - `wakeup:<id>`
- 目的：讓背景自治任務不污染主要開發 session，也不強迫綁定既有 mission transcript。

### Slice D — Heartbeat and scheduler substrate

- 建立 lightweight heartbeat：
  - backlog review
  - stalled task scan
  - validation reminders
  - docs / architecture sync reminders
- 建立 scheduler primitive：
  - one-shot wakeup
  - recurring wakeup
  - retention / retry / backoff

### Slice E — Daemon lifecycle and observability

- 在未來 runner daemon / host scheduler 層補上：
  - drain-before-restart
  - active-run wait
  - queue reset on restart
  - host-wide scheduler health / queue depth / stuck-run evidence

## Validation

- Research evidence must cite concrete architecture traits rather than vague claims.
- Gap analysis must separate: already present, missing but portable, substrate-heavy, and intentionally rejected patterns.
- Before any build-mode runner rewrite begins, the plan must define validation at three levels:
  - unit/regression: queue semantics, trigger resolution, stop gates
  - integration: scheduler -> run lane -> session effects
  - soak/e2e: restart, interruption, retry, stuck-run recovery

## Handoff

- Build mode may begin only from Slice A / Slice B unless the user explicitly approves substrate-heavy work.
- Slice C / D / E require explicit stop-gate review because they introduce new runtime authority boundaries and background execution semantics.
