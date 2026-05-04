# Observability: question-tool-input-normalization

## Events

> 下列事件分類為 Logs / Metrics / Alerts / Trace Points。

## Logs

### New / modified

- **`service=tool.framework event=preprocess-applied`**（DEBUG 層級，可選）
  - `Tool.define` execute wrapper 當 `parse()` 返回值結構不等於 raw args 時，log 一次告知 preprocess/transform 生效。
  - 欄位：`tool` (id), `callID?`, `diff` (optional, keys changed)
  - 目的：下次 tool schema 有 preprocess bug 時可直接從 log 看是否有跑到
  - 非必要，若實作成本高可略

- **`service=session.processor event=tool-result-normalized`**（DEBUG）
  - Processor tool-result handler 成功 safeParse 後 log。
  - 欄位：`tool`, `callID`, `rawEq` (boolean, whether raw === parsed)
  - 目的：驗證 DD-3 真的在新 session 寫 normalized

- **`service=session.processor event=tool-result-normalize-miss`**（WARN）
  - ToolRegistry lookup miss 或 safeParse 失敗（後者理論不可能但防禦性 log）。
  - 欄位：`tool`, `callID`, `reason` (`registry-miss` | `parse-failed`)
  - Alert 門檻：1 天內 >10 次 → 代表 registry 或 schema 有實質問題

- **`service=ui.question event=defensive-normalize-hit`**（DEBUG, 前端 console）
  - 三個 UI renderer 跑 `Question.normalize()` 後發現 normalized shape 與 input 結構不同（代表讀到 raw 舊 session）。
  - 欄位：`surface` (`dock` | `message-part` | `tui`), `messageID`, `callID`
  - 目的：觀察舊 session reload 比例，判斷何時可以清掉 defensive 層

- **`service=ui.question event=unnormalizable-input`**（ERROR, 前端 console + telemetry）
  - Question.normalize 後 `questions.length === 0` 或 undefined。
  - 欄位：`surface`, `messageID`, `callID`, `inputSample` (truncated)
  - Alert：任何 occurrence 都要 review（符合 ERR-QT-05 禁止靜默的要求）

### Unchanged

- `service=question event=asking/aborted/replied/rejected`（來自 question-tool-abort-fix）保持
- `service=tool.framework event=validation-error`（現行 formatValidationError 路徑）保持

## Metrics

### Counter

- `question_tool_preprocess_applied_total{tool="question", shape}`
  - labels: `shape` ∈ `flat` / `array_string_options` / `canonical`
  - 目的：長期觀察 LLM noncompliant 比例；canonical 比例上升代表 LLM 正在學乖
- `question_tool_unnormalizable_total`
  - 任何 UI 遇到 unnormalizable 都 +1；應接近 0

### Gauge

- 無新增

## Alerts

- **`QuestionToolUnnormalizable`**
  - Trigger：`question_tool_unnormalizable_total` 一小時內 > 0
  - Severity：P2
  - Runbook：讀對應 session message 檢查 `state.input` 實際形狀 → 決定是補 normalize 規則還是 LLM prompt 問題

- **`ToolResultNormalizeMiss`**
  - Trigger：`service=session.processor event=tool-result-normalize-miss` 24h 內 > 10
  - Severity：P3
  - Runbook：可能是 plugin / custom tool 載入 race；查 ToolRegistry 載入順序

## Trace Points

無新增 distributed trace span；現有 tool-call / tool-result event 的 span（若有）足夠。

## Session Replay

本 spec 影響 session replay 的視覺呈現：

- 新 session：`state.input` 已 normalized，replay 時 UI 直接 render
- 舊 session：`state.input` 仍 raw，replay 時 UI `Question.normalize` defensive 處理；無需 backfill

Replay 驗證方式（手動）：

1. 找 2026-04-20 之前的 session（例如 `ses_25b16719fffejShr48aGTkRcEk`）
2. 在 webapp 打開該 session
3. 預期：歷史訊息中的 question tool part 渲染正常（不再空白），且前端 console 有 `defensive-normalize-hit` log

## Capacity Considerations

- DD-3 每次 tool-result 增加一次 `safeParse`；已知 tool 數 ~20、QuestionTool zod schema 不大（<10 欄位），CPU cost 可忽略
- UI `Question.normalize` 每次 render pass 跑一次；pure function、O(questions.length × options.length)，對常見情境 <10 items，negligible
- 不改變 on-disk storage footprint（normalized shape 比 raw 略大但同數量級）
