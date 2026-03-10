## Requirements

- 修復 session-based model assignment 上線後，session 內手動 rotate / pick model 會在數秒後跳回舊 model 的 regression。

## Scope

### In

- Web session page 初次 hydrate 的 model restore 行為
- TUI session prompt 初次 hydrate / assistant-driven model sync 行為
- 針對 rotate/model picker regression 的 targeted 驗證

### Out

- rotation3d 策略重寫
- provider/account fallback 規則重做
- release / push

## Task List

- [x] 建立 regression baseline 與 evidence
- [x] 找出 rotation3d 卡死與 working-turn model overwrite 的實際邊界
- [x] 修正跨 provider fallback 候選池與 TUI working-turn overwrite
- [x] 補上 provider-wide cooldown promotion 與至少 5 小時 cooldown guardrail
- [x] 跑 targeted 驗證
- [x] 同步 architecture 檢查

## Baseline

- 使用者回報：實作 session-based model assignment 後，session 內手動換 model 會失效；換完幾秒後會跳回原本 model。
- 使用者進一步補充：更嚴重的是 rotation3d 在 provider 用盡後不願跨 provider 切換（例：github-copilot 用完後不切 openai），導致 workflow 卡死。
- 使用者明確要求：若某 model/provider 已被循環驗證不可用，要給夠長的 cooldown，至少 5 小時。
- 使用者後續以多個 session 同時驗證，確認目前「每個 session 不同 model」依然失敗：其中一個 session 切 model，其他 session 最終也會跟著變。
- 調查後確認不是單一 hydrate 問題，而是三層疊加：
  1. runtime cross-provider fallback candidate universe 太窄
  2. provider-wide exhaustion 沒被提升成 provider-level cooldown
  3. TUI working-turn 的 assistant-driven model sync 會把使用者為下一輪手動改的 model 覆回舊值
  4. Web/TUI local model state 的 key 其實仍是 `agent`，不是 `sessionID + agent`

## Instrumentation / Evidence

- `docs/ARCHITECTURE.md`
  - session execution identity 已定義為 `{ providerId, modelID, accountId? }`
  - session model selection 與 global active account 已被定義為不同邊界
- `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
  - `lastAssistantMessage -> local.model.set(...)` 的 fallback sync path 會在 working turn 期間跟著當前執行模型更新 local selection
- `packages/opencode/src/session/llm.ts`
  - pre-flight 與 runtime fallback 都走 `handleRateLimitFallback()`
  - 這條路徑不會經過 session/model-orchestration 的全域候選池
- `packages/opencode/src/account/rotation3d.ts`
  - `buildFallbackCandidates()` 對跨 provider 候選原本只納入：
    - `model.json` favorites
    - `opencode` free rescue models
  - 因此若 `openai` 未被加入 favorites，`github-copilot -> openai` 的 runtime fallback 可能根本看不到 openai 候選
- `packages/opencode/src/account/rate-limit-judge.ts`
  - 先前只標記 model-level vector cooldown，沒有把 provider-wide exhaustion 升級成 provider-level cooldown
- `packages/opencode/src/account/rotation/rate-limit-tracker.ts`
  - `isRateLimited(account, provider, model)` 在傳入 model 時只看 model-level state，不看 provider-level state
  - 但上層 selector / provider availability 都把這個 API 當成會同時覆蓋 provider-level block
- `packages/app/src/context/local.tsx`
  - web local model state 先前以 `ephemeral.model[agentName]` 存放選模結果
  - `selection/current/set` 雖然是 session 頁面在呼叫，但底層 key 仍是全域 per-agent
- `packages/opencode/src/cli/cmd/tui/context/local.tsx`
  - TUI local model state 先前以 `modelStore.model[agentName]` 存放選模結果
  - 因此只要多個 session 共用同一個 agent（例如 `coding`），切換會互相污染

## Root Cause

1. **Cross-provider candidate universe 原本過窄，但那不是完整 root cause**
   - session runtime rate-limit fallback 依賴 `rotation3d.findFallback()`。
   - `findFallback()` 的跨 provider 候選生成原本只讀 favorites + opencode rescue。
   - 這會讓 `github-copilot -> openai` 在 favorites 缺省時根本看不到 openai 候選。
2. **更核心的 root cause：provider-wide exhaustion 沒有被提升成 provider-level cooldown**
   - `RateLimitJudge.markRateLimited()` 先前只把失敗記到單一 `(provider, account, model)` vector。
   - 對於 `QUOTA_EXHAUSTED` / `RATE_LIMIT_LONG` / `TOKEN_REFRESH_FAILED`，以及 repeated same-day generic rate-limit，實際上常代表整個 provider/account 暫時不可用；但 rotation state 沒有建立 provider-level block。
   - 結果：rotation 仍會優先在同一 provider 內換 model / 重試，而不是乾淨地跳到其他 provider。
3. **Provider-level block 即使存在，也沒有被大部分 selector 正確尊重**
   - `RateLimitTracker.isRateLimited(account, provider, model)` 在傳入 `model` 時只檢查 model-level state，不看 provider-level state。
   - 但上層 `rotation3d`, `provider/provider.ts`, `model-orchestration.ts` 都把這個 API 當成「model + provider cooldown」一起判斷。
   - 結果：即使補了 provider-level block，selector 仍可能錯誤地把同 provider 其他 model 當作可用。
4. **真正導致多 session 串模的 root cause：local model slot 仍是 per-agent，不是 per-session**
   - Web `packages/app/src/context/local.tsx` 用的是 `ephemeral.model[a.name]`。
   - TUI `packages/opencode/src/cli/cmd/tui/context/local.tsx` 用的是 `modelStore.model[a.name]`。
   - 這代表 session-local UI 雖然會從不同 session hydrate 不同 model，但最終都回寫到同一個 agent slot；同 agent 的多個 session 仍互相覆蓋。
5. **Secondary root cause: TUI working-turn overwrite**
   - TUI prompt 會從 `lastAssistantMessage` 同步當前執行中的 provider/model/account 回 local selection。
   - 若使用者在這個 working turn 期間手動切 model，該 selection 是給「下一輪」使用；但舊邏輯仍會被正在執行中的 assistant sync 覆回上一輪/當前輪模型。
6. **殘留 root cause：session-scoped read path 仍會 fallback 到 legacy per-agent slot**
   - 即使已把 state key 改成 `sessionID + agent`，Web/TUI local context 的 `resolveScopedSelection/resolveScopedModel` 仍保留 `ephemeral.model[a.name]` / `modelStore.model[a.name]` 作為次要 fallback。
   - 這導致某些 session 在 scoped slot 缺失、尚未 hydrate、或重新計算時，仍可能吃到另一個 session 先前寫入的 legacy global agent slot，最後再次收斂成同一個 model。

## Execution / Decisions

1. `packages/opencode/src/account/rotation3d.ts`
   - 保留同 provider favorites / same-account / same-model 的原有策略。
   - 額外加入 **3b cross-provider broadened candidates**：
     - 對每個已連線且未隱藏的 provider，納入排序後前幾個非 deprecated model 作為 `diff-provider` 候選。
     - 這讓 runtime fallback 在 favorites 缺省時，仍能看到 openai / google-api / 其他可用 provider。
2. `packages/opencode/src/account/rotation/backoff.ts`
   - 將 `QUOTA_EXHAUSTED` 首次 cooldown 提高到 **至少 5 小時**。
   - 將 repeated same-day `RATE_LIMIT_EXCEEDED` / `UNKNOWN` 長 cooldown 提高到 **5 小時**，避免在已被證實不可用的 provider/model 上持續循環探測。
3. `packages/opencode/src/account/rate-limit-judge.ts`
   - 新增 provider-wide cooldown promotion 規則：
     - `QUOTA_EXHAUSTED`
     - `RATE_LIMIT_LONG`
     - `TOKEN_REFRESH_FAILED`
     - generic `RATE_LIMIT_EXCEEDED` / `UNKNOWN` 但已被判定為 long cooldown（>= 5h）
   - 這些情況除了標記 model-level vector，還會額外標記 provider-level cooldown。
4. `packages/opencode/src/account/rotation/rate-limit-tracker.ts`
   - 修正 `isRateLimited(account, provider, model)`：當傳入 model 時，也會一併檢查 provider-level cooldown。
   - 這讓 rotation selector / model availability / orchestration 對 provider-wide cooldown 的判斷終於一致。
5. `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`
   - 對 `lastAssistantMessage` 驅動的 local.model sync 增加保護：
     - 若目前 local selection 已經和最後一個 user message 的 model 不同，視為使用者已經為下一輪手動切換 model。
     - 此時 assistant sync 不再覆寫 local selection。
6. `packages/app/src/context/local.tsx` / `packages/opencode/src/cli/cmd/tui/context/local.tsx`
   - local model state key 改成 `sessionID + agent` 雙鍵；未提供 sessionID 時才退回全域 slot。
   - `current/set/cycle/selection/variant/currentAccountId` 等 helper 都補上可選 `sessionID` scope。
7. Web/TUI session surfaces
   - session page hydrate、prompt input、submit、session commands、model dialogs、TUI prompt/sidebar/session route/admin/model dialog，改為顯式傳入當前 `sessionID`。
8. Web/TUI local context follow-up hardening
   - 對於 **有 `sessionID` 的 read path**，移除 fallback 到 legacy per-agent slot 的邏輯。
   - legacy global per-agent slot 只保留給未進入 session scope 的首頁 / 全域 UI 使用。

## Validation

- Existing targeted unit test:
  - `bun test /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation3d.test.ts` ✅
- Additional targeted tests:
  - `bun test /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/backoff.test.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/rate-limit-tracker.test.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rate-limit-judge.test.ts` ✅
- Lint:
  - `bunx eslint /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/backoff.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/rate-limit-tracker.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rate-limit-judge.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/backoff.test.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation/rate-limit-tracker.test.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rate-limit-judge.test.ts /home/pkcs12/projects/opencode/packages/opencode/src/account/rotation3d.test.ts` ✅
- Scoped session model validation:
  - `bunx eslint` on touched Web/TUI local-state and session-surface files ✅
  - `bun run typecheck` in `packages/app` ✅
  - `bun run typecheck` in `packages/opencode` ✅
- Legacy fallback removal validation:
  - `bunx eslint /home/pkcs12/projects/opencode/packages/app/src/context/local.tsx /home/pkcs12/projects/opencode/packages/opencode/src/cli/cmd/tui/context/local.tsx` ✅
  - `bun run typecheck` in `packages/app` ✅
  - `bun run typecheck` in `packages/opencode` ✅
- Architecture Sync: Verified (No doc changes)
  - 依據：本輪修的是 fallback/cooldown 判定、session-local state scope、與 TUI sync guard，未改變長期模組邊界；既有 architecture 對 session identity / control-plane boundary 的描述仍成立。
