# Tasks

## Structured Execution Phases

### Phase 1 — Define bounded execution role contract

- [x] 定義第一輪支援的 role set（`coding` / `testing` / `docs` / `review` / `generic`）
- [x] 明確定義 role derivation source

### Phase 2 — Add role-derivation helper

- [x] 根據 actionable todo + mission consumption 產生 bounded role
- [x] 對模糊情況回傳 bounded generic result

### Phase 3 — Wire delegated continuation metadata

- [x] synthetic continuation 帶入 delegation metadata
- [x] continuation text 在安全情況下帶 role hint

### Phase 4 — Add targeted tests

- [x] 新增 role derivation 測試
- [x] 新增 continuation metadata 測試
- [x] 新增 ambiguous todo 保護測試

### Phase 5 — Validate and document

- [x] 跑 targeted tests
- [x] 更新 event ledger
- [x] 完成 architecture sync 判斷

## Validation Tasks

- [x] `bun test "/home/pkcs12/projects/opencode-runner/packages/opencode/src/session/workflow-runner.test.ts"`
- [x] delegated execution 相關 targeted tests（包含 role derivation / continuation metadata / ambiguous fallback）

## Dependency Notes

- 本 change 已完成 delegated execution baseline（bounded roles + delegation metadata contract）。
- `mission_not_consumable` fail-fast / anomaly evidence path 仍為 delegated path 前置 gate，不可回退為 silent fallback。
