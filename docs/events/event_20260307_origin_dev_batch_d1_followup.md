# Event: origin/dev Batch D1 follow-up

Date: 2026-03-07
Status: In Progress

## 需求

- 延續 `origin/dev` → `cms` 的 low-risk / high-value refactor-port
- 補齊尚未完整落地的 Batch D1 app/ui 細修項目
- 維持 rewrite-only，不直接搬運 upstream patch

## 範圍

### IN

- `packages/ui/src/components/file-icon.tsx`
- `packages/app/src/components/session/session-sortable-tab.tsx`
- `packages/app/src/components/settings-providers.tsx`
- 驗證本輪 app/ui 低風險修補是否可安全通過 typecheck

### OUT

- 不處理高風險 TUI navigation / task UX
- 不處理 provider/runtime 核心流程
- 不直接 merge / cherry-pick upstream commit

## 任務清單

- [x] 重新比對 `docs/ARCHITECTURE.md`
- [x] 重新檢查 D1 候選檔案與 upstream intent
- [x] 補齊 file icon 單色穩定渲染
- [x] 重新確認 provider settings 的 opencode-go 顯示一致性（目前 cms 已無內嵌 tagline；不需額外 patch）
- [x] 補齊 `mod+f` file viewer search 行為的 cms 對應修正
- [x] 執行 typecheck 驗證
- [x] 更新 Validation 與 Architecture Sync 記錄

## Debug Checkpoints

### Baseline

- Working tree baseline: clean (`git status --short --branch` 僅顯示 `## cms...raw1mage/cms [ahead 4]`)
- `8cbe7b4a0` upstream intent 已確認：file icon stability 主要是避免 icon overlay/filter 造成不穩定顯示
- cms 現況僅已有 `file-icon.css` 的 `display: block`，但 `file-icon.tsx` 尚未支援 monochrome mask rendering，session tab 仍以雙 icon overlay 模擬 mono 狀態
- 針對 `3448118be` 的 upstream intent 重新比對後，發現 cms 現況已無 `file-tabs.tsx` 本地 `mod+f` handler；等價邏輯已集中在 `packages/ui/src/components/code.tsx` 的 `installFindShortcuts()`

### Execution

- 已將 `packages/ui/src/components/file-icon.tsx` 補齊 `mono?: boolean` 支援，改用 `mask + currentColor` 產生單色 icon，避免用 CSS filter 模擬造成的顯示不穩定。
- `packages/app/src/components/session/session-sortable-tab.tsx` 的疊層 icon 已改為讓第二層明確傳入 `mono`，使 inactive tab 的 file icon 路徑與新版穩定渲染一致。
- `packages/ui/src/components/tabs.css` 已移除 `.tab-fileicon-mono` 的 `grayscale(1)`，避免在真正單色渲染路徑上再套一層不必要 filter。
- 重新檢查 `packages/app/src/components/settings-providers.tsx` 後，發現 cms 現況已只有 `Recommended` tag，並未保留先前懷疑的 `dialog.provider.opencodeGo.tagline` 內嵌文案；上游 `note` key 也尚未在 cms locale 中落地，因此本輪不再強行補 patch。
- 針對 `3448118be`，採 cms 現況等價修正：移除 `packages/ui/src/components/code.tsx` 中 `installFindShortcuts()` 對 `event.defaultPrevented` 的提早退出，讓 `mod+f` 在 prompt 未聚焦或其他層先標記 prevented 時，仍可穩定開啟目前 file/code viewer 的搜尋框。

### Validation

- `bun run typecheck` 通過（`Tasks: 16 successful, 16 total`）。
- Targeted diff confirms this round only changed:
  - `packages/ui/src/components/code.tsx`
  - `packages/ui/src/components/file-icon.tsx`
  - `packages/app/src/components/session/session-sortable-tab.tsx`
  - `packages/ui/src/components/tabs.css`
  - `docs/events/event_20260307_origin_dev_batch_d1_followup.md`
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪僅調整 app/ui 呈現層 icon rendering 與 D1 event ledger，未改動 provider/account/session/runtime 架構邊界。
