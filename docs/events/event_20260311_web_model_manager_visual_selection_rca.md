# Event: Web model manager visual selection RCA

## 需求

- 釐清 Web「模型管理員」為什麼看起來會出現所見非所得。
- 確認截圖中模型列的反白、勾選、footer 當前模型是否來自不同 state。

## 範圍

### IN

- `/home/pkcs12/projects/opencode/packages/app/src/components/dialog-select-model.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/components/model-selector-state.ts`
- `/home/pkcs12/projects/opencode/packages/app/src/context/local.tsx`
- `/home/pkcs12/projects/opencode/packages/app/src/pages/session.tsx`
- `/home/pkcs12/projects/opencode/packages/ui/src/components/list.tsx`
- `/home/pkcs12/projects/opencode/packages/ui/src/components/list.css`

### OUT

- 不修改 runtime fallback / rotation3d
- 不修改 session-local model sync contract
- 不直接修 UI，先完成 RCA

## 任務清單

- [x] 讀取 architecture 與相關歷史 events
- [x] 盤點 model manager 選中 state / current state / session-local state
- [x] 比對 `List` 元件的 active 與 selected 視覺語意
- [x] 確認 root cause 是否為真實 state mismatch 或純視覺誤導
- [x] 完成 event 與 architecture sync 檢查

## Debug Checkpoints

### Baseline

- 使用者提供截圖：模型管理員中看起來高亮的是 `GPT 5.1 Codex Mini`，但同一畫面右下 footer 顯示目前模型為 `GPT 5.4`。
- 截圖中 `GPT 5.4` 右側同時可見 check icon，而 `GPT 5.1 Codex Mini` 帶有深色底。
- 需判斷這是 state 真分裂，還是 UI 把不同語意畫得太像。

### Instrumentation / Evidence

- `packages/app/src/components/dialog-select-model.tsx`
  - provider/account 初始定位來自 `local.model.selection(params.id)`。
  - model list 的 `current` 來自 `currentFilteredModel()`，而 `currentFilteredModel()` 由 `local.model.current(params.id)` 推導。
- `packages/app/src/context/local.tsx`
  - `selection(sessionID)` 與 `current(sessionID)` 都走同一個 scoped selection key；`current()` 只是把該 selection key resolve 成 model object。
  - 代表 footer 與 model manager 的 current source 並未天然分叉。
- `packages/app/src/pages/session.tsx`
  - session page 會從最後一筆 user message 與最後 completed assistant message 同步 session-local model selection。
  - 這條 contract 已在 2026-03-11 的 footer rotation sync 事件中補齊。
- `packages/ui/src/components/list.tsx`
  - list item 同時有兩種不同屬性：
    - `data-active={props.key(item) === active()}`
    - `data-selected={item === props.current}`
  - `data-active` 來自滑鼠移動 / 鍵盤游標焦點；`props.current` 才是目前真正 selected/current item。
- `packages/ui/src/components/list.css`
  - `[data-slot="list-item"][data-active="true"]` 會套用 hover-like 背景 `background: var(--surface-raised-base-hover)`。
  - `data-selected` 沒有獨立背景樣式；selected 只會在 `list.tsx` 額外渲染 `list-item-selected-icon`（check icon）。

### Root Cause

- 本案根因不是 session-local model state、footer model state、或 runtime execution identity 再次分裂。
- 真正根因是 **List 元件把「active/focused item」與「selected/current item」用兩套不同語意表示，但視覺上 selected 幾乎只有 check icon、active 卻有整列背景**。
- 因此當滑鼠停在 `GPT 5.1 Codex Mini` 時：
  1. `GPT 5.1 Codex Mini` 取得 `data-active="true"`，出現整列反白底色。
  2. 真正 current item `GPT 5.4` 仍透過 check icon 被標記為 selected。
  3. footer 同樣讀取 session-local current model，所以顯示 `GPT 5.4`。
  4. 使用者視覺上會把「有底色的 active row」誤認為「目前已選定 row」，形成所見非所得。

### Validation

- 文件驗證：
  - `docs/ARCHITECTURE.md`
  - `docs/events/event_20260310_session_scoped_provider_account_model.md`
  - `docs/events/event_20260311_web_footer_rotation3d_model_sync.md`
  - `docs/events/event_20260311_session_model_rotation_regression.md`
- 程式證據驗證：
  - `packages/app/src/components/dialog-select-model.tsx`
  - `packages/app/src/context/local.tsx`
  - `packages/app/src/pages/session.tsx`
  - `packages/ui/src/components/list.tsx`
  - `packages/ui/src/components/list.css`
- 結論：
  - footer 與 model manager current source 一致；沒有找到新的 execution identity 漂移證據。
  - 問題屬於 UI semantics / styling mismatch：active row 太像 selected row。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅完成 UI/RCA，未改變 session identity、model sync、provider/account/model 邊界或 runtime contract。
