# Event: webapp shell tool scroll lock

Date: 2026-03-08
Status: Completed

## 需求

- 修正 webapp session feed 中 shell/bash tool call 會搶走畫面捲動控制、把使用者卡在局部區塊的問題。
- 修正後，每次完成 webapp 代碼修改都要透過 `webctl.sh` 的 dev 啟動路徑重啟驗證。
- 進一步壓低 shell tool call 自身對閱讀流程的破壞性，避免巨大 bash output 區塊成為視覺與捲動干擾源。

## 範圍 (IN / OUT)

### IN

- `packages/ui/src/components/message-part.tsx`
- `packages/ui/src/components/message-part.css`
- 必要的 event / validation 記錄

### OUT

- shell tool 的後端執行邏輯
- session feed 其他非 shell tool 的排版重構
- 非 webapp 的 TUI scroll 行為

## 任務清單

- [x] 檢查 shell tool output 與 session auto-scroll 的互動路徑
- [x] 建立最小修正，避免 shell tool output 形成 nested scroll jail
- [x] 讓 shell tool output 即使展開 tool call 也先以有限高度 preview 呈現，必要時再二次展開完整內容
- [x] 透過 webctl dev 啟動路徑重啟並驗證
- [x] 確認 `docs/ARCHITECTURE.md` 是否需要同步

## Debug Checkpoints

### Baseline

- 症狀：webapp 中 shell/bash tool call 常把滾輪/觸控捲動卡在工具輸出區，導致主 session feed 像是被搶走畫面鎖定權，使用者會停在一個不上不下的位置。
- 觀察：bash tool renderer 目前把輸出區標成 `data-scrollable`，搭配 `tool-output` 的 `max-height: 240px; overflow-y: auto;`，會產生 nested scroll container。
- 風險：當游標停在 shell tool output 上方時，瀏覽器會優先捲動內層容器，造成 session 主滾動區閱讀體驗中斷。

### Execution

- 進一步確認問題與 `Expand shell output by default` 設定有關：當 bash tool parts 預設展開時，session feed 會更頻繁出現內層 shell output 捲動區，放大 nested scroll jail 問題。
- 最小修正分兩層：
  - 移除 bash tool output 的 `data-scrollable`，讓 shell output 不再建立內層滾動容器，避免搶走主 session feed 的滾輪/觸控捲動控制。
  - 將 webapp `shellToolPartsExpanded` 預設值改為 `false`，降低新 session / 新使用者一進入就被大量展開 shell blocks 干擾閱讀的機率。
- 既有已保存的使用者設定若已手動設成 `true`，仍會沿用原值；本次 default 調整主要影響新預設與未保存此設定的情境。
- 依使用者回報補做第二層止血：即使使用者仍保留 `Expand shell output by default = true`，bash tool block 也不應直接把整段長輸出完全攤平在主 feed。
- 新增 bash output preview clamp：shell tool call 打開後先以有限高度顯示，超出時在區塊底部顯示展開按鈕；此做法避免回到 nested scroll，也降低巨大 shell block 對 session feed 的視覺霸佔。

### Validation

- 驗證指令：`bun turbo typecheck --filter @opencode-ai/ui --filter @opencode-ai/app`
- 結果：passed
- 重啟驗證：`./webctl.sh dev-start`
- 結果：server restarted successfully（pid 57402）
- 補充：本次同時將 `shellToolPartsExpanded` 預設改為 `false`；但若使用者本機已保存為 `true`，仍需在 UI 中手動關閉一次才會立即生效。
- 後續補充驗證：`./webctl.sh dev-refresh`
- 結果：frontend rebuilt and dev server healthy (`./webctl.sh status` => `{"healthy":true,"version":"local"}`)
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅調整前端 session feed 的 bash tool output 呈現/互動與設定預設值，未改變系統架構、API contract 或 runtime module responsibility。
