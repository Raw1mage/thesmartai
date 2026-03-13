## ProviderKey Deprecation Execution Roadmap (Post-Checkpoint)

Date: 2026-03-13
Checkpoint baseline:

- Tag: `checkpoint/provider-key-migration-20260313-1`
- Commit: `dffa0c2d10`
- Bundle: `/home/pkcs12/projects/opencode/recyclebin/provider-key-migration-20260313-1.bundle`

---

## Goal

在不破壞現有使用者的前提下，將對外契約逐步從 `family/families` 遷移為 `providerKey/providers`。

---

## Non-negotiable constraints

1. 不移除既有 `/:family/...` 路由（直到 major 決策）。
2. 不移除 legacy 欄位 `family/families`（直到 major 決策）。
3. 不更動 persisted storage key（例如 accounts.json family 結構）。
4. 不新增 fallback 機制掩蓋錯誤。
5. 每個切片都要可獨立回滾。

---

## Phase plan

### Phase A — Contract annotation hardening (non-breaking)

Scope:

- server route descriptions/metadata
- OpenAPI deprecated annotations
- SDK generated comments/type docs

Entry criteria:

- source-of-truth 已可穩定輸出 openapi artifact

Exit criteria:

- 主要 account/provider 合約路由均標註 canonical + deprecated alias 語義

Validation:

- touched-file lint
- OpenAPI JSON parse
- focused contract tests

Rollback:

- revert 單一文檔/annotation commit

### Phase B — Deterministic compatibility test closure (non-breaking)

Scope:

- route-level mismatch guard tests
- canonical+legacy response alias tests
- 成功路徑不觸發 mismatch 的 deterministic assertions

Entry criteria:

- Phase A annotations 可對應測試語義

Exit criteria:

- account 主要 mutation/read 路徑都具備 deterministic compatibility coverage

Validation:

- focused test files only
- touched-file lint

Rollback:

- revert test-only slice

### Phase C — Artifact parity closure (non-breaking)

Scope:

- `packages/sdk/openapi.json`
- `packages/sdk/js/openapi.json`
- `packages/sdk/js/src/v2/gen/*`

Entry criteria:

- Phase A/B 穩定，source annotations 已定

Exit criteria:

- generated artifacts 與 source semantics 一致，無主要 alias 漂移

Validation:

- JSON parse checks
- SDK package scoped typecheck (`--filter=@opencode-ai/sdk`)

Rollback:

- revert artifact-only commit

### Phase D — Decision gate (breaking-risk)

This phase is blocked by policy decision and is **NOT** auto-executable:

- remove legacy fields?
- rename/remove `:family` paths?
- storage key migration?

Requires:

- telemetry evidence
- migration guide
- versioned deprecation announcement

---

## Execution contract for autonomous runner

1. 只做 A/B/C，禁止進入 D。
2. 每個 slice 使用 scoped validation，避免全域 typecheck 長時間阻塞。
3. 每個通過驗證 slice 可自動 commit。
4. 只要碰到 D 的需求，立刻停並回報 gate。

---

## Current next slice

優先順序：

1. 補齊 account/provider route metadata 的最後遺漏（A）
2. 補 daemon-routed deterministic compatibility coverage（B）
3. 再做 artifact parity 收斂（C）
