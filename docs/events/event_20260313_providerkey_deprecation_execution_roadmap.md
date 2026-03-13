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

---

## Phase D Proposal: deprecation execution (decision-required)

> 這一階段屬於 policy/breaking-risk gate，預設不自動執行；需明確批准後才啟動。

### D0. Preconditions (must-pass)

啟動前必須滿足：

1. Non-breaking baseline is frozen
   - checkpoint tag + bundle 已存在且可回復
2. Compatibility coverage is stable
   - route-level deterministic tests for canonical+legacy contracts 持續通過
3. Artifact parity is closed
   - `packages/sdk/openapi.json` / `packages/sdk/js/openapi.json` / generated SDK 無待收斂差異
4. Migration communication draft prepared
   - 變更公告草案、升級說明草案、回滾說明草案完成

### D1. Deprecation announcement phase (non-breaking)

目標：先宣告，不移除。

Actions:

- 在 OpenAPI/SDK docs 將 `family/families` 與 `:family` path 標示為 deprecated（若尚未完整覆蓋）
- 在 README / ARCHITECTURE / events 加上 deprecation notice
- 發布 migration guide（canonical `providerKey/providers` 為主）

Exit criteria:

- 對外文件全部以 `providerKey/providers` 為主語言
- legacy naming 只出現在 compatibility/deprecated 區段

### D2. Observation window (no behavior changes)

目標：收集是否可安全移除。

Actions:

- 監測 legacy route/field 使用率（request telemetry / server logs）
- 監測 SDK alias method 使用率（若可觀測）
- 收集升級回報與 blocker

Minimum window:

- 至少 1 個穩定 release cycle（建議 2）

Stop conditions:

- 若 legacy 使用仍高或 blocker 未清，延長窗口，不進 D3。

### D3. Controlled removal plan (major only)

目標：版本化移除，分批可回滾。

Candidate removals (order):

1. docs/examples 中的 legacy 首選寫法（先移除）
2. SDK duplicated alias methods/types（保留 shim 一個版本）
3. route-level legacy request aliases（`family/families` fields）
4. 最後才考慮 path-level `:family` 形狀替換

Hard rules:

- 每批只移除一層 surface
- 每批都附 rollback path
- 每批都跑 compatibility regression tests（保留舊版對照）

### D4. Rollback strategy

若任一移除批次出現回歸：

1. 立即 rollback 該批 commit
2. 重新啟用上一層 compatibility alias
3. 在 event 記錄 root cause 與後續條件

Rollback assets:

- checkpoint tags
- local bundle snapshots
- event ledger（可快速定位移除批次）

### D5. Approval gates (must ask)

以下任一動作需顯式批准：

- 移除 `family/families` 欄位
- 變更或移除 `:family` 路由形狀
- 更動 persisted storage key / schema
- 移除 public SDK legacy alias method surface

---

## Decision package (for approval)

若要啟動 D1，需一次確認：

1. 是否採 major-version 移除策略（是/否）
2. Observation window 長度（1 or 2 stable cycles）
3. 是否允許先移除 SDK duplicated alias methods（是/否）
4. 是否允許在 D3 觸及 `:family` path 形狀（是/否，預設否）
