# Event: expandable cards bottom collapse affordance

Date: 2026-03-10
Status: In Progress

## 需求

- 對 webapp session 中具有「展開」動作的小卡片/區塊，補上一個位於底部的「收合」入口。
- 避免使用者在展開很長內容後，必須一路回捲到頂端才能收合。

## 範圍 (IN / OUT)

### IN

- `packages/ui/src/components/session-turn.tsx`
- `packages/ui/src/components/session-turn.css`
- `packages/ui/src/components/basic-tool.tsx`
- `packages/ui/src/components/basic-tool.css`
- `packages/ui/src/components/message-part.tsx`
- `packages/ui/src/components/message-part.css`
- 必要 event / validation / architecture sync 記錄

### OUT

- 不重做整體 card 視覺系統
- 不調整後端資料結構

## 任務清單

- [x] 盤點目前有頂部展開/收合 trigger 的 session card 類型
- [x] 定義可重用的底部收合 affordance 方案
- [x] 先覆蓋 session turn steps 展開區塊
- [x] 視共用性補覆蓋 tool / output card
- [x] 驗證互動與文檔同步

## Debug / Design Checkpoints

### Baseline

- 現況中，多個區塊只在頂部提供展開/收合 trigger。
- 當內容很長時，使用者需要回到區塊頂端才能收合，操作成本高。
- 使用者明確點名的高優先場景是 session turn 的「隱藏步驟 / 展開步驟」區塊。

### Design intent

- 底部收合入口應是次要但清楚的 affordance：
  - 只在內容已展開時顯示
  - 視覺上隸屬同一張卡/區塊
  - 不破壞既有頂部 trigger 的語意

### Execution

- 先覆蓋使用者明確點名的長內容場景：
  - `session-turn.tsx` 展開步驟區塊底部新增 `隱藏步驟` 按鈕
- 同步補齊兩種常見可展開小卡片：
  - `basic-tool.tsx` 的各種工具卡 `Collapsible.Content` 底部新增共用 `收合訊息` 按鈕
  - `message-part.tsx` 的 bash output / user message 展開態底部新增 `收合訊息` 按鈕
- 視覺原則：
  - 已展開時底部按鈕置中
  - 仍保留原本頂部 trigger 作為主要入口
  - bash output 展開態會隱藏原本浮動右下角 expand/collapse 泡泡，避免與底部按鈕重複

### Validation

- 驗證指令：`bun turbo typecheck --filter @opencode-ai/ui`
- 結果：passed
- 目前覆蓋範圍：
  - `session-turn` 的 steps 展開區塊
  - `BasicTool` 展開卡
  - `BashToolOutput` 展開輸出
  - `UserMessageDisplay` 展開訊息框
- 已知備註：
  - `git diff` 中 `session-turn.*` / `message-part.tsx` 同時包含本 session 既有未提交變更；本次新增的直接變更為底部收合按鈕與其樣式，不包含新的資料流或後端契約。
- Architecture Sync: Verified (No doc changes)
  - 依據：本次僅新增前端互動 affordance，未改變模組邊界、狀態機責任或 runtime architecture contract。
