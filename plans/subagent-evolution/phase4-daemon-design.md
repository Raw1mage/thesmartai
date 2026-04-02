# Phase 4 Design: Daemon Agent Generic Interface

## 核心概念

Daemon 是一個主動出擊的長期常駐 agent，與 MCP 的差異：

| | MCP Server | Daemon Agent |
|---|---|---|
| 存活方式 | 等待被呼叫 | 主動執行感測 loop |
| 觸發 | 被動（tool call） | 主動（條件滿足）|
| 通知 | 無 | Bus event → operator |
| 生命週期 | 隨 session | 獨立，跨 session 存活 |

Daemon 的執行模型：

```
loop {
  sense()    // 用工具去外部撈資料
  judge()    // 評估條件（LLM 或 rule-based）
  if met:
    act()    // 通知 / 執行動作
  sleep(interval)
}
```

---

## 泛用 DaemonSpec 界面

```ts
interface DaemonSpec {
  // 識別
  name: string               // 唯一名稱，用於管理（stop/status）
  description: string        // 人類可讀說明

  // 感測（Sense）
  sense: DaemonSenseConfig

  // 判斷（Judge）
  condition: DaemonCondition

  // 動作（Act）
  action: DaemonAction

  // 生命週期
  interval_ms: number        // 感測間隔（預設 60000 = 1 分鐘）
  ttl_hours?: number         // 自動停止時限（無則永久）
  max_triggers?: number      // 觸發上限後自動停止
  active_hours?: { start: string; end: string }  // 同 cron active_hours
}
```

---

## Sense 配置類型

```ts
type DaemonSenseConfig =
  | { type: "http-poll"; urls: string[]; headers?: Record<string, string> }
  | { type: "file-watch"; paths: string[]; events: ("create" | "modify" | "delete")[] }
  | { type: "log-tail"; path: string; lines?: number }
  | { type: "tool-sequence"; tools: string[]; prompt: string }
  // tool-sequence: 讓 daemon agent 自由使用指定工具集撈資料
  // 這是最彈性的類型，例如電商監測就是 webfetch + bash
```

`tool-sequence` 是關鍵設計：daemon 的 sense 階段其實就是讓一個 mini-agent 跑一段工具調用，然後把結果交給 judge。這讓 daemon 可以做任何工具做得到的事，包括爬網頁、查 API、執行 script。

---

## Condition 評估類型

```ts
type DaemonCondition =
  | { type: "llm"; prompt: string; model?: string }
  // prompt 是給 LLM 的判斷指令，輸入是 sense 的結果
  // 回傳 { triggered: boolean, detail: string }
  
  | { type: "regex"; pattern: string; flags?: string }
  // 對 sense 輸出做 regex match
  
  | { type: "threshold"; field: string; op: ">" | "<" | ">=" | "<=" | "=="; value: number }
  // 結構化資料的數值比較
  
  | { type: "always" }
  // 每次 sense 都觸發，適合定期摘要型 daemon
```

電商標錯價的場景用 `llm` type 最自然：
```json
{
  "type": "llm",
  "prompt": "以下是 RTX 4090 的搜尋結果。市場行情約 NT$25,000。是否有商品售價低於市場行情 30% 以上？若有，回傳 triggered=true 和商品名稱、價格。"
}
```

---

## Action 類型

```ts
type DaemonAction =
  | { type: "notify"; template?: string }
  // 透過 Bus → announce channel 通知 operator
  // template 支援 {daemon_name}, {trigger_detail}, {timestamp}
  
  | { type: "notify-and-act"; notify_template?: string; act_prompt: string }
  // 通知 + 讓 daemon 繼續執行一段 agent 動作（例如自動加入購物車）
  
  | { type: "webhook"; url: string; method?: string; body_template?: string }
  // 打外部 webhook（Slack、Line Notify、自訂 API）
```

`notify-and-act` 是最強大的類型：條件滿足時 daemon 不只通知，還可以自主採取行動。這邊的 `act_prompt` 本質上是啟動一個 sub-agent（或讓 daemon 自己繼續跑工具調用）。

---

## 自然語言 → DaemonSpec 轉換

使用者口語啟動 daemon 的流程：

```
user: "幫我監測 pchome 的 RTX 4090，如果有標錯價低於兩萬就通知我"

main agent 解析 → DaemonSpec:
{
  name: "pchome-rtx4090-price-alert",
  description: "Monitor PChome RTX 4090 for price errors below NT$20,000",
  sense: {
    type: "tool-sequence",
    tools: ["webfetch"],
    prompt: "搜尋 PChome RTX 4090 的商品列表，取得所有商品名稱和價格"
  },
  condition: {
    type: "llm",
    prompt: "以下商品中是否有 RTX 4090 售價低於 NT$20,000？"
  },
  action: {
    type: "notify",
    template: "🚨 標錯價警報！{trigger_detail}"
  },
  interval_ms: 300000  // 每 5 分鐘
}
```

Main agent 產生 spec 後呼叫 `spawn_daemon(spec)`，立即回傳 daemon session ID，對話繼續。

---

## Lifecycle Management

透過工具或口語管理 daemon：

```
user: "列出現在跑著的 daemons"
→ list_daemons() → [{ name, status, last_trigger, next_check }]

user: "停掉價格監測"
→ stop_daemon("pchome-rtx4090-price-alert")

user: "暫停監測直到明天早上"
→ pause_daemon("...", until: "09:00")
```

這些都是工具調用，main agent 透過自然語言轉譯後執行。

---

## 架構整合

```
DaemonStore (agent-daemon.ts)
  ├── register(spec, sessionID)
  ├── recover() ← daemon/index.ts startup 呼叫
  ├── list() / get(name) / unregister(name)
  └── JSON persistence: ~/.config/opencode/daemon-sessions.json

DaemonRunner (agent-daemon.ts)
  ├── start(spec) → 啟動 sense-judge-act loop
  ├── stop(name)
  └── loop():
        sense → judge → if triggered: act → sleep

DaemonAgentEvent (bus)
  ├── Triggered: { daemonName, detail, timestamp }
  └── StatusChanged: { daemonName, status, reason }

delivery.ts (reuse cron announce path)
  └── DaemonAgentEvent.Triggered → announce to main session
```

---

## 與 Cron 的界線

| 特性 | Cron | Daemon |
|---|---|---|
| 觸發 | 時間排程 | 條件滿足 |
| 執行時間 | 短（一次性 prompt） | 長（常駐 loop） |
| 狀態 | 無狀態 | 有狀態（前後輪可比較） |
| 適用場景 | 定時報告、定時清理 | 監控、警報、爬蟲 |

兩者共用 `delivery.ts` 的 announce channel，但 DaemonRunner 是新的長期 process，不走 cron heartbeat。

---

## 電商標錯價 Demo 場景完整流程

```
1. user: "幫我盯著 pchome 和 momo 的 RTX 4090，有低於兩萬的話馬上告訴我"

2. main agent → spawn_daemon({
     name: "rtx4090-price-watch",
     sense: { type: "tool-sequence", tools: ["webfetch"], 
              prompt: "fetch PChome & Momo RTX 4090 listings" },
     condition: { type: "llm", 
                  prompt: "任何商品售價 < NT$20,000?" },
     action: { type: "notify", template: "💰 {trigger_detail}" },
     interval_ms: 180000  // 每 3 分鐘
   })

3. main agent: "好，已啟動監測 daemon (rtx4090-price-watch)，每 3 分鐘查一次。"

4. [背景 loop 跑著...]
   - sense: webfetch pchome, momo
   - judge: LLM 評估 → triggered = true, detail = "PChome 顯示卡館 RTX 4090 NT$12,900"
   - act: Bus.publish(DaemonAgentEvent.Triggered, { detail })

5. [main session 收到 Bus event]
   → TUI/Web 通知：💰 PChome 顯示卡館 RTX 4090 NT$12,900
```

---

## Open Questions（待後續設計）

1. **Daemon 的 sense 階段用什麼 model？** tool-sequence 類型需要一個 mini-agent 跑工具，這個 agent 要用 small model（便宜）還是 parent model（準確）？建議預設 small model，condition 的 judge 階段如果是 `llm` 類型可以用更好的 model。

2. **Daemon 間的資源競爭？** 多個 daemon 同時跑可能同時觸發 webfetch，需要 rate limiting 或 lane 管理。

3. **Stateful sense：前後輪比較？** 某些監測需要「與上一輪比較」（例如「價格下降超過 10%」），sense 結果的 state 要怎麼 persist？建議 DaemonRunner 維護 per-daemon `lastSenseResult`。

4. **Act 的 sub-agent 授權？** `notify-and-act` 的 act_prompt 如果執行危險操作（自動購買、發送訊息）需要 permission 機制。
