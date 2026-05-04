# Proposal: subagent-quota-safety-gate

> **Scope pivot (2026-04-23, v2)**: 原本目標是「給 AI 觀測眼睛」，但使用者指出 `SYSTEM.md` 已有的 5% wrap-up 規則在現實中根本不生效 — subagent 燒爆額度仍是主要事故模式。主角從「AI 自律觀測 tool」改為 **runtime 強制 gate**；觀測 tool 降級為支援性功能（主 agent 全景、subagent 自查 — 但不依賴它來防 burn）。
>
> **Scope extension (2026-04-23, v3)**: 使用者進一步指出 main agent 也有同樣症狀 — AI 悶著頭衝不會自律。但 main agent 沒有 parent 可交，不能用同一套「cancel + handover」。v3 為 main agent 補一條**軟介入路徑**：用量告急時 runtime **偷偷 unpin + rotate** 到同 family 裡剩最多的帳號，UI 顯示 banner，對話不中斷；若整組都已低於 gate 門檻（全都 <5%）才退回「硬停 + runtime 摘要給使用者」。Spec folder name 與此前相同（`subagent-quota-safety-gate`），但範圍已擴大；下方 Scope / Capabilities 已依 v3 重寫。

## Why

過去事故模式一再重複：subagent 被 task tool 生出來執行一項工作，它自己沒有「我該停」的感官，就一路打 provider 直到把當前帳號的 5H window 榨乾。rotation 不會插手，因為 subagent 的 session 已有 pinned `execution.accountId`，rotation 預設尊重 pin 不動它。

我們之前試過兩條路都沒成功：
1. **純文字規則**（SYSTEM.md 寫「剩 5% 要 wrap up」）— AI 看規則的執行率低，context 一滿就漂走
2. **給 AI 觀測 tool**（本 spec v1 原計畫）— 假設 AI 看到數字會自律。現實中 subagent 不會在中途主動查，而且即使查到了也傾向「再一個 tool call 就好」

結論：**這件事不能靠 AI 自律**。必須由 runtime 在 subagent 發出 provider request 的路徑上硬攔，超過門檻就強制結束這個 subagent，把手邊進度以 SharedContext + 結構化摘要回傳給 parent。

同時，觀測 tool 仍然有價值 — 但用途從「防 burn」轉成「全景觀測 / 主 agent 看看整體狀況 / subagent 在 gate 觸發之前的早期感知」。它不是這個 spec 的主線。

## Original Requirement Wording (Baseline)

- v1（2026-04-23 初始）：「一直以來subagent一直沒有能力自己去留意用量狀況。我覺得應該要寫一個system-manager-quota tool來幫助AI」
- v2 pivot（2026-04-23 同日）：「我現在覺得應該讓runtime硬編碼去干涉subagent的工作。在小於5%的時候叫停並return sharedcontext」
- v3 extension（2026-04-23 同日）：「我發現用量告急的runtime主動干涉是main agent也需要的。這些AI只會悶著頭一直衝」

## Requirement Revision History

- 2026-04-23: initial draft created via plan-init.ts
- 2026-04-23: 使用者確認「純觀測、不含 force_rotate 寫入面」（v1）
- 2026-04-23: 使用者澄清 tool 形狀 — 單一 tool 自動偵測當前 provider/model/account 並分派；目前僅 codex/openai 有實作（v1）
- 2026-04-23: 三項 v1 設計方向：(a) description 帶 heuristic, (b) `cachedAt` + `ageSeconds`, (c) 以當次 inflight account 為準
- 2026-04-23: 勘查發現 `get_system_status` 已暴露 rotation / codex 5H+WK usage 等，方案 C 雙軌（v1 結尾）
- **2026-04-23 v2 pivot**: 使用者指出 v1 的「AI 自律觀測」路線和既有 SYSTEM.md 5% 規則一樣注定失敗。主線改為 **runtime 強制 quota gate**；觀測 tool 降為支援性功能
- 2026-04-23: 四項 v2 設計方向確認：
  - 門檻：**哪個 window 先到 5% 就攔**（5H 或 weekly）
  - 攔截點：**tool-call 邊界**（subagent 每輪 tool-call 結束後檢查，粒度夠且成本低）
  - Handover 形式：**SharedContext + runtime 自動產的結構化摘要**（非 LLM 臨終生成 — 不信任 LLM 臨終寫字的穩定度）
  - 適用範圍（v2）：**只攔 task tool spawn 的 subagent**（root session 不攔；parent 的 UI 連續性 > 防 burn）
- 2026-04-23: v3 範圍擴大與兩項 main agent 策略確認：
  - main agent 觸發相同 5%/tool-call 邊界/probe 規則，但**不 cancel** — 走「先切帳號再硬停」兩段式策略（Strategy C）
  - 切帳號目標 = 同 family 內**當下剩最多**的帳號（無絕對門檻，純 best-available）；若當下剩最多者本身也 < gate threshold，視為無可用帳號，退回硬停
  - 硬停時 runtime 以「配額告急，目前進度摘要」message 結束 main session 的當次 assistant turn，使用者需手動開新對話接續
  - Pin 契約修改：在 gate trip 壓力下允許 runtime unpin + re-pin，不視為違反 `pinExecutionIdentity()` 的語義（加註 override reason）

## Effective Requirement Description

### 主線 A：Subagent quota gate（v2）

1. 在 subagent 的 runtime 執行迴圈中插入一道 **pre-dispatch quota gate**：每輪 tool-call 完成、準備發下一次 provider request 前，runtime 讀取當前 pinned account 的 quota cache，若 5H 或 weekly 任一低於 5% → **強制中止這個 subagent**
2. 中止路徑：runtime 以「quota-gate-trip」為 CancelReason 結束 subagent 的 runloop，**不**讓 subagent 的 LLM 再多一次機會
3. Handover：runtime 把 subagent 當下的 SharedContext 加上一段 **runtime 自動產的結構化摘要**（已完成 tool-calls / 讀過的檔 / 最近 N 則 message 摘錄）送回 parent；parent 的 task tool 回傳值包含這兩段
4. 適用範圍：task tool spawn 出來的 subagent
5. Gate 行為可關：`/etc/opencode/tweaks.cfg` 提供 `subagent.quota_gate_enabled` 與 `subagent.quota_gate_threshold_percent`（預設 5）

### 主線 B：Main agent quota intervention（v3，新加）

6. 同一道 **pre-dispatch quota gate** 也套用到 main / root session，但**動作不同**：不 cancel，而是走「先軟後硬」兩段式：
   - **軟介入（預設路徑）**：runtime 在同 family 內挑**當下 5H 剩餘最多**的帳號（非 pinned 的那個），呼叫 `unpinExecutionIdentity()` + `pinExecutionIdentity(newAccount)` 重新釘；UI 顯示 banner：「⚠ 配額告急，已切換到 acc_XX（5H 剩 87%）」；對話**不中斷**
   - **硬停 fallback**：若同 family 內所有帳號都 < gate threshold（全都 <5%），則 runtime 在當次 assistant turn 結尾塞一則結構化「配額告急，目前進度摘要」message 結束 turn；使用者要繼續得手動開新對話（或等 reset）
7. Main agent 觸發不清除 SharedContext 也不摘要 — 對話本身就是使用者能看到的狀態，rotate 後直接繼續；只有 fallback hard-stop 才產摘要
8. 所有 main agent 行為可關：`main.quota_gate_enabled`（預設 true）、`main.quota_gate_threshold_percent`（共用 5% 還是獨立 knob，design.md 再定）
9. Banner 在對話時間線中以非阻塞 system notice 形式呈現（不是 error）

### 支援線：觀測 tools（原 v1 內容，保留但降級）

6. 新增 `system-manager:get_my_current_usage`（主 agent 或早期 subagent 自查用，非 gate 依賴）
7. 擴充 `system-manager:get_system_status` 區分 `selectedAccount` vs `currentInflightAccount`，usage 帶 `cachedAt` / `ageSeconds`
8. 引入 `AccountQuotaProbe` provider-boundary 介面（gate 和觀測 tool 共用同一個 quota 來源）

## Scope

### IN
- **(v2 主線 A)** subagent runtime 迴圈的 pre-dispatch quota gate（cancel + SharedContext + 結構化摘要）
- **(v3 主線 B)** main/root session 的 pre-dispatch quota gate（兩段式：rotate-first / hard-stop fallback）
- **(v3 主線 B)** `pinExecutionIdentity` 的 override 路徑：gate 壓力下 runtime 可重新 pin 另一個帳號（加註 override reason 記入 session history）
- **(v3 主線 B)** UI banner 與 hard-stop 結尾 message 的前端呈現
- **(v2/v3 共用)** 結構化摘要生成器（subagent trip 與 main agent hard-stop fallback 共用同一個 module）
- **(v2/v3 共用)** `tweaks.cfg` 開關 + 門檻
- **(v1 支援)** `get_my_current_usage` MCP tool
- **(v1 支援)** `get_system_status` 擴充（`currentInflightAccount`, `cachedAt`, `ageSeconds`）
- **(v1 支援)** `AccountQuotaProbe` provider 介面 + codex 實作 + quota-cache.json TTL 機制（gate 與 tool 共用）

### OUT
- 任何 `force_rotate` / `mark_exhausted` 寫入 tool 給 AI 用（v1 就排除）
- rotation3d 本身的重構（request-gated → background ticker 屬 `process-liveness-contract`）
- 其他來源的 non-root non-task-tool session（如 MCP handover 生出的）— 不在 gate 範圍
- 跨 family rotate（v3 只在同 family 內選 best-available；跨 family 會扯到 provider 差異、context 不相容）
- 前端獨立 quota dashboard（banner/結尾 message 用對話內 notice 即可）

## Non-Goals

- 不依賴 AI 自律 — 主線 gate 是 runtime 強制，不是給 AI 的 hint
- 不解決 2026-04-23 subagent-hang IPC 真因（屬 `process-liveness-contract`）
- **Subagent** 不做內部 rotation（動 rotation 契約太廣，用「終止 + 摘要回 parent」解；parent 決定要不要用新帳號重啟）
- **Main agent** 才做內部 rotation（pin-break under quota pressure）— 這是 v3 明確開的一個口子；subagent 不走同樣路徑
- 結構化摘要不追求 LLM-品質 — 它是 runtime 自動產的、fact-based 清單，不是 narrative
- 不解決「所有 family 都爆」的使用者痛點（那時硬停也是必然）

## Constraints

- 必須跟現有 rotation3d / account manager 的資料來源對齊，不另建獨立 cache
- 「禁止靜默 fallback」：gate 判斷不到 quota 時（cache 從未填過、provider 不支援），**預設放行**並在 log 留下明確 warning（不能因為查不到而誤殺 subagent）— 這是明知的 trade-off，log 要顯眼讓使用者發現
- 遵守 `feedback_provider_boundary.md`：gate 邏輯不得內嵌 provider-specific 判斷；所有差異由 `AccountQuotaProbe` 吸收
- Read-only 保證：gate 本身不改 rotation 狀態、不改 accounts.json；只讀 cache + 呼叫 cancel(subagent, reason="quota-gate-trip")
- Gate trip 不能把 parent 的對話也弄壞 — 必須以正常 task-tool-result 路徑回到 parent

## What Changes

- `packages/opencode/src/session/prompt.ts` or `processor.ts` — **共用** pre-dispatch gate hook（依 session.source 走 subagent-cancel / main-rotate-or-stop 分支）
- `packages/opencode/src/tool/task.ts` — subagent spawn 標 source；trip 時組 TaskResult
- `packages/opencode/src/session/` — 結構化摘要生成器（共用）；cancel reason 擴充；main agent hard-stop 結尾 message 生成器
- `packages/opencode/src/session/index.ts` — `pinExecutionIdentity` 新增 override path（runtime 層呼叫，附 override reason）；Session.Info 加 `source` 欄位
- `packages/opencode/src/account/` 新增 `quota-probe.ts` + `pick-healthiest-account.ts`（main agent rotate 用）
- `~/.config/opencode/quota-cache.json` 新 cache 檔
- `packages/mcp/system-manager/src/index.ts` 新增 `get_my_current_usage`、擴充 `get_system_status`
- `packages/opencode/src/mcp/index.ts` bridge 注入 sessionID
- 前端：banner component（對話中 non-blocking system notice）與 hard-stop 結尾 message 的呈現
- `/etc/opencode/tweaks.cfg` 新增：
  - `subagent.quota_gate_enabled` / `subagent.quota_gate_threshold_percent`
  - `main.quota_gate_enabled` / `main.quota_gate_threshold_percent`
  - `quota.cache_ttl_seconds`
  - summary 相關上限
- Prompt layer / enablement 同步（觀測 tool 預設啟用）

## Capabilities

### New Capabilities
- **Runtime-enforced quota safety gate**：同時覆蓋 subagent 與 main agent；AI 不自律 runtime 擋
- **Structured quota-trip handover (subagent)**：parent 收到 SharedContext + runtime 摘要
- **Silent account rotation under quota pressure (main agent)**：同 family 內 best-available 重新 pin；banner 通知；對話不斷
- **Hard-stop summary message (main agent fallback)**：整組帳號都爆才觸發，runtime 結束 turn 並附摘要
- `get_my_current_usage`：支援性觀測 tool

### Modified Capabilities
- Task tool 回傳路徑：多一個「quota-gate-trip」結果型別
- `get_system_status`：區分 `selectedAccount` vs `currentInflightAccount`，usage 帶新鮮度
- `pinExecutionIdentity`：新增 override path，允許 runtime 在 quota 壓力下重新 pin
- Cancel reason 集合：加 `quota-gate-trip`（subagent 專用）

## Impact

- Runtime：task tool、共用 runloop gate hook、session cancel 路徑、`pinExecutionIdentity` override、quota probe、summary 生成器、best-available account 選擇器、main hard-stop message 生成器
- 前端：新 banner component + hard-stop system notice 樣式
- Prompt：enablement + SYSTEM.md（觀測 tool 宣告；main agent 端告知「對話期間帳號可能被自動切換」）
- 設定：tweaks.cfg 新增多個 knob（見 What Changes）
- 文件：`docs/events/` 紀錄 v2+v3 pivot；`specs/architecture.md` 補充 quota gate 段落（subagent + main 兩種路徑）
- **影響**既有 rotation3d pin 契約（新增 override 路徑，但 rotation3d 主流程不變）
- **不影響**既有 rotation3d 自動策略、既有 429 處理路徑、非 task-tool / 非 root 的 session 行為
