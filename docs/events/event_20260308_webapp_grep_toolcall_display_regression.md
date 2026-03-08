# Event: webapp grep toolcall display regression

Date: 2026-03-08
Status: Completed

## 需求

- 釐清為何 webapp 的 grep tool call trigger 仍出現文字顯示異常。
- 修正 grep tool call header/trigger，讓其顯示穩定且不再被裁切。
- 最終收斂為 shared trigger 可穩定承載的單行 task summary，而不是把詳細參數塞進 trigger。

## 範圍 (IN / OUT)

### IN

- `packages/ui/src/components/message-part.tsx`
- 必要的 event / validation 記錄

### OUT

- grep tool 的後端輸出格式
- 其他 tool call 類型的語意變更
- 非 grep tool call 的整體 session feed 視覺重設計

## 任務清單

- [x] 盤點現行 grep toolcall renderer 與 prior fix
- [x] 找出仍會異常顯示的真正成因
- [x] 以最小修改修正 grep trigger 排版
- [x] 將 grep trigger 收斂為單行 shared task summary
- [x] 驗證 typecheck / 需要的 UI 行為
- [x] 確認 `docs/ARCHITECTURE.md` 是否需要同步

## Debug Checkpoints

### Baseline

- 症狀：webapp 中 grep toolcall trigger 仍可能出現路徑/參數文字上下擠壓、換行後裁切或與其他欄位搶位的現象。
- 已知背景：同日已有一次 `wrap-friendly` / `wrap-layout` 修正，但使用者回報顯示問題持續存在，代表先前修正只處理了部分換行情境，未觸及最外層 trigger 佈局限制。

### Execution

- 確認先前修正仍沿用 `BasicTool` 的單列結構化 trigger：即使對 subtitle / arg 放寬換行，grep 仍把 `title + subtitle + args` 全塞在同一個 `info-main` flex row 內。
- 真正成因不是單一文字斷行規則，而是 grep 的資訊量明顯高於其他 tool call；在同一 row 內混放路徑與多個 args 時，`overflow: hidden` 與 row-based flex 壓縮仍會造成高度/寬度競爭，所以畫面看起來像被裁掉或擠壓。
- 依使用者追問重新檢視 shell tool call 後確認：shared trigger 的責任只是穩定顯示一條 task line；shell 能承載多行細節，是因為細節放在展開後的 content pane，而不是 trigger。
- 因此最終收斂方案改為：grep 不再嘗試在 trigger 內顯示多行參數卡片，改回 shared compact trigger，只提供單行 summary（path / pattern / include 摘要，超長則交由既有單行截斷規則處理）。
- 這樣不會影響 grep 功能本身，因為詳細結果仍在 tool output；也更符合 shared trigger 原本只顯示 task line 的設計目的。
- 後續實機觀察發現 grep subtitle 仍沿用 shared subtitle 的預設兩行 clamp，因此在長摘要下還是會掉成雙行。補充修正為 grep 專用 `single-line-ellipsis` class，強制回到單行 `…` 截斷。

### Validation

- 驗證指令：`bun turbo typecheck --filter @opencode-ai/ui --filter @opencode-ai/app`
- 結果：passed
- 重啟驗證：`./webctl.sh dev-refresh` 與 `./webctl.sh status`
- 結果：server healthy (`{"healthy":true,"version":"local"}`)
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅調整 grep tool call 的前端 trigger 摘要呈現，未變更架構邊界、runtime data flow、API contract 或模組責任。
