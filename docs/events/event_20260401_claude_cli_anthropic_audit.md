# Event: claude-cli anthropic audit

## 需求

- 參照既有 claude-provider / provider-registry 相關 plan 與文件，審計 cms 目前 `claude-cli` 實作是否被舊 `anthropic` 代碼污染。
- 區分允許保留的 transport / SDK / protocol alias 與不允許越界到產品層 provider identity 的 legacy alias。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/specs/architecture.md`
- `/home/pkcs12/projects/opencode/specs/_archive/account-management/slices/20260327_provider-llmgateway-bug/`
- `/home/pkcs12/projects/opencode/docs/events/archive/event_log_20260208_claude_cli_plugin_refactor.md`
- `/home/pkcs12/projects/opencode/docs/events/archive/event_log_20260214_claude_cli_oauth_fix.md`
- `/home/pkcs12/projects/opencode/packages/opencode/src/provider/`
- `/home/pkcs12/projects/opencode/packages/opencode/src/plugin/anthropic.ts`
- `/home/pkcs12/projects/opencode/packages/opencode/src/server/routes/provider.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/context/models.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.ts`

OUT:

- 不修改 runtime provider universe / transport plugin 行為
- 不重做 provider registry 設計
- 不處理所有歷史 `anthropic` 文案殘留

## 任務清單

- [x] 盤點文件層對 `claude-cli` 與 legacy `anthropic` 的目標邊界
- [x] 審查 provider registry、runtime provider 與 `/provider` route 是否仍以 `anthropic` 為 canonical
- [x] 審查 `plugin/anthropic.ts` 是否僅保留 transport / protocol impersonation
- [x] 審查 WebApp favorites / visibility / disabled-provider 邊界是否仍重用 `anthropic -> claude-cli` alias
- [x] 形成污染判定與後續風險結論
- [x] 以最小修補移除 favorites / visibility 偏好路徑中的誤導 alias
- [x] 驗證既有 disabled-provider regression 仍成立，且偏好邊界已切開

## Debug Checkpoints

### Baseline

- 文件已明定 `anthropic -> claude-cli` 只允許存在於 transport / protocol alias，不能外溢到 WebApp disabled-provider matching 或 favorites / provider-visibility gates。
- 使用者要確認的不是 repo 中是否仍存在 `anthropic` 字串，而是 `claude-cli` 的產品層 provider identity 是否仍被 legacy alias 污染。

### Instrumentation Plan

- 先讀 architecture、promotion 後 spec 與歷史事件檔，建立「理論上允許與禁止的邊界」。
- 再審查實作中四個邊界：
  - canonical provider registry
  - runtime/provider route
  - claude-cli transport plugin
  - WebApp model preferences / favorites / visibility normalization
- 僅把 `anthropic` 用於 SDK、model trait、協議偽裝視為可接受；若進入 canonical provider、provider gate、favorites、visibility，視為污染。

### Execution

- `specs/architecture.md` 已清楚定義：legacy alias 不得用於 disabled-provider matching 或 favorites / provider-visibility gates。
- `packages/opencode/src/provider/supported-provider-registry.ts` 以 `claude-cli` 作為 canonical provider；`packages/opencode/src/provider/provider.ts` 也已刪除 legacy `anthropic` provider，`/provider` route 採 registry-first 組裝。
- `packages/opencode/src/plugin/anthropic.ts` 仍使用 Anthropic SDK/header/協議，但 primary registration 已是 `claude-cli`，屬於允許的 transport / protocol alias。
- 初次審計確認的越界點在前端 favorites / visibility 偏好層，而非 disabled-provider gate。
- 修補後：
  - 新增 `packages/app/src/context/model-preferences.ts`，將偏好 provider normalization、remote preferences merge 與 key 計算抽成純邏輯 helper。
  - `packages/app/src/context/models.tsx` 改接新 helper，favorites / hidden 讀寫不再把 `anthropic` 折成 `claude-cli`。
  - `packages/app/src/components/model-selector-state.ts` 既有 `normalizeDisabledProviderKey()` 修補維持不變，disabled-provider regression 未回退。

### Root Cause

- cms 目前不是全面回退到 legacy `anthropic` provider；後端 canonical provider universe 已大致完成 migration。
- 根因是前端曾把 transport alias 重用到產品層偏好流程，導致 `anthropic` 與 `claude-cli` 在 favorites / hidden preference 邊界被視為同一身分。
- 這違反 architecture 中「transport alias 不得重用到 favorites / provider-visibility gates」的規則。
- 本次修補已將該 alias 從偏好流程移除，污染點已在 WebApp preferences 邊界收斂。

### Validation

- 文件證據：
  - `/home/pkcs12/projects/opencode/specs/architecture.md:147`
  - `/home/pkcs12/projects/opencode/specs/architecture.md:151`
  - `/home/pkcs12/projects/opencode/specs/_archive/account-management/slices/20260327_provider-llmgateway-bug/design.md:23`
  - `/home/pkcs12/projects/opencode/specs/_archive/account-management/slices/20260327_provider-llmgateway-bug/implementation-spec.md:21`
- 實作證據：
  - `/home/pkcs12/projects/opencode/packages/opencode/src/provider/supported-provider-registry.ts:25`
  - `/home/pkcs12/projects/opencode/packages/opencode/src/plugin/anthropic.ts:112`
  - `/home/pkcs12/projects/opencode/packages/opencode/src/server/routes/provider.ts:62`
  - `/home/pkcs12/projects/opencode/packages/app/src/context/model-preferences.ts:21`
  - `/home/pkcs12/projects/opencode/packages/app/src/context/model-preferences.ts:81`
  - `/home/pkcs12/projects/opencode/packages/app/src/context/models.tsx:102`
  - `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.ts:106`
- 測試：
  - `bun test /home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.test.ts` ✅
  - `bun test /home/pkcs12/projects/opencode/packages/app/src/context/model-preferences.test.ts` ✅

## 結論

- 判定：`claude-cli` 與 `anthropic` 的產品層偏好混用問題已完成修補。
- 乾淨區域：provider registry、runtime provider universe、`/provider` route、claude-cli transport plugin primary registration。
- 已修補區域：WebApp favorites / hidden / visibility 偏好流程不再把 `anthropic` 視為 `claude-cli` canonical alias。
- 殘留觀察：`packages/app/src/components/model-selector-state.ts` 的一般 provider grouping alias 仍存在，但本次未讓其再滲入 disabled-provider 與偏好持久化邊界。

## Architecture Sync

- Verified: `specs/architecture.md` 已有正確邊界規則，本次審計無新增架構變更。
