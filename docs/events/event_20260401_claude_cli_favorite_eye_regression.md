# Event: claude-cli favorite eye regression

## 需求

- 修復 WebApp model manager 中 `claude-cli` provider row 的眼睛 icon 呈現 ban/鎖住狀態，導致無法從「全部」加入「精選」。
- 釐清 `claude-cli` 與 `anthropic` 的邊界，避免 transport alias 誤傷 WebApp provider gate。

## 範圍

IN:

- `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.test.ts`
- `/home/pkcs12/projects/opencode/specs/architecture.md`

OUT:

- 不修改 `packages/opencode/src/plugin/anthropic.ts` 的 transport/auth 邏輯
- 不修改 runtime provider loader
- 不重做 WebApp model manager UI

## 任務清單

- [x] 追查 WebApp model manager 眼睛 icon 的實際 gate
- [x] 確認 `claude-cli` 不是從「全部」消失，而是 provider row 被判成 disabled
- [x] 確認 legacy `disabled_providers: ["anthropic"]` 誤傷 `claude-cli`
- [x] 以最小修補拆開 disabled-provider matching 與 canonical alias
- [x] 新增 regression test
- [x] 重新驗證 WebApp 中 `claude-cli` 眼睛 icon 恢復正常
- [x] 同步 architecture 邊界文件

## Debug Checkpoints

### Baseline

- WebApp 中 `claude-cli` 仍出現在「全部」provider list。
- 但 provider 欄眼睛 icon 呈現 ban/鎖住狀態，無法正常加入「精選」。
- 使用者明確指出：`claude-cli` 與 `anthropic` 不能混為一談；`anthropic.ts` 只代表 transport path，不代表 provider identity。

### Execution

- 重新追查 `dialog-select-model.tsx` 後確認：眼睛 icon 本體沒有 HTML `disabled` prop；問題不在 button disabled，而在 provider row state。
- `ProviderItem` 的 icon 由 `provider.enabled` 控制；`provider.enabled` 來自 `buildProviderRows()` 的 `disabledProviders` matching。
- `buildProviderRows()` 原本使用 `normalizeProviderKey()` 處理 `disabledProviders`，而該函式含有 `anthropic -> claude-cli` alias。
- 實際 persisted global config 不含 `claude-cli` 於 `disabled_providers`，但含有 legacy `anthropic`。
- 結果是：WebApp disabled blacklist matching 把 `anthropic` 折成 `claude-cli`，導致 `claude-cli` provider row 被誤判為 disabled。
- 修補方式：
  - 保留 `normalizeProviderKey()` 給一般 canonical/provider grouping 路徑使用。
  - 新增 `normalizeDisabledProviderKey()` 專供 `disabledProviders` matching 使用，不再把 `anthropic` alias 成 `claude-cli`。
  - `buildProviderRows()` 的 `disabledFamilies` 改用 strict disabled normalization。
  - 新增 regression test：`disabledProviders: ["anthropic"]` 不會讓 `claude-cli` row disabled。

## Root Cause

- 這次 regression 不是 `claude-cli` provider 消失，也不是 server 把 `claude-cli` 回寫到 `disabled_providers`。
- 真正根因是前端把 **canonical alias** 和 **blacklist matching** 混用：
  - canonical/provider grouping 路徑允許 `anthropic -> claude-cli`
  - 但 disabled-provider matching 不應共享這條 alias
- 因此 legacy `disabled_providers: ["anthropic"]` 誤傷 `claude-cli`，讓 WebApp provider 欄眼睛 icon 長期呈現 ban 狀態。

## Validation

- `bun test /home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.test.ts` ✅
- 新增 regression test：`disabledProviders: ["anthropic"]` 不會讓 `claude-cli` provider row 變成 disabled ✅
- 使用者手動驗證：WebApp 中 `claude-cli` 的眼睛 icon 已恢復正常，可正常操作 ✅

## Architecture Sync

- Updated: `specs/architecture.md`
- 新增前端 canonical 邊界：`anthropic -> claude-cli` alias 不能用於 WebApp disabled-provider matching / favorites-provider gate。
