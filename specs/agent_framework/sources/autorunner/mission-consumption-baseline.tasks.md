# Tasks

## Structured Execution Phases

### Phase 1 — Formalize mission consumption contract

- [x] 定義最小 mission execution input shape
- [x] 明確定義 implementation-spec / tasks / handoff 的 consumption boundary

### Phase 2 — Add mission consumption helper

- [x] 新增 mission artifact read/validate helper
- [x] 讓 helper 能回傳 compact execution input 或顯式 failure

### Phase 3 — Wire workflow continuation to consumed mission

- [x] 在 autonomous continuation path 使用 consumed mission input
- [x] 將 mission consumption trace 帶入 continuation metadata / observability surface
- [x] mission consumption failure 時 fail-fast 停止
