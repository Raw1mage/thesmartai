# Vision: Subagent Evolution & Autonomous Operation

記錄本次討論產生的所有想法，作為後續設計與實作的參考基礎。

---

## 一、Cache 架構重新認識

### Content-based vs State-reference

兩種根本不同的 cache 機制：

- **Anthropic / Gemini**：content-based。Cache key 是內容 hash + API key。任何 process、任何 session，送一樣的 prefix 內容就命中。跨 process 透明，不需要 ID。
- **Codex（Responses API）**：state-reference。Cache key 是 `previousResponseId`。不認內容，只認 ID。同樣內容不帶 ID = 全部重寫，不是命中。

### 目前 V2 context sharing 的問題

Child session 啟動時 prepend 完整 parent history（avg 100K tokens）：

- Anthropic/Gemini：content cache hit → 便宜，設計有效
- Codex：全部重寫，100K token cache write → 每次 subagent 啟動都付出大代價

### 解法層次

1. **Codex fork**：dispatch 時傳遞 parent `previousResponseId`，child 從 parent 的雲端 state 繼續，第一 round 只送 `[separator + task]`
2. **Checkpoint-based dispatch**（provider-agnostic）：dispatch 時讀 parent 的 rebind checkpoint（summary ~4K + recent steps），有就用，沒有就 fallback full history
3. 兩者可疊加：Codex 走 fork（最優），non-Codex 走 checkpoint（減量）

---

## 二、Subagent 存在意義的重新定位

### 對話式開發不適合 subagent

- V2 context sharing 把整份 parent history 送過去，「context 隔離」的好處蕩然無存
- Single-child invariant → 無平行，sequential 跑 subagent 沒有速度優勢
- Subagent 完成後 parent 還要複述一遍 → double overhead
- **結論：單線程對話式開發，直接讓 main agent 做更有效率**

### 真正適合 subagent 的場景

| 類型 | 說明 | 適合原因 |
|---|---|---|
| **Executor** | 執行完整 plan/spec，做完回來 | 任務邊界清晰，context 可精簡為 spec 本身 |
| **Researcher** | explore、gather、summarize | 資訊量大，適合隔離；理想上可平行 |
| **Daemon** | 長期常駐，條件觸發 | 完全不同 lifecycle，非 request-response |

Cron 是已實作的排程型 agent，不算 subagent，獨立管理。

---

## 三、Subagent Model Tier Routing

各類型 subagent 不需要用同一個 model：

- `researcher` / `explorer` → small model（haiku、flash、gpt-5-mini）
- `coding` / `executor` → parent model（保持品質）
- `daemon` → small model（長期常駐，省成本）
- `params.model` 明確指定時永遠優先

基礎設施已存在（`resolveSmallModel()`、`SMALL_MODEL_PRIORITY`），只需加 tier routing 邏輯。

Open question：by-subsession 的 model usage 監測與管理，是獨立的新需求，本 plan 不涵蓋。

---

## 四、Daemon Agent 泛用界面

### 與 MCP 的本質差異

| | MCP Server | Daemon Agent |
|---|---|---|
| 觸發 | 被動（等工具呼叫） | 主動（自己跑 loop） |
| 存活 | 隨 session | 獨立常駐，跨 session |
| 通知能力 | 無 | Bus event → operator |
| 資料來源 | 接受請求 | 主動去撈 |

Daemon 更接近 Grafana/Prometheus/Watcher 的概念，但感測邏輯是用 LLM + 工具調用實現，而非固定 query。

### 執行模型

```
loop {
  sense()   // 用工具撈資料（webfetch、file watch、bash、log tail...）
  judge()   // 評估條件（LLM 語意判斷 或 regex/threshold rule）
  if met:
    act()   // 通知 / 執行動作 / 啟動 sub-agent
  sleep(interval)
}
```

### 關鍵設計：tool-sequence sense 類型

Daemon 的 sense 階段不是固定 adapter，而是讓一個 mini-agent 自由使用工具撈資料。這讓 daemon 的能力邊界等於工具集的能力邊界——任何工具做得到的感測都可以做。

### 應用場景舉例

- 電商標錯價監測（webfetch + LLM 判斷）
- auth.log 異常登入警報（log tail + regex）
- CI/CD pipeline 狀態監控（API polling）
- API quota 即將耗盡通知（threshold）
- 競品價格追蹤（webfetch + 結構化比較）
- 服務健康監控（HTTP ping + threshold）

---

## 五、Daemon 作為 Autonomous Runner 的解法

### 之前為何做不起來

Autonomous runner 嘗試讓 main session **從內部自己循環**——但 main session 的架構是 request-response，每輪結束就等待輸入，沒有辦法自驅動。所有試圖在 session 內部做 loop 的方案都在跟這個基本限制搏鬥。

### Daemon 的切入角度

**從外部注入下一輪的觸發**，main session 架構完全不需要改：

```
main session: 完成一個 step → idle
                          ↓
daemon: 偵測到 idle + tasks.md 還有未完成項目
                          ↓
daemon: 注入新 user message → "繼續執行下一個任務：X"
                          ↓
main session: 收到輸入 → 開始下一輪工作
                          ↓
              [repeat until done]
```

Main session 的「user」從人類變成了 daemon。架構完全相容，不需要修改 session lifecycle。

### 授權模型

這是讓 autonomous runner 安全可用的關鍵：

- **任務範圍授權**：「執行這個 plan 直到完成」
- **停止條件**：tasks.md 全部打勾、遇到 stop gate、連續錯誤超過閾值
- **人在迴路**：遇到 stop gate 或需要決策時，daemon 暫停並通知人類，等待確認後繼續
- **緊急中止**：隨時可口語停止 daemon

### Daemon sense 對象：opencode 自身

Daemon 不只能監測外部系統，也可以監測 opencode 內部狀態：

- Session idle 狀態（Bus event）
- tasks.md 進度（file watch）
- 當前 session 的 tool call 結果
- ProcessSupervisor 的 worker 狀態

這讓 daemon 成為真正的「工作推進者」，而不只是外部事件的監聽者。

### 與現有 Stage 5（Drain-on-Stop）的關係

Stage 5 嘗試在 session 內部做「執行完 pending todos 再停」，結果遇到無限迴圈問題而停用。Daemon 的方案從外部推進，避開了 session 內部狀態機的複雜性，是更乾淨的替代路徑。

---

## 六、Daemon 的衍生可能

### Session Watchdog

一隻 daemon 專門監控所有 session 的健康狀態，偵測：
- Worker 卡住（ProcessSupervisor stalled）
- 超過時間沒有進展
- 錯誤率異常

自動採取行動：重試、通知、清理。

### Multi-session Coordinator

多個 session 在跑時，一隻 coordinator daemon 可以：
- 監測各 session 完成狀態
- 在依賴滿足時啟動下一個 session
- 彙整多個 session 的結果

這是一個輕量版的 workflow orchestrator，用 daemon 的語意來描述。

### 自我監控 Daemon

一隻 daemon 監測 opencode 自身的 token 用量、cost、cache 命中率，在異常時通知或自動調整模型選擇。

---

## 七、Open Questions

1. **Daemon 的 stateful sense**：前後輪比較（「價格下降 10%」）需要 persist 上一輪的 sense 結果，DaemonRunner 需要維護 `lastSenseResult`
2. **多 daemon 資源競爭**：同時跑多隻 daemon 時的 rate limiting 和 lane 管理
3. **`notify-and-act` 的授權**：daemon 主動執行動作（購買、發訊息）需要精細的 permission 機制
4. **Autonomous runner daemon 的 stop gate 解析**：tasks.md 的 stop gate 是文字，需要 LLM 判斷是否觸發，這是額外的 LLM 調用成本
5. **By-subsession model usage 監測**：各 subagent 用了多少 token / cost，目前沒有細粒度的統計
6. **Parallel subagent（Researcher 類型）**：放寬 single-child invariant 的 race condition audit 尚未完成
