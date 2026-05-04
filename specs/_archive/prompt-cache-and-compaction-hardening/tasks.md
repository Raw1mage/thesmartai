# Tasks: prompt-cache-and-compaction-hardening

> Execution surface: `/home/pkcs12/projects/opencode-worktrees/prompt-cache-hardening` on branch `beta/prompt-cache-hardening`.
> Spec writes (this file, design.md, etc.): mainRepo at `/home/pkcs12/projects/opencode`.
> Always `source .beta-env/activate.sh` before any `bun test` / `bun run` in beta worktree.

Phase A 與 Phase B 拆分依據 [design.md "Migration / Rollout"](./design.md#migration--rollout)。Phase A 全部完成 + 合 main 之後，再徵詢使用者啟動 Phase B。

## 1. Phase A.1 — Anchor sanitizer (DD-6, R4)

- [x] 1.1 新檔 `packages/opencode/src/session/anchor-sanitizer.ts`：實作 `sanitizeAnchor(text, kind)` 回傳 `<prior_context source="{kind}">` 包裝 + 祈使句改寫。匯出 `SanitizedAnchorBody` 型別與 schema 對齊。
- [x] 1.2 對抗性單元測試 `anchor-sanitizer.test.ts`：覆蓋 imperative leading（10 種 pattern）、false-positive 候選、4 個 kind、byte-determinism、edge cases — 23 tests pass。
- [x] 1.3 接線到 `compaction.ts`：`defaultWriteAnchor` 統一 sanitize 走 narrative/replay-tail/low-cost-server；`tryLlmAgent` 在 streaming 完成後對每個 text part 呼叫 `Session.updatePart` 改寫為 sanitized。`log.info("compaction.anchor.sanitized")` telemetry 已加。
- [x] 1.4 docs/events 待第 6 phase 完成時隨 phase summary 一起寫（per [handoff.md Phase Boundary Ritual](./handoff.md#phase-boundary-ritual-per-plan-builder-164)）。commit: `0859abcc6` on `beta/prompt-cache-hardening`。

## 2. Phase A.2 — Idle compaction clean-tail gate (DD-7, R5)

- [x] 2.1 新增 `idleCompaction` precondition（commit `3ea194ab8`）。注意：opencode 用單一 ToolPart with state machine（pending/running/completed/error），非 Anthropic 風格 tool_use+tool_result；改為偵測 `state.status in {pending, running}`。
- [x] 2.2 抽出 `checkCleanTail(messages, windowSize)` 至新檔 `idle-compaction-gate.ts`；9 unit tests 覆蓋 clean / single dangling / multiple dangling / window size / user message skip / error 視為 clean。
- [x] 2.3 unclean 時 emit `compaction.idle.deferred` 並 return early（已實作）。
- [x] 2.4 (deferred) 整合測試延到 Phase A validation gate 的 manual smoke check（per observability.md）。理由：checkCleanTail 單元覆蓋完整，wire-up 是 7-line 條件 early return；不需要 Storage/Session 重型整合測試。

## 3. Phase A.3 — CapabilityLayer cross-account hard-fail (DD-8, R6)

- [x] 3.1 `CapabilityLayer.get` 加 `requestedAccountId` 參數；entry 加 `accountId` 欄位；fallback 比對。架構偏 `findFallbackEntry` 不變（filtering 留在 caller 層），對齊既有設計。
- [x] 3.2 cross-account 拋 `CrossAccountRebindError`；same-account 維持 WARN + degraded fallback。
- [x] 3.3 `CrossAccountRebindError` class 定義在 `capability-layer.ts`（colocated，與用法緊耦合）。
- [x] 3.4 5 unit tests in `capability-layer.cross-account.test.ts`，含 error payload 檢查（from / to / failures / code）。
- [x] 3.5 `prompt.ts` 既有 try/catch 改為先檢 `instanceof CrossAccountRebindError` 並 re-throw 出 runloop；其他 errors 維持 WARN 不阻擋（透過 caller passing accountId opt-in 行為）。
- [x] 3.6 (deferred) 整合測試延到 Phase A validation gate manual smoke。理由同 §2.4：5 unit tests + prompt.ts 整合是 8-line 變更，不需重型整合。
commit: `4fcc76f8f`.

## 4. Phase A.4 — Skill auto-pin + anchor metadata (DD-9, R7-skill-coherence)

- [x] 4.1 `pinForAnchor(sessionID, name, anchorId, reason)` + `unpinByAnchor(sessionID, anchorId)` + `pinnedByAnchors: Set<string>` 在 entry 上（多 anchor 並存安全）。
- [x] 4.2 `scanReferences(text, knownNames)` 用 word-boundary regex（轉譯 metachar，case-insensitive，無 substring 洩漏）。
- [x] 4.3 `compaction.ts defaultWriteAnchor` 增 `annotateAnchorWithSkillState`：找新 anchor id → scan → pinForAnchor 命中者 → unpinByAnchor 上一個 anchor → log `compaction.anchor.skill_snapshot` telemetry。`tryLlmAgent` 同步加，用 `processor.message.id` 為 explicit id。
- [x] 4.4 prev anchor 偵測：在 write 之前讀 `readMostRecentAnchorId`，write 之後再讀新 id；若不同則 unpin 舊 id。
- [x] 4.5 11 unit tests in `skill-anchor-binder.test.ts`（pin/unpin 生命週期 + scanReferences edge cases）。skillSnapshot 結構符 telemetry 格式（disk persistence on CompactionPart 延到 Phase B，schema 改動較大）。
- [x] 4.6 (post-merge) `packages/opencode/src/session/compaction.phase-a-wiring.test.ts` 新增 4 個 end-to-end 整合測試，跑完整 `SessionCompaction.run → kindChain → defaultWriteAnchor → annotateAnchorWithSkillState → SkillLayerRegistry.pinForAnchor` 鏈，確認單元測試覆蓋的 wire-up 在實際路徑也命中。commit: `abcd06ffc`。
commit: `caa6ef135`.

## 5. Phase A.5 — Cache miss diagnostic (DD-10, R7-diagnostic)

- [x] 5.1 in-memory rolling Map<sessionID, string[3]> in 新檔 `cache-miss-diagnostic.ts`（不動 schema；session.deleted Bus subscription 清理）。`llm.ts` 在 system 組裝完成 + Gemini 優化 + plugin transform 之後呼叫 `recordSystemBlockHash(sessionID, system.join("\n"))`。
- [x] 5.2 `shouldCacheAwareCompact` 在原條件全部通過後加 `diagnoseCacheMiss()`；non-compact 分流 return false。
- [x] 5.3 emit `compaction.cache_miss_diagnosis` telemetry（hashes 截 first-8-hex 入 log）。
- [x] 5.4 9 unit tests: insufficient evidence / churn (all-different & partial) / growth / threshold edge / session isolation / determinism.
commit: `5360a0716`. Phase A 對 `system.join` 視為單塊（對齊現況）；Phase B 拆 static 後改 hash 純 static 部分，churn 偵測精度會提高。

## 6. Phase A — Validation gate

- [x] 6.1 全部 unit tests 在 beta worktree 跑綠（57/57 pass，108 expect calls；記得 `source .beta-env/activate.sh`）。Integration tests 延到 6.3 手動煙霧測試。
- [x] 6.2 跑 `bun run typecheck` 無新錯誤。touched files 在 main 與 branch 上的錯誤計數均為 0；其餘 share-next.ts / codex-provider / console-function 的 pre-existing 錯誤與本分支無關。
- [-] ~~6.3 手動煙霧測試~~（deferred 至 Phase B.0.2 telemetry 觀察階段；單元測試覆蓋已足夠 finalize Phase A，dogfood window 自然會產生這些 telemetry 事件）。原項目內容：
  - 開一個 session 跑 5 turns，觀察 telemetry log 有 `compaction.cache_miss_diagnosis` 事件
  - 故意 trigger compaction（context overflow 或 manual /compact），grep anchor body 確認以 `<prior_context` 開頭
- [x] 6.4 phase summary: [docs/events/event_20260503_prompt-cache-hardening-phase-a-landed.md](../../docs/events/event_20260503_prompt-cache-hardening-phase-a-landed.md)
- [x] 6.5 rebase 到最新 main（兩次：onto `c27a127e8` 再 onto `09b0faa72`），無衝突。
- [N/A] 6.6 fetch-back via `test/prompt-cache-hardening-phase-a`：由於 rebase 零衝突且 main 在期間動的檔案（`incoming/*`）與 branch 觸碰的 `session/*` 完全不重疊，中介 test branch 提供零額外訊號，跳過直接 §7.1。
- [x] 6.7 STOP — 使用者於 2026-05-03 批准直接 merge 到 main。

## 7. Phase A — Finalize + cleanup

- [x] 7.1 `git merge --no-ff beta/prompt-cache-hardening` 進 main（在 mainRepo），含 5 個 implementation commits + 1 spec package commit。
- [N/A] 7.2 刪除中介 test branch — 未建立。
- [x] 7.3 main 為 authoritative。**2026-05-03 cleanup**：beta worktree (`/home/pkcs12/projects/opencode-worktrees/prompt-cache-hardening`) 已 `git worktree remove`；branch `beta/prompt-cache-hardening` (was `b1f3fa9c4`) 已 `git branch -d` 刪除（fully merged，安全）。Phase B 啟動時從 main 重建 worktree + 新 branch。

## 8. Phase B (校準 2026-05-04 — direct-ship, no flag, no dogfood)

> **Recalibration v2 (2026-05-04, user decision)**: telemetry 觀察 gate 跳過（收益判斷不顯著、收益方向確定）；feature flag 雙路徑跳過、dogfood gate 跳過；新架構為唯一路徑、day 1 default。
>
> **R1 mitigation 改為設計層內建**：preface 第一行強制 `## CONTEXT PREFACE — read but do not echo` directive，避免 LLM 把 user-role 內容當對話雜訊處理；不再倚賴事後 A/B 測試補救。
>
> 完整變動：
> - 砍 B.0.2 (telemetry observation gate)
> - 砍 B.4 feature flag wiring；新架構直接接管 llm.ts
> - 砍 B.9.3 LLM A/B test（mitigation baked into B.2.3）
> - 砍 B.10 dogfood 階段
> - 砍 B.11 default-on（從 day 1 default）
> - 回退路徑：revert commits（git 自然支援），不靠 flag
>
> Recalibration v1 (2026-05-03) 保留紀錄：對齊 DD-15 / DD-16、拆 B.1 schema preludes、加 Phase A→B 接縫表。

### 8.0 Phase B 前置條件（在 mainRepo 操作）

- B.0.1 ✅ provider-account-decoupling Phase 9 cutover 確認完成（marker `2026-05-03T14:50Z`、UI smoke 通過、spec 進 living）。
- ~~B.0.2~~ telemetry 觀察 gate **跳過**（user 2026-05-04 決定收益方向確定無需驗證）。
- B.0.3 從 main 重建 beta worktree：
  ```
  git worktree add -b beta/prompt-cache-hardening-phase-b \
    /home/pkcs12/projects/opencode-worktrees/prompt-cache-hardening-phase-b main
  ```
  + 寫 `.beta-env/activate.sh` (per [feedback_beta_xdg_isolation](../../.claude/projects/-home-pkcs12-projects-opencode/memory/feedback_beta_xdg_isolation.md))。
- B.0.4 confirm `MessageV2.User` / `MessageV2.CompactionPart` 在 `Session.updateMessage` / `Session.updatePart` 路徑接受 optional 新欄位（不需要 storage migration，僅 schema bump）。

### 8.1 Phase B.1 — Schema preludes (independent, shippable alone)

- B.1.1 `MessageV2.User` 加 `kind: z.literal("context-preface").optional()` (per [design.md DD-5 amended 2026-05-03](./design.md#decisions))；序列化 round-trip 測試
- B.1.2 `MessageV2.CompactionPart` 加 `metadata: z.object({ skillSnapshot: z.object({ active: z.array(z.string()), summarized: z.array(z.string()), pinned: z.array(z.string()) }).optional() }).optional()` (per DD-9 amended)
- B.1.3 新檔 `session/context-preface-types.ts`：純 type 定義 `ContextPrefaceParts` / `PreloadParts`（無 runtime；對齊 [data-schema.json](./data-schema.json)）

### 8.2 Phase B.2 — Decompose dynamic from static

- B.2.1 `session/preloaded-context.ts`：吐出 `PreloadParts { readmeSummary, cwdListing }` 結構；保留向後相容 string adapter
- B.2.2 `session/system.ts environment()`：分 `{ baseEnv, todaysDate }`（DD-2: date 放 T1 末段）
- B.2.3 新檔 `session/context-preface.ts`：`buildPreface(input)` 組裝 `ContextPrefaceMessage`，content blocks tier 標記 t1 / t2，slow-first 排序。**R1 mitigation**：preface 第一行固定 `## CONTEXT PREFACE — read but do not echo` directive，告知 LLM 此 user-role message 是 instruction-bearing context 而非對話。
- B.2.4 unit tests：preface byte-equality across stable session、T2 empty case、pinned-only case、directive header 永遠存在

### 8.3 Phase B.3 — Static system block + tuple resolver

- B.3.1 新檔 `session/static-system-builder.ts`：`buildStaticBlock(tuple)` 純函式 → `{ text, hash }`
- B.3.2 tuple resolver helper：從 (model, agent, account, role, AGENTS.md, SYSTEM.md, user-system) 派生 `StaticSystemTuple`，包含 `family` 與 `accountId`（per DD-15）
- B.3.3 family 解析經 `Account.resolveFamilyFromKnown(model.providerId, await Account.knownFamilies())`（per DD-16），fail loud on miss
- B.3.4 sha256 hash 對齊既有 `cache-miss-diagnostic.recordSystemBlockHash` 接口（DD-10 amended）
- B.3.5 unit tests：tuple 不變 → byte-equal；改 family / accountId / agent / AGENTS.md → 不等

### 8.4 Phase B.4 — Refactor llm.ts to new architecture (no flag)

- B.4.1 在 [llm.ts:483-604](../../packages/opencode/src/session/llm.ts#L483-L604) 直接以新路徑取代舊 `systemPartEntries.map().join("\n")`；無 feature flag、無雙路徑
- B.4.2 新流程：`buildStaticBlock(tuple)` → 單一純 static system message；`buildPreface(input)` → user-role message with `kind=context-preface`，插入 user message 之前
- B.4.3 plugin hook：static 走既有 `experimental.chat.system.transform`（接收純 static block）；preface 走新 `experimental.chat.context.transform`
- B.4.4 lite provider (DD-14) 不變；不下 BP2/BP3
- B.4.5 cache-miss-diagnostic recordSystemBlockHash 改餵 `staticBlock.hash` 而非 `system.join("\n")`（DD-10 amended）
- B.4.6 既有 unit tests：預期部分需要更新（system 結構從 9-layer-join 變 1-block-static）；逐個審查不是無腦改

### 8.5 Phase B.5 — Cache breakpoint allocator (4-BP)

- B.5.1 `provider/transform.ts applyCaching` 升級：偵測 system message + context-preface message + final non-system message
- B.5.2 BP1 在 static system 末尾、BP2/BP3 在 preface tier 末尾、BP4 在 conversation 末段（per DD-3）
- B.5.3 T2 為空時 BP3 omit、不重新分配
- B.5.4 unit tests：full preface → 4 BP；no T2 → 3 BP；no preface (flag off) → 既有 2 BP 行為
- B.5.5 multi-content-block in single message 的 cache_control 放置（前段 block 也要能下 BP，不只末尾）

### 8.6 Phase B.6 — Plugin hook + telemetry

- B.6.1 在 `plugin/index.ts` 註冊 `experimental.chat.context.transform`，payload 對齊 [data-schema.json `PluginContextTransformInput`](./data-schema.json)
- B.6.2 舊 hook 注入 dynamic 內容偵測：WARN log `plugin.legacy_dynamic_injection_warn`（一個 release 兼容期，per DD-11）
- B.6.3 新 telemetry events：`prompt.cache.system.{hit,miss}`、`prompt.cache.preface.t1.{hit,miss}`、`prompt.cache.preface.t2.{hit,miss}` — 從 LLM 回應 cache headers 派生（per DD-13）

### 8.7 Phase B.7 — Skill anchor snapshot 持久化

- B.7.1 `compaction.ts annotateAnchorWithSkillState`：將 `skillSnapshot` 寫入 anchor 的 compaction part `metadata.skillSnapshot`（per DD-9 amended）
- B.7.2 既有 telemetry-only `log.info("compaction.anchor.skill_snapshot")` 保留為 backup signal
- B.7.3 unit tests：persisted anchor 含 skillSnapshot；舊 anchor (Phase A 期間寫入的) 沒 metadata graceful；replay 流程能讀

### 8.8 Phase B.8 — Docs

- B.8.1 改寫 [docs/prompt_injection.md](../../docs/prompt_injection.md) 第 1-30 行 9 層圖示為「7 static system + N dynamic context」雙軌；保留權威鏈聲明
- B.8.2 新檔 `docs/prompt_dynamic_context.md`：preface 結構、tier ranking、breakpoint 配置、plugin hook migration guide
- B.8.3 在 [specs/architecture.md](../architecture.md) 加 Phase B 落地紀錄

### 8.9 Phase B.9 — Validation gate + finalize

- B.9.1 全部 unit + integration tests 在 beta worktree 跑綠（記得 `source .beta-env/activate.sh`）
- B.9.2 `bun run typecheck` 無新錯誤（不計 share-next.ts pre-existing）
- B.9.3 ~~LLM A/B test~~ 跳過 — R1 mitigation 已 baked into B.2.3 (directive header)
- B.9.4 手動煙霧：跑 10 turns，確認 `prompt.cache.preface.{t1,t2}.hit` telemetry 出現
- B.9.5 寫 phase summary `docs/events/event_<YYYYMMDD>_phase-b-landed.md`
- B.9.6 rebase 到最新 main、解衝突；STOP for user finalize approval

### 8.10 Phase B.10 — Finalize + cleanup

- B.10.1 `git merge --no-ff beta/prompt-cache-hardening-phase-b` 進 main
- B.10.2 spec 走 `plan-promote --to verified` 然後 `--to living`（per design.md amended Migration/Rollout）
- B.10.3 worktree remove + branch delete（同 Phase A cleanup pattern）
- B.10.4 監測 production telemetry 1-2 週，確認 cache hit rate 達標：BP1 ≥ 95%、BP2 ≥ 80%、BP3 ≥ 60% (per spec.md acceptance checks)；若不達標開 follow-up amend
- B.10.5 一個 release 後移除 `plugin.legacy_dynamic_injection_warn` 兼容路徑（B.6.2）

### 8.12 Phase A → Phase B 接縫表

| Phase A 留給 Phase B 的 hook | Phase B 動作 |
|---|---|
| `cache-miss-diagnostic.recordSystemBlockHash` 入口已存在，但餵 `system.join` | B.4.6 改餵 `staticBlock.hash`；接口不變 |
| `annotateAnchorWithSkillState` 寫入 telemetry-only snapshot | B.7.1 補 disk persistence 至 `CompactionPart.metadata.skillSnapshot` |
| `idle-compaction-gate.checkCleanTail` 已上線且與架構正交 | 不動 |
| `CrossAccountRebindError` 已對齊 (family, accountId) | 不動，B.3 / B.4 沿用同一 (family, accountId) 解析 |
| Phase A test 套件 (107 tests) | B.9.1 跑時必須仍綠 |

## Dependencies between phases

- Phase A: 已 land 2026-05-03；各 task 互相獨立
- Phase B 內部依賴（校準 2026-05-03）：
  - B.0 全部完成才能進 B.1
  - B.1 (schema) 可獨立 ship；後續 phase 仰賴新欄位
  - B.2 與 B.3 並行 OK；皆完成才能進 B.4
  - B.4 ← B.1 + B.2 + B.3 + B.6.1 (hook 註冊先行)
  - B.5 與 B.4 可並行開始；validation 前匯流
  - B.7 ← B.1.2 (CompactionPart schema)
  - B.8 在 B.4-B.7 完成後寫
  - B.9 是 validation gate；全綠後 STOP for user
  - B.10 是 dogfood gate；達標後 B.11 取得獨立批准

## Stop gates

- ~~6.7~~ Phase A 已 finalize
- ~~B.0.1~~ Phase 9 cutover 已完成（marker 2026-05-03T14:50Z）
- ~~B.0.2~~ telemetry gate 跳過（user 2026-05-04 決定）
- B.9.6 Phase B validation 全綠後 STOP for user finalize approval
- B.10.4 production telemetry < acceptance check 需 follow-up amend
- 任何衝突或測試紅 — 立即停手回報
