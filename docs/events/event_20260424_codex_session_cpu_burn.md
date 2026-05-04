# Codex long-session CPU burn — investigation + partial fix

日期：2026-04-24
影響：daemon (uid 1000) `bun serve` 長期 94% CPU，持續 1h19m 後被發現。
session：`ses_24bfd7326ffekr4oXOmompwMf4`（Codex WS provider，長 tool-loop）

## 症狀

- `ps`：PID 1536350，`%CPU=94.4`，`etime=01:19:05`，單一 session
- `/run/user/1000/opencode-per-user-daemon.log`：
  - `[CODEX-WS] REQ ... delta=true inputItems=3 fullItems=143 hasPrevResp=true`（歷史 143 items 還在長）
  - `[DELTA-PART] updates=27000 ratio=3.1%`
  - `[DELTA-SSE] partUpdates=8850 totalBytes=57MB`，偶有 `thisBytes=400363`
- `/proc/$pid/stat`：`utime≈stime`（2355/2281 s），`voluntary_ctxt_switches=12.7M` → 高 kernel 呼叫率（I/O + Bus fan-out）

## 根因分析（initial hypothesis）

[session-cache.ts:271-278](../../packages/opencode/src/server/session-cache.ts#L271-L278) 訂 `message.part.updated`，每個 streaming delta 觸發：

1. `bumpVersion()`（便宜）
2. `invalidate(sid)` — `Array.from(entries.keys())` 全 clone + O(N) prefix 掃描
3. `Bus.publish(Event.Invalidated)` — 再一次 Bus fan-out 到 SSE

27,000+ delta × 每次 O(N) 掃描 + 多餘 SSE event = 無效功。

## 套用 Fix（commit not yet landed，僅 WIP）

檔：[packages/opencode/src/server/session-cache.ts](../../packages/opencode/src/server/session-cache.ts)

- 新增 per-session debounce（100ms 窗）：`_partUpdatedTimers`、`_scheduleDeltaInvalidate`、`_flushDeltaInvalidate`
- `PartUpdated` subscriber：有 `delta` 的事件只 `bumpVersion` + 排程 debounced invalidate；無 `delta`（part-end / tool part）立即 flush + invalidate
- `forgetSession` / teardown 清 pending timers

## 重啟後觀察

重啟（`system-manager:restart_self`）→ `hasPrevResp=false inputItems=171` 一次性重送歷史（rebind 稅）→ 進入穩態：

| 時點 | etime | %CPU (instant) | fullItems |
|---|---|---|---|
| T+0:25 | 25s | 203% | rebind 中 |
| T+3:54 | 3m54s | 117%（avg） | 221 |
| T+4:51 | 4m51s | 133.8% | 239 |

穩態仍 ~120-150%，**debounce 有生效但不是決定因素**。

## 真正熱點（待處理 tech-debt）

依成本占比估計：

1. **Prompt rebuild O(N)**（約 40%）：每 `CODEX-WS REQ` 從 disk 把 239 items 組回 array 才能 slice。N 持續長大，每 REQ 成本線性增加。
2. **Bus → SSE message.part.updated 主路**（約 25%）：`4.6 events/sec × (light-part + delta)` 已是 light stripping 後成本，但還有 `share.ts`、`share-next.ts`、`session/monitor.ts`、`debug-writer.ts`、`tool/task.ts` 五個 subscriber 各自處理。
3. **Codex WS 收流 + storage write**（約 20%）：per-delta 仍走 debounced `Storage.write`（2026-04-23 hotfix 已處理，維持現狀）。
4. **其他**（約 15%）。

## 決策

- 這個 session 還在活躍工作，**不再熱補**。
- 等 session 結束後，針對 prompt assembly 做結構性 plan（`/specs/_archive/codex-prompt-rebuild-incremental/`），target：
  - 不再每 REQ 從零組 N-item array
  - 或 cache 上一次的 serialized prefix，只 append delta
- 本次 debounce 改動可獨立 commit（小、低風險、語意等價），作為 step 0。

## 先前關聯

- [feedback_no_silent_fallback.md](../../../.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_no_silent_fallback.md)
- [project_codex_cascade_fix_and_delta.md](../../../.claude/projects/-home-pkcs12-projects-opencode/memory/project_codex_cascade_fix_and_delta.md) — 同一個 session 系列的前期修復，記過 "WS delta not triggering (length-based comparison incompatible with AI SDK's rebuild model)"，當時沒追到 prompt rebuild 這層
- 2026-04-23 `partPersistenceSync` debounce hotfix（已 land）
