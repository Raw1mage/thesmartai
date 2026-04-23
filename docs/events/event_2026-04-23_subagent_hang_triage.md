# 2026-04-23 凌晨 Triage 交接：Subagent 陰魂不散 + 順便補的三條 hotfix

## TL;DR

- 一開始是處理 part 落盤 O(n²) 的效能 bug，修到一半踩到 subagent 陰魂不散這條**真正棘手**的 bug
- 這次 triage 找到了真因（stdout 管道單邊斷掉 + exit handler 早退），但 **沒有上修復**
- 使用者最後提出「**失聯不能傻等、也不能假設對方已死**」的架構級原則，明天該以此開 plan 正式處理
- 途中順便補了幾條小 hotfix（part 寫入放大、MCP handover、可點 subagent bar、compaction toast）

---

## 已上線的 commits（按時間）

### 1. `7f2cab0fb` — part 落盤 debounce、容量上限、MCP handover、可點 subagent bar

四件事一次 commit，因為都是同一次 triage 過程裡冒出來的：

- **part 落盤 debounce**：每次 AI 吐一小段新字，以前會把「到目前為止整段答案」重新 stringify + 整份覆蓋寫回硬碟。3.7 MB × 13,600 次 delta = 累積 50 GB 的磁碟寫入，把 daemon 事件迴圈塞爆。改成每 500ms 才真正落盤一次，text-end / 工具狀態切換等才立即同步
- **part 容量硬上限**：單段文字 / reasoning 超過 8 MB 就截斷 + 封印，後續 delta 丟掉；預設**只封印不砍 session**（`part_cancel_on_cap_trip=1` 可開嚴格模式砍 session）
- **MCP handover**：`manage_session create` 新增 `sessionID`（來源 session）、`handover`（追加文字）、`handoverAutoPrompt` 參數。會繼承來源 session 的目錄和模型，自動送一則「請讀取前一會話的 eventlog/checkpoint/SharedContext 接續工作」當開場。**以前忘記送 `x-opencode-directory` header，新 session 會掛到錯誤 project 底下，web list 撈不到**——這次一起修了
- **可點 subagent status bar**：整列 icon + agent 名 + title + 時間都包進 `<a>`，任意位置點都能跳進子 session，不必按右邊那個小箭頭

相關檔案：
- [packages/opencode/src/session/index.ts](packages/opencode/src/session/index.ts) — updatePart 的 debounce + 硬上限
- [packages/opencode/src/config/tweaks.ts](packages/opencode/src/config/tweaks.ts) — 新增三個 knob（`part_persist_debounce_ms`、`part_max_bytes`、`part_cancel_on_cap_trip`）
- [packages/opencode/src/session/prompt-runtime.ts](packages/opencode/src/session/prompt-runtime.ts) — 新增 `runaway-guard` CancelReason
- [packages/mcp/system-manager/src/index.ts](packages/mcp/system-manager/src/index.ts) — handover create
- [packages/app/src/pages/session/session-prompt-dock.tsx](packages/app/src/pages/session/session-prompt-dock.tsx) — 可點全列

### 2. `907a056bc` → `4941fe2d7` — D watchdog 加了又 revert

我自作主張加了第 D 條「橋接靜默」watchdog，使用者提醒這是之前**刻意整併掉**的設計（見 git log `17326eef6` → `529985d70` → `02e9eb6f2`）。revert 掉，回到 proc-scan 三條防線的狀態。教訓記在 memory 裡。

### 3. `c39b6dfbb` — `/compact` 的進度 toast

以前按 `/compact` 連「壓縮中」都不說一聲，使用者常常以為沒動。改用 `showPromiseToast` 顯示 loading → success / error 三態。英文 + 簡中 i18n 已加。

相關檔案：
- [packages/app/src/pages/session/use-session-commands.tsx](packages/app/src/pages/session/use-session-commands.tsx#L365-L390)
- [packages/app/src/i18n/en.ts](packages/app/src/i18n/en.ts), [packages/app/src/i18n/zh.ts](packages/app/src/i18n/zh.ts)

前端 bundle 已 rebuild + rsync 到 `/usr/local/share/opencode/frontend/`，daemon 不用重啟。

---

## 未解決 — **主線 bug**：Subagent 陰魂不散

### 症狀

Subagent 看起來凍結在某個 tool 上、計時器持續跑、看不出死活；實際上是子 agent **程式還活著**，但它跟主程式之間的 stdout 管道**單邊先斷了**。後果：

- 主程式收到 EOF，立刻把子 agent 從名單抽掉、開始等「死亡證明」
- 但子 agent 沒死，死亡證明永遠不會來 → 主程式的等待永遠不結束
- 監視機制（watchdog）想去查子 agent 狀況，發現「名單裡沒這個人」就跳過，**三條防線全部失效**
- 子 agent 最後真的完成工作想回報結果，但管道早就斷了，石沉大海
- 父 agent 被 task tool 的 await 釘死，整個對話不回話

### 確切證據（debug.log 片段）

```
04:38:20 ~ 04:39:20  worker-1 每 5 秒 heartbeat，都正常
04:39:24.656  [TRACE][STDOUT_EOF] hasRemaining:false, hasCurrent:true
04:39:24.656  [TRACE][EXIT_HANDLER] hasReq:true, workerBusy:true
(3 分鐘後…)
04:42:31.517  subagent finishReason=stop
04:42:31.619  worker sending done signal   ← 送到已斷線的管道
(後面完全沒有 worker_done_resolved / watchdog_fallback / rejected)
```

### 現有 watchdog 三條為什麼全部失效

三條防線都在 [packages/opencode/src/tool/task.ts:2141-2260](packages/opencode/src/tool/task.ts#L2141-L2260)：

- **A. 磁碟終結**：子 session 最後一則 assistant `finish` 屬於終結集合 + 超過 5 秒 → 強制解套
- **B. 行程死亡**：`Z/X` 狀態、exitCode 設了 → 認定死亡
- **C. CPU/I/O 沉默**：60 秒沒有 CPU tick 或 I/O → 殺掉 + 解套

這次三條都啞火的原因：**exit handler 早退把 worker 從名單抽掉了**（[task.ts:1180](packages/opencode/src/tool/task.ts#L1180) `removeWorker`），watchdog 每 tick `workers.find(...)` 找不到人就跳過。所以後來子真的寫了 `finish=stop` 到硬碟，A 也偵測不到，因為 watchdog 根本沒在看。

### 為什麼 stdout 管道會單邊斷

**目前沒有證據能百分百確定**。我們自己的程式沒有主動關管道、也沒有 timeout 會殺忙碌 worker。可能原因（按可能性）：

1. **Linux 管道 buffer 塞滿 + daemon 事件迴圈卡住**：子寫太快、父讀太慢（例如事件迴圈在做別的重活，像今晚修掉的 3.7 MB 整份覆蓋寫入）
2. **Bun 底層在高壓時誤送 EOF**：函式庫層的 bug，不是我們能直接修的
3. **Codex 80% 伺服器端 compaction 期間的靜默**：子在等 codex 回應，stdout 幾乎沒寫，配合其他條件可能觸發 Bun 的某種 idle 判定

使用者觀察「很多 toolcall 會卡非常久，例如 apply_patch」—— 不是 timeout 殺它（沒有這種機制），但**長 toolcall 跟這個症狀高度相關**，因為：toolcall 越久 → bridge 事件越多 → stdout 寫入壓力越大 → 越可能踩到上面 1/2/3 之一。

### Codex 80% 異常行為的真因（順便找到的）

使用者提到「codex context window 400K 但到 80% 就行為異常，無故不理人」。**這 80% 是我們自己訂的**：
- [packages/opencode-codex-provider/src/models.ts:48-50](packages/opencode-codex-provider/src/models.ts#L48-L50) — `getCompactThreshold = contextWindow * 0.8`
- [packages/opencode-codex-provider/src/provider.ts:141-143](packages/opencode-codex-provider/src/provider.ts#L141-L143) — 塞進 request 的 `context_management`

結論：跨過 320K（gpt-5.4 的 80%）時，codex **伺服器端會在那筆 response 裡內聯跑 compaction**。那段時間從我們這邊看就是「沒吐東西」。不是 codex 擺爛，是**我們主動要求 codex 做 compaction 然後等它**。

可行方向（未做）：
- 提高門檻到 90-95%（減少觸發、增加爆 context 風險）
- 改用 standalone compaction（先預壓縮再送 request，不要塞進正常 response 裡等）
- 監測 codex compaction 進行中的事件，讓 UI 顯示「壓縮中」而非「卡死」

---

## 使用者下的**架構級原則**（明天做 plan 的頂層驗收標準）

Memory 檔：[feedback_liveness_invariant.md](/home/pkcs12/.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_liveness_invariant.md)

**原則**：當兩方（A 和 B）因任何原因失聯，A 不能做下面兩件事的任何一件：

1. **傻傻等**：被動等 B 的訊息等到天荒地老
2. **假設對方已死**：沒驗證就當作 B 死了然後繼續走

**唯一合法路徑**：主動查清楚 B 實際狀態，**查清楚前不准做任何單邊決策**：
- B 還活著但失聯 → 主動殺掉 B，走死亡流程
- B 真的死了 → 走死亡流程
- 查不清楚 → 繼續查

這條要當**系統全域 invariant**，不是只修 task tool 那一處。

### 需要審視的 A-等-B 點（明天 plan 檢查清單）

- 父 session 等子 agent 結果（這次踩到的主 bug）
- 子 agent 的 runloop 等 codex API 回應（疑似跟 80% compaction 靜默有關）
- 主 runloop 等工具結果
- daemon 等 MCP 子行程回應
- 前端等 SSE 事件（不同層但同原則）

### 具體設計要求（從原則展開）

1. 每個「A 等 B 訊息」點都要：
   - (a) 獨立的對方活著探測（不能只靠同一條通道）
   - (b) 結果的備援遞送路徑（硬碟 / SharedContext），不只靠 IPC
   - (c) 「對方活著但通道死了」時的主動終結步驟

2. task.ts exit handler 目前那種「EOF → 立刻抽名單 → 被動等 proc.exited」**正是違反這條原則**，要重寫

3. 子 agent 的工作完成契約要從「只送 IPC」改成「**一定先落硬碟再送 IPC 通知**」，這樣 IPC 斷了父自己去硬碟讀結果就好

---

## 今天還踩到但沒深究的週邊問題

1. **`manual_interrupt` stopReason 寫死**：[packages/opencode/src/session/prompt.ts:390-403](packages/opencode/src/session/prompt.ts#L390-L403) 不論實際 cancel 原因是什麼（killswitch、parent-abort、replace、runaway-guard…），workflow stopReason 一律寫死成 `manual_interrupt`。導致任何內部取消都被當成「使用者手動按停」，觸發 NON_RESUMABLE gate。明天 plan 順便修。

2. **activeChild 鬼魂**：前端 status bar 繼續數計時器、server 端其實早就沒 activeChild——代表「清除 activeChild」的 bus 事件在 SSE 傳遞中被某處丟了。跟主 bug 不同層，但一起暴露出來。

3. **大 session 重開後 tool part 卡 running**：daemon 重啟後 `recoverOrphanTasks` 會掃描並標記，但這只在「重啟時」執行——代表一般運作期間有 orphan 也不會被發現。

---

## 明天的起點

1. **開 plan-builder**：`/specs/process-liveness-contract/`（或類似 slug）
2. **第一段 proposed doc 寫死三件事**：
   - 引 `feedback_liveness_invariant.md` 當頂層原則
   - 列上面「需要審視的 A-等-B 點」作為審查對象
   - 每一點要求 (a) 獨立 liveness probe、(b) 備援遞送、(c) 主動終結三項通過才算修好
3. **優先順序**：父等子 agent（主 bug）→ 子等 codex（80% 關聯）→ 其他
4. **別走 hotfix**。這不是一行兩行能補完的事，是整個 IPC 契約重構

---

## Repo 狀態快照

- 分支：`main`
- HEAD：`c39b6dfbb feat(app): add /compact progress toast`
- 未 commit 的 dirty files：之前就在那邊的那幾個（debug-writer.ts、permission/next.ts、server/app.ts、routes/session.ts、message-v2.ts、workflow-runner.ts），不是我動的，照原樣留著
- Daemon：健康，當前 pid 見 `pgrep -af "packages/opencode/src/index.ts serve"`
- 前端 bundle：已 build + rsync 到 `/usr/local/share/opencode/frontend/`

---

## 相關 memory 檔（已寫入）

- [project_subagent_hang_pattern.md](/home/pkcs12/.claude/projects/-home-pkcs12-projects-opencode/memory/project_subagent_hang_pattern.md) — 這條陰魂不散 pattern 的辨識方法 + 現有 watchdog 三條為何失效
- [feedback_liveness_invariant.md](/home/pkcs12/.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_liveness_invariant.md) — 使用者提出的架構原則
- [feedback_agents_md_not_for_claude.md](/home/pkcs12/.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_agents_md_not_for_claude.md) — AGENTS.md 是給 opencode runtime 看的，不是給我的

凌晨 04:50 寫完，使用者該睡了。明天開工從「/specs/process-liveness-contract/」開始。
