# Tasks

## Structured Execution Phases

### Phase 1 — Formalize mission consumption contract

- [ ] 定義最小 mission execution input shape
- [ ] 明確定義 implementation-spec / tasks / handoff 的 consumption boundary

### Phase 2 — Add mission consumption helper

- [ ] 新增 mission artifact read/validate helper
- [ ] 讓 helper 能回傳 compact execution input 或顯式 failure

### Phase 3 — Wire workflow continuation to consumed mission

- [ ] 在 autonomous continuation path 使用 consumed mission input
- [ ] 將 mission consumption trace 帶入 continuation metadata / observability surface
- [ ] mission consumption failure 時 fail-fast 停止

### Phase 4 — Add targeted tests

- [ ] 新增 mission helper 成功讀取測試
- [ ] 新增 artifact 缺漏 fail-fast 測試
- [ ] 新增 continuation trace 測試

### Phase 5 — Validate and document

- [ ] 跑 targeted tests
- [ ] 更新 event ledger
- [ ] 完成 architecture sync 判斷

## Validation Tasks

- [ ] `bun test <mission consumption helper test file>`
- [ ] `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- [ ] `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/test/session/planner-reactivation.test.ts"`

## Dependency Notes

- Phase 1 完成前，不宣稱 runner 已真正消費 approved mission content。
- Phase 2 完成前，不把 mission artifact 讀取邏輯散落到多個 runtime 路徑。
- Phase 3 完成前，不宣稱 delegated execution baseline 已具備可靠 spec input。
- Phase 5 完成前，不評估同步回 cms。
