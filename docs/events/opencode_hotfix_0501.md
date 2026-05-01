# OpenCode Hotfix Handover — 2026-05-01

跨 Claude account 接手用。包含本輪 session 的所有 RCA、已完成 commit、未完成 todo。

---

## 1. 本輪已 commit 的修正（依時間倒序）

| Commit | 內容 |
|---|---|
| `cffb1d725` | `fix(session): set time.completed on every disk-terminal write` — 修 processor.ts 7 個 disk-terminal 寫點，補 `input.assistantMessage.time.completed = Date.now()`。讓 task.ts:2270 watchdog A gate 真正會觸發 → task.completed → main agent 不再永遠等待。修點：line ~519, ~588, ~696, ~1407, ~1443, ~1522, ~1557 |
| `d036d68fa` | `debug(part-flow): tri-checkpoint trace for part.updated drop investigation` — 在 publish (A) / SSE forward (B) / reducer entry (C) 三點裝 log。RCA 完成後**必須 revert** |
| `48dc6a531` | `fix(prompt): plan is substance, todolist is its projection` — SYSTEM.md L75 / L80 / L140 重寫，加上 anti-rewrite rule + "if asked to implement a plan, todowrite once before action" |
| `597bb4890` | `fix(detector): paralysis nudge bans the repeated tool by name` — Detector A 撞到特定 tool 重複時，nudge 直接點名禁該 tool |
| `5739dad06` | `fix(prompt): break the todowrite-rewrite loop in SYSTEM.md` |
| `7a69bfe33` | `feat(daemon): boot-time zombie message sweep` — 開機掃 `finish IS NULL AND time_completed IS NULL AND time_created < now-60s`，蓋 `finish='error'`。首次跑清掉 24,250 zombies / 2,427 sessions |
| `310393e5d` | `feat(session): auto-heal empty response by triggering compaction` — `Observed = "empty-response"`、`KIND_CHAIN["empty-response"] = ["low-cost-server", "narrative", "replay-tail", "llm-agent"]`、`INJECT_CONTINUE["empty-response"] = true` |
| `c10c9b460` | `fix(prompt): graceful exit when post-compaction stream has no user` — prompt.ts:1455 graceful break 取代 throw。修 `/compact` 紅 toast |
| `eb7134e33` | `chore(refs): bump codex + openspec submodule pointers` |
| `6e3af2ee0` | `fix(todo): restore the pre-2026-03-09 LLM contract` — `priority` / `id` `.optional().default(...)`、`action.waitingOn` `.optional().catch(undefined)`、LLM 不再看到 `action` block，server 用 `inferActionFromContent` 補 |
| `f6ab73997` | `fix(provider): declare image input on codex gpt-5.x family` |
| `5c3c2f886` | `fix(tools): restore bash/apply_patch/grep/glob to always-present` — 解 156 todowrite/todoread loop |
| `2678bff3c` | `refactor(tools): remove heat-based auto-pin mechanism` |
| `c06c6ac3e` | `fix(tools): exclude user-intent-only tools from auto-promotion` |

---

## 2. 已 RCA 但**尚未動手修**的問題

### 2.A 【NEW，本輪剛抓】Compaction 後對話流只剩計時、看不到 tool bubble

**Symptom**：發生 compaction 後，main agent 後續所有 tool-call bubble 在前端不顯示，畫面只剩 timer。工作監控確認 daemon 仍在跑。

**確認層**：
- daemon 端 PART-FLOW-A vs PART-FLOW-B 完全平衡（A=117, B=117 全 partType），所以 publish + SSE forward 沒事
- frontend reducer (PART-FLOW-C) 還沒實測（需 DevTools console），但流程上不需要：

**Root cause**（純看 code 已 confirm）：

1. compaction 在 `INJECT_CONTINUE = true` 時，於 storage 寫一個真實的 user message (`continueMsg`)，唯一一個 part 是 `synthetic: true` 的 text part — 見 [`compaction.ts:531-552`](../../packages/opencode/src/session/compaction.ts#L531-L552)
2. frontend 用 `isPureSyntheticUser` 把這種 user 從 `visibleUserMessages` 過濾 — 見 [`session.tsx:585-596`](../../packages/app/src/pages/session.tsx#L585-L596)。這部分是設計意圖，不是 bug
3. **但** [`session-turn.tsx:360-372`](../../packages/ui/src/components/session-turn.tsx#L360-L372) forward scan 在收集當前 turn 的 assistant children 時：
   ```ts
   for (let i = index + 1; i < messages.length; i++) {
     const item = messages[i]
     if (item.role === "user") break          // ← 撞到 synthetic continue 就停
     if (item.role === "assistant" && item.parentID === msg.id) { ... }
   }
   ```
4. 後續 assistant messages 的 `parentID = continueMsg.id`（不是原 user）。前一個 visible user 的 SessionTurn 在 synthetic user 處 break；synthetic user 自己又被過濾不渲染 → 所有 post-compaction assistant messages 變孤兒，整段 tool bubble 都看不見
5. Timer 仍亮，因為從 `_liveStreamingIds` 取，與 turn 渲染無關

**最小修正方向**：session-turn.tsx forward scan 把 pure-synthetic user 當透明（不 break，並繼續 forward 收集 `parentID === continueMsg.id` 的 assistant children 進當前 turn）。或者改造 collection 邏輯改用 transitive parent chain。

**未動手原因**：使用者在最後一輪要求先打包 handover，等下個 session 處理。

---

### 2.B Quota 耗盡解救機制（P0，使用者本輪明確下單但沒做）

使用者原話（最後一個明確 task）：
> 第一個要解決的是用量耗盡的解救機制。
> 1. 在 subagent 中發生 → 同步狀況給 main agent
> 2. 在 main agent 中發生 → 同步狀況給 subagent
> 3. 不管是在哪裏發生，要有 account switch SSOT 一起 switch

**已知前置 bug**（要先修否則 SSOT 沒辦法做）：
- worker 端 `Bus.publish(RateLimitEscalationEvent, ...)` 不會到 parent 的 `handleRateLimitEscalation`
- `[bus.task.rate_limit_escalation]` log **有**出現，但 `[rot-rca] parent recv` **沒**出現
- 嫌疑點：worker stdout flush / parent stdin reader / subscriber 設定 race

**建議第一步**：在 [`packages/opencode/src/session/processor.ts`](../../packages/opencode/src/session/processor.ts) 兩個 `Bus.publish(RateLimitEscalationEvent, ...)` 點（line ~547、~1466）後面加 `[rot-rca] worker emit` log，配對 parent 的 `[rot-rca] parent recv`，定位 drop 點。橋接通了再設計 SSOT。

**另外的小坑**：`LLM.handleRateLimitFallback` 回 null 時，`handleRateLimitEscalation` 只 `log.warn + return`，應改成發 `escalation_failed` 給 child fail-fast + actionable error。

---

### 2.C processor.ts 還有 3 個 codex_family_exhausted 寫點漏補 `time.completed`

跟 `cffb1d725` 同性質的 bug，line 1601 / 1738 / 1876，都是 `input.assistantMessage.error = MessageV2.fromError(codexFamilyError ...)` 後沒設 `finish` 也沒設 `time.completed`。要套同樣 fix。

```bash
grep -n "input\.assistantMessage\.error = MessageV2\.fromError(codexFamilyError" \
  packages/opencode/src/session/processor.ts
```

---

### 2.D Diagnostic commit `d036d68fa` 還沒 revert

PART-FLOW-A / B / C 三點 log 是 RCA 用，2.A 修完之後要 revert。檔案：
- `packages/opencode/src/session/index.ts` (A，line 1092 / 1104)
- `packages/opencode/src/server/routes/global.ts` (B，line 327)
- `packages/app/src/context/global-sync/event-reducer.ts` (C，line 394-407)

---

## 3. 較長期觀察項

- **SYSTEM.md plan-as-substance reframe**：本輪驗證在新鮮 session 上有效（污染中的 session 救不回來，需要 fresh start）。多日觀察是否減少 todowrite paralysis 復發
- **`compaction.overflowThreshold`**：`~/.config/opencode/opencode.json` 目前 0.95（codex 用）；使用者本輪試 0.8 後改回，「讓 auto heal 跑一下，0.8 先不要調」

---

## 4. Repo / runtime 環境提醒（給接手 Claude）

- 使用者全域 rule：進 repo 先讀 `AGENTS.md`（如果有）
- `M refs/*` 一律 commit（auto-memory 第 3 條）
- daemon-side fix 必須**自己** rebuild + restart 後才叫 user 測（auto-memory 第 4 條）
- opencode 跟 opencode-beta 共享 `~/.config/opencode/`、`~/.local/share/opencode/`，beta 跑 `bun test` 會洗掉真 accounts.json
- AGENTS.md 第一條：禁止靜默 fallback；查找/載入失敗必須明確報錯
- 使用者偏好白話對話，code identifier 留給 commit / handoff 文件
- 對話流回應簡短，不需要尾段 summary

---

## 5. 觸發 / 重現提示

- compaction trigger 場景：context > 95% 或 codex 吐空回應（empty-response auto-heal）
- 看 daemon log：`/home/pkcs12/.local/share/opencode/log/debug.log` (+ `.1` rotation)
- 本輪 RCA 用的 session：`ses_21e536e1effebeZ5dmsyU82XQc`（compaction 在 12:02:49 觸發，low-cost-server 成功）
- frontend console 看 `[PART-FLOW-C]`；daemon log `grep "PART-FLOW-A\|PART-FLOW-B"`

---

## 6. 接手第一步建議

1. 先動 **2.A**（compaction 後 tool bubble 消失）— 是使用者最近一輪正面回報的 bug，且 RCA 已完成、修法明確
2. 修完順手把 **2.D** revert 掉
3. 再回 **2.B**（quota SSOT），先做 bridge log 定位
4. **2.C** 是順便補的，跟 2.B 同檔案可一起處理

修改任何 daemon code → rebuild + restart → 自己跑一輪驗證 → 才 handoff 給 user 測。
