# Event: Session Dialog DB Tool Refactor

## 需求

Session storage/dialog 已全面改 DB；重構 system-manager 相關 tool，讓它們讀取 DB 裡的 session dialog。

## Scope

IN:

- system-manager session/dialog 讀取路徑偵查與重構。
- DB-backed session/message API 對齊。
- 保留 output budget / pagination 行為。

OUT:

- 不新增 fallback mechanism。
- 不重啟 daemon/gateway。
- 不改 UI 顯示策略，除非型別/contract 必要。

## 任務清單

- 1.1 Locate current system-manager dialog/session reads.
- 1.2 Locate DB session/message APIs.
- 2.1 Backup XDG key config files.
- 2.2 Refactor tool data source to DB.
- 2.3 Preserve budget/pagination semantics.
- 3.1 Validate.
- 3.2 Architecture sync.

## Debug Checkpoints

### Baseline

- Symptom: system-manager session/dialog tools may still read legacy session storage after DB migration.
- Initial boundary: MCP system-manager package -> runtime session/message persistence.

### Instrumentation Plan

- Inspect tool entrypoints and DB storage APIs.
- Validate ordering/cursor semantics and output-budget preservation.

### Execution

- Pending.

### Root Cause

- Pending.

### Validation

- Pending.
