# Spec: subagent-quota-safety-gate

## Purpose

防止 subagent 把 pinned account 的 5H / weekly quota 燒盡：runtime 在 subagent 每輪 tool-call 邊界檢查剩餘額度，低於門檻（預設 5%）即強制終止該 subagent，並以 SharedContext + runtime 自動產的結構化摘要回給 parent。

觀測 tool（`get_my_current_usage` + `get_system_status` 擴充）為附屬功能，服務主 agent / 早期自查用途 — **不是主線防護機制**。

---

## Requirements

### Requirement: Runtime quota gate 在 subagent tool-call 邊界強制檢查

**Purpose**：subagent 不能因為自己不自律就把帳號燒穿。

#### Scenario: 門檻內，subagent 正常執行
- **GIVEN** subagent pinned 到 codex `acc_42`，5H 剩 12%、weekly 剩 40%
- **AND** `subagent.quota_gate_enabled = true`、`threshold = 5`
- **WHEN** subagent 結束一輪 tool-call 準備發下一筆 provider request
- **THEN** gate 讀 quota cache → 兩個 window 都 > 5%
- **AND** subagent 正常繼續下一輪

#### Scenario: 5H 跌破門檻，gate 觸發
- **GIVEN** subagent pinned 到 `acc_42`，5H 剩 3%
- **WHEN** subagent 結束一輪 tool-call 準備發下一筆 provider request
- **THEN** gate trip：runtime 以 `CancelReason = "quota-gate-trip"` 終止 subagent runloop
- **AND** subagent 的 LLM **不再**有機會發任何請求
- **AND** task tool 對 parent 的回傳包含 `{tripped: true, reason: "quota-gate-trip", triggerWindow: "5h", remainingPercent: 3, sharedContext, structuredSummary}`

#### Scenario: Weekly 跌破門檻也觸發
- **GIVEN** 5H 還有 80% 但 weekly 剩 4%
- **WHEN** 同上
- **THEN** gate trip，`triggerWindow: "weekly"`，其餘行為同上

#### Scenario: 兩個 window 都跌破，取更嚴重的回報
- **GIVEN** 5H 剩 2%，weekly 剩 3%
- **WHEN** 同上
- **THEN** gate trip，`triggerWindow: "5h"`（較低者）、`remainingPercent: 2`

#### Scenario: Gate 關閉時不攔
- **GIVEN** `subagent.quota_gate_enabled = false`
- **WHEN** 即使 5H 剩 1%
- **THEN** gate 不觸發；但 runtime log 寫 `[quota-gate] disabled, would-have-tripped acc_42 5h=1%`（方便事後追）

#### Scenario: Quota 查不到時採「寧縱勿誤殺」
- **GIVEN** 當前 subagent 的 provider 無 `AccountQuotaProbe` 實作，或 cache 從未填過
- **WHEN** gate 檢查
- **THEN** gate **放行**（subagent 繼續跑）
- **AND** runtime log 寫 `[quota-gate] WARN cannot probe quota for {provider}:{accountId}, letting subagent proceed`
- **AND** log 等級為 WARN（不是 DEBUG），使用者 tail log 看得到

---

### Requirement: Gate 適用範圍分 subagent vs main，兩條分支不同動作

#### Scenario: Subagent 路徑觸發 cancel
- **GIVEN** session.source = 'task-tool'
- **WHEN** gate trip
- **THEN** 走 cancel + handover 路徑（前述 Requirements）

#### Scenario: Main/root session 路徑觸發 rotate-or-stop
- **GIVEN** session.source = 'user-initiated' 或 null（legacy root）
- **WHEN** gate trip
- **THEN** 走 main agent 兩段式路徑（詳下節 Requirement）

#### Scenario: 其他來源 session 不被 gate 管
- **GIVEN** 透過 MCP `manage_session create` 開的新 session，source = 'mcp-handover'
- **WHEN** 5H 剩 2%
- **THEN** gate **不**觸發，行為回到既有 rotation3d / UI 路徑

#### Scenario: 判斷來源的依據
- **GIVEN** 任何 session
- **WHEN** gate 檢查
- **THEN** 以 `session.source` 欄位為準（`'task-tool'`、`'user-initiated'`、`'mcp-handover'`、null）

---

### Requirement: Main agent quota intervention — 兩段式軟/硬策略

**Purpose**：main agent 沒有 parent 可交；不能 cancel，否則對話斷線。用「先試切帳號，切不了才硬停」盡量讓使用者無感。

#### Scenario: 同 family 有可用備援帳號 → 靜默 rotate（軟介入）
- **GIVEN** main session 當前 pinned `acc_7`，5H 剩 3%
- **AND** 同 family 內 `acc_3` 5H 剩 87%、`acc_9` 5H 剩 62%
- **WHEN** gate trip
- **THEN** runtime 選 `acc_3`（**當下剩最多**）
- **AND** 對 main session 呼叫 `pinExecutionIdentity({..., accountId: 'acc_3'}, {override: 'quota-gate-rotate', fromAccount: 'acc_7'})`
- **AND** 前端收到 banner 事件：`{type: 'quota-gate-rotated', fromAccount: 'acc_7', toAccount: 'acc_3', newRemainingPercent: 87, triggerWindow: '5h'}`
- **AND** 下一筆 provider request 正常使用 `acc_3` 發出，對話繼續
- **AND** 不 cancel、不產生摘要、不中斷 assistant turn

#### Scenario: 備援選擇規則為 best-available
- **GIVEN** 同 family 內多個候選帳號
- **WHEN** runtime 挑選
- **THEN** 以 `fiveHourPercent_remaining` 降序、tie-break `weeklyPercent_remaining` 降序，取最高者
- **AND** 候選集合排除當前 pinned 帳號本身
- **AND** 候選集合排除 probe 回 unsupported / 資料缺失的帳號

#### Scenario: 備援也都低於門檻 → 硬停 fallback
- **GIVEN** main session 5H 剩 3%
- **AND** 同 family 所有其他帳號 5H 皆 < 5%（整組告急）
- **WHEN** gate trip
- **THEN** runtime **不** rotate
- **AND** 當次 assistant turn 結尾由 runtime 插入一則結構化 system-notice message：
  ```
  ⚠ 配額告急 — 目前 family 內所有帳號 5H 皆剩 <5%。
  本 turn 被自動結束，進度摘要如下：
  - 已完成：[runtime 掃出的 completedToolCalls 摘要]
  - 讀過的檔：[...]
  - 改過的檔：[...]
  - 未完成的 todo：[...]
  下次 reset：<nextResetAt>
  ```
- **AND** assistant turn state 設為已結束（`finish`）
- **AND** 使用者需要繼續時自行送新 message 或開新 session

#### Scenario: Banner 呈現為 non-blocking system notice
- **GIVEN** rotate 發生
- **WHEN** 前端收到 banner 事件
- **THEN** 在對話時間線插入一則 system-level notice（非使用者 / assistant message），樣式為 info 而非 error
- **AND** notice 不 interrupt 當前 streaming 的 assistant 回應
- **AND** notice 保留在對話歷史（讓使用者事後能追溯）

#### Scenario: pin override 留痕
- **GIVEN** runtime 觸發 pin override
- **WHEN** 寫入 session info.json
- **THEN** `execution` 欄位內有 `override` 註記：`{reason: 'quota-gate-rotate', fromAccount, atTurn, atTimestamp}`
- **AND** session history / telemetry 同步紀錄（可被 admin 追溯）

#### Scenario: Main gate 關閉時
- **GIVEN** `main.quota_gate_enabled = false`
- **WHEN** 5H 剩 3%
- **THEN** 不 rotate、不 stop；log 寫 `[quota-gate] disabled, would-have-tripped main session ses_xxx`

---

### Requirement: Structured summary 由 runtime 自動生成

**Purpose**：不依賴 LLM 臨終寫字。

#### Scenario: 標準內容
- **GIVEN** gate trip
- **WHEN** runtime 產生 structured summary
- **THEN** 包含至少：
  - `reason`: "quota-gate-trip"
  - `triggerWindow`, `remainingPercent`
  - `completedToolCalls[]`: 已完成的 tool call 列表（name、args 摘要、結果成功/失敗）
  - `readFiles[]`: subagent 讀過的檔案路徑（從 tool call 歷史掃）
  - `editedFiles[]`: subagent 編輯過的檔案路徑
  - `lastMessages[]`: 最後 N 則 assistant message（預設 N=3，取文字內容摘要，不含 thinking）
  - `pendingWork[]`: 若 subagent 的 TodoWrite 有 in_progress / pending item，列出（best-effort，沒 TodoWrite 就空陣列）
- **AND** 所有欄位由 runtime 從 SharedContext / session messages 機械掃出，**不**呼叫 LLM

#### Scenario: Summary 不爆量
- **GIVEN** subagent 已執行 200 個 tool call
- **WHEN** runtime 產生 summary
- **THEN** `completedToolCalls` 截斷到最後 20 筆（其餘摘要為 `"... and 180 earlier calls"`）
- **AND** `readFiles` / `editedFiles` 以 unique path 去重
- **AND** `lastMessages` 每則截斷到 500 字（或 tweaks.cfg 可調）

---

### Requirement: Handover 沿正常 task-tool-result 路徑

#### Scenario: Parent 收到結構化中止結果
- **GIVEN** gate trip
- **WHEN** parent 的 task tool 呼叫從 await 回來
- **THEN** tool result payload 是結構化的：
  ```json
  {
    "tripped": true,
    "reason": "quota-gate-trip",
    "triggerWindow": "5h",
    "remainingPercent": 3,
    "summary": { ...structured summary... },
    "sharedContext": "..."
  }
  ```
- **AND** parent 的 LLM 看到這個 tool result 可以自己決定要重派、通知使用者、或結案
- **AND** **不**在 parent 層面自動重派（policy 留給 parent LLM / 使用者）

#### Scenario: Parent 對話本身不壞
- **GIVEN** gate trip
- **WHEN** 事件發生後
- **THEN** parent session 狀態正常，SSE 事件不中斷，UI 顯示 task tool call 正常「完成」（不顯示 error 紅字 — 這是定義內的 outcome，不是 bug）
- **AND** parent 的 UI timeline 顯示 subagent bar 以「被 quota gate 中止」標記（而非 crash）

---

### Requirement: 支援線 — 觀測 tools 保留 v1 的行為

**Purpose**：v1 所有觀測 tool 需求保留（主 agent 全景、subagent 早期自查）；僅「主線防 burn」責任從它們移出。

#### Scenario: v1 requirements 仍然成立
- **GIVEN** 這份 spec
- **WHEN** 實作
- **THEN** `get_my_current_usage` 的行為（`supported` 判定、`cachedAt` / `ageSeconds`、pinned identity 語意）完全照 proposal.md v1 描述
- **AND** `get_system_status` 擴充的 `currentInflightAccount` + usage 新鮮度欄位照 v1 描述
- **AND** Gate 與觀測 tool **共用**同一個 `AccountQuotaProbe` registry 與 `quota-cache.json`（不另建）
- **AND** Gate 與觀測 tool 共享同一個 cache TTL（`quota.cache_ttl_seconds`），確保 gate 判斷所用的數字與主 agent 觀測看到的一致

---

## Acceptance Checks

### Subagent
- [ ] 單元測試：subagent 5H < 5% 時 gate 觸發、cancel reason 正確
- [ ] 單元測試：gate 關閉時不觸發，但 would-have-tripped log 有寫
- [ ] 單元測試：provider 無 probe 時放行 + WARN log
- [ ] 單元測試：structured summary 從真實 tool-call 歷史產出欄位正確
- [ ] 整合測試：parent 收到 task tool result，LLM 看到後可自行決定

### Main agent
- [ ] 單元測試：有備援時 best-available 選擇器挑對帳號（5H 降序、tie-break weekly、排除 self）
- [ ] 單元測試：無備援時走 hard-stop 路徑、插入 runtime system-notice message
- [ ] 整合測試：rotate 後 session info.json 有 override 註記
- [ ] 整合測試：banner 事件送到前端、以 non-blocking notice 呈現
- [ ] 整合測試：main gate 關閉時不 rotate、不 stop（但有 log）

### 共用
- [ ] MCP handover spawn 的 session 不進 gate（負向案例）
- [ ] 觀測 tool acceptance 沿用 v1（get_my_current_usage 在 pinned session 拿到正確數字）
- [ ] tweaks.cfg 多個 knob 有 fallback defaults、能被覆寫
