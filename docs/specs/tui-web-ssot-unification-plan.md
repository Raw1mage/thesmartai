# TUI/Web 單一事實來源（SSOT）統一工程計畫

Date: 2026-02-27
Status: Proposed
Owner: web-dev unification stream

## 1. 目標

將 Web App 與 TUI 的核心互動（Model Selector、Slash Commands、Session List）對齊到同一份行為規格與資料來源，避免雙軌制造成語義漂移與回歸。

## 2. 問題定義（現況）

1. **行為雙軌**：TUI 與 Web 各自實作同名功能，規則容易分岔。
2. **狀態雙軌**：model 偏好（favorite/hidden）曾同時存在 local 與 runtime state，導致不同 UI 顯示不一致。
3. **命令雙軌**：slash 的來源、過濾與呈現規則分散在不同層，無統一 adapter。

## 3. SSOT 原則

1. **行為 SSOT**：`packages/opencode/src/cli/cmd/tui/component/dialog-admin.tsx` 與 TUI command registry 行為作為基準。
2. **資料 SSOT**：`model.json`（favorite / hidden / hiddenProviders）與對應 server route 為唯一偏好來源。
3. **轉譯層唯一化**：Web 端僅透過 adapter 讀寫，不在 UI component 內重寫 business rule。

## 4. 範圍

### In Scope

- Model selector（provider/account/model 三欄 + showall/favorites）
- Slash commands（來源、可見性、去重、命令對標）
- `/session` 顯示結構（列表、分組、排序）

### Out of Scope（本輪）

- TUI 視覺主題 1:1 複刻
- 新功能開發（僅統一與修正）

## 5. 分階段計畫

### Phase A — Spec Freeze（1 天）

- 產出 parity matrix：逐條列 TUI 事實行為、Web 現況、差距。
- 凍結術語：
  - showall = no filter
  - favorites = curated set（由規格定義，不允許 component 私自解釋）
  - hide => unfavorite / favorite => show（三態約束）

**Deliverable**：`docs/specs/tui-web-parity-matrix.md`

### Phase B — State Unification（1–2 天）

- 將 model 偏好讀寫集中於 server route + adapter。
- 統一 provider/model key normalization（含 gmicloud、google-api 等 family alias）。
- 清理 UI 直接操作 raw store 的邏輯。

**Deliverable**：shared preference adapter + key normalization tests

### Phase C — UI Behavior Alignment（1–2 天）

- Model selector：只吃 adapter 輸出（provider/account/model rows）。
- `/session`：session-only 模式、分組、排序與 TUI 對齊。
- Slash：builtin/custom 合併規則、排除規則、名稱對標。

**Deliverable**：web parity pass（手動驗收清單全綠）

### Phase D — Parity Test Gate（1 天）

- 新增 parity tests：
  - model selector mode/filter/state invariants
  - slash command list snapshot/parity check
  - session list grouping/order rules
- 建立 CI gate（至少 app typecheck + parity tests）。

**Deliverable**：`packages/app/src/**/parity*.test.ts`

### Phase E — Handoff & Governance（0.5 天）

- 補齊 docs/events 變更脈絡。
- 撰寫 handoff 手冊，定義下個模型接手入口與必跑驗證。

**Deliverable**：`docs/handoff/tui-web-ssot-playbook.md`

## 6. 驗收標準（Done Criteria）

1. 同一組測試資料下，Web/TUI 在 in-scope 功能的行為結果一致。
2. 不再出現「同一功能兩套規則」的 inline 判斷。
3. 任一回歸可由 parity tests 在 CI 直接攔下。
4. 事件文件完整，後續模型可無縫接手。

## 7. 風險與緩解

1. **風險**：舊資料鍵值不一致造成 runtime crash。
   - 緩解：normalization 全面 null-safe + migration guard。
2. **風險**：UI 對齊過程誤改使用者已習慣互動。
   - 緩解：先做 feature-flag / staged rollout（可選）。
3. **風險**：跨模組修改範圍大，回歸面積大。
   - 緩解：Phase 化交付，每 phase 都 build/restart + checklist 驗收。

## 8. 執行指令基線

- `bun x tsc --noEmit --project packages/app/tsconfig.json`
- `./webctl.sh build-frontend && ./webctl.sh restart && ./webctl.sh status`
