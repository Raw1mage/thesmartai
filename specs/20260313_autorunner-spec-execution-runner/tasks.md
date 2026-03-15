# Tasks

## Structured Execution Phases

### Phase 1 — Establish runner-local OpenSpec planning substrate

- [x] 建立 `specs/20260315_openspec-like-planner/` artifact set
- [x] 將本輪 event 與 OpenSpec artifacts 相互對齊

### Phase 2 — Define runner authority from approved OpenSpec plans

- [x] 定義 runner 只接受已批准且已完整編譯的 OpenSpec plan 作為 execution authority
- [x] 定義 `/specs` 開發計畫作為第一個 supported mission contract
- [x] 定義 spec plan → runtime execution contract 的最小映射

### Phase 3 — Implement minimal runtime event journal baseline

- [x] 新增最小 runtime event service 模組
- [x] 定義第一版 event schema（session/workflow/todo/anomaly 需要的核心欄位）
- [x] 寫入與讀取 recent events 的最小存取 API

### Phase 4 — Detect stale `wait_subagent` mismatch

- [x] 在 autonomous continuation / workflow evaluation 路徑加入 mismatch 偵測
- [x] 當 `wait_subagent` 缺少真實 worker/process 支撐時，寫入 `unreconciled_wait_subagent` anomaly event
- [x] 保持 fail-fast / explicit evidence，不導入 silent fallback

### Phase 5 — Add targeted tests

- [x] 新增 runner-plan authority / mission mapping 測試
- [x] 新增 runtime event service schema / persistence 測試
- [x] 新增 workflow-runner mismatch anomaly regression test
- [x] 視本輪完成範圍保留 todo/task regression 補強為未來 re-activation 工作

### Phase 6 — Validate and document

- [x] 跑 targeted tests
- [x] 更新 event 的 Execution / Root Cause / Validation
- [x] 完成 architecture sync 判斷

### Phase 7 — Historical preservation

- [x] 保留此 plan 作為 autorunner 架構歷史文件
- [x] 作為 `docs/ARCHITECTURE.md` 與未來 refactor 的參考來源

## Validation Tasks

- [x] `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- [x] `bun test <runner plan contract test file>`
- [x] `bun test <new runtime-event-service test file>`
- [x] 其餘補強測試留待未來 re-activation 時再評估

## Dependency Notes

- Phase 2 完成前，不宣稱 runner 已有正式 approved-plan authority model。
- Phase 3 完成前，不進入真正的 mismatch anomaly 實作。
- Phase 4 完成前，不宣稱 autonomous-agent substrate 已有最小 evidence contract。
- Phase 6 完成前，不進入 cms sync 策略。
