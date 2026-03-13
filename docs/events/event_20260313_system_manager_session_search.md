## Requirements

- 擴充 `system-manager` 的 `manage_session` 工具，支援依 session title 搜尋既有 session。
- 保持 non-breaking：既有 `rename/fork/summarize/undo/redo/create/list` 行為不變，只做 additive `search` operation。

## Scope

### In

- `packages/mcp/system-manager/src/index.ts`
- event ledger / validation

### Out

- session storage format migration
- fork/list 既有行為改寫
- system-manager 其他工具語意變更

## Task List

- [x] 擴充 `manage_session` tool schema，加入 `search` operation / `query` / `limit`
- [x] 實作 session title keyword 搜尋
- [x] 保留既有 operations 完整相容
- [x] 補 event / validation

## Baseline

- `manage_session` 目前支援 `rename/fork/summarize/undo/redo/create/list`，缺少 search。
- 使用者若要回到舊 session，只能靠 list 或外部工具，不利於在長 session 歷史中快速定位。

## Changes

- `packages/mcp/system-manager/src/index.ts`
  - tool schema 新增 `search` operation
  - 新增 `query` / `limit` 參數
  - 讀取 `storage/session/*/info.json`，對 title 做 keyword 搜尋
  - 結果以最新更新時間排序，回傳 title / id / updated / URL

## Decisions

1. `search` 採 additive operation，不影響原有 `list` semantics。
2. 搜尋範圍只看 session title，不直接全文掃描 session transcript，以維持低成本與可預期性。
3. query 採 keyword AND-match（split by whitespace），結果按 updated desc 排序。

## Validation

- 靜態檢查：`manage_session` schema 已包含 `search` / `query` / `limit`。✅
- 靜態檢查：實作只新增 `search` 分支，不改動既有 operations。✅
- Architecture Sync: Verified (No doc changes)

## Next

- 若後續需要全文或 metadata 搜尋，應另開切片設計索引/成本策略。
