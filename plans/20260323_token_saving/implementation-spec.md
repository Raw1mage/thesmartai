# Implementation Spec

## Goal

- 透過降低 compaction 頻率、保留 cache prefix、精簡 system prompt，將長 session 的 token 浪費降低 50% 以上

## Scope

### IN

- Compaction 觸發閾值邏輯修改（方案 A）
- Compaction 冷卻期機制（方案 B）
- Prefix-preserving compaction 結構改造（方案 C）
- Global/Project AGENTS.md 與 SYSTEM.md 去冗餘（方案 D）
- Config schema 擴展以支援新設定
- Template 同步

### OUT

- Provider-specific cache control API
- Session lifecycle 改動
- Pruning 機制改動
- Web UI 變更

## Assumptions

- OpenAI server-side cache 基於 message prefix 匹配，cache 存活 5-10 分鐘
- gpt-5.4 的 context limit 為 272,000 tokens，output limit 有獨立保護
- Compaction summary 品質不會因為只看到 partial history 而顯著下降（summary prompt 仍收到完整 old messages）
- 冷卻期內 context 不會超出 API hard limit（有 emergency compaction 保底）

## Stop Gates

- 如果 prefix-preserving compaction（方案 C）實測後 cache hit rate 沒有改善 → 暫停方案 C，只保留 A+B
- 如果 AGENTS.md 精簡後 LLM 行為品質明顯下降 → 回退方案 D
- 如果 emergency compaction hard ceiling 觸發 API error → 需要重新調整閾值

## Critical Files

- `packages/opencode/src/session/compaction.ts`
- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/src/config/config.ts`
- `/home/pkcs12/.config/opencode/AGENTS.md`
- `/home/pkcs12/projects/opencode/AGENTS.md`
- `/home/pkcs12/.config/opencode/prompts/SYSTEM.md`
- `/home/pkcs12/projects/opencode/templates/AGENTS.md`

## Structured Execution Phases

### Phase 1: Compaction 閾值 + 冷卻期（方案 A + B）

低風險、高收益、改動最少。直接減少 compaction 頻率。

1. 擴展 config schema 新增 `compaction.headroom` 和 `compaction.cooldownRounds`
2. 修改 `inspectBudget()` 使用 headroom 計算 usable
3. 新增 per-session `lastCompactionRound` tracking
4. 修改 `isOverflow()` 加入冷卻期判斷
5. 新增 emergency compaction hard ceiling（不受冷卻期限制）
6. 驗證：重跑 telemetry benchmark，確認 compaction 頻率下降

### Phase 2: Prefix-preserving compaction（方案 C）

中等工作量、最高收益。改變 compaction 後的 message 結構以保留 cache prefix。

1. 修改 `process()` 將 messages 分為 [old] 和 [recent] 兩段
2. Summary 只基於 [old] messages 生成
3. 保留 [recent] messages 原樣
4. 確保 summary message 正確標記 `summary: true`
5. 驗證：telemetry benchmark 確認 compaction 後 cacheReadTokens > 0

### Phase 3: System prompt 去冗餘（方案 D）

純文件工作。降低每次 prompt 的固定開銷。

1. 逐行分析 Global AGENTS.md vs Project AGENTS.md vs SYSTEM.md 的重複
2. 建立去冗餘對照表（哪些段落保留在哪一層）
3. 精簡 Global AGENTS.md
4. 精簡 Project AGENTS.md
5. 同步 templates/AGENTS.md
6. 驗證：token 計數降到 < 5,500，指令完整性比對通過

## Validation

- **Phase 1 驗證**：啟動 session，觀察 telemetry 中 compaction 事件頻率；130 rounds 場景 compaction 次數 < 50
- **Phase 2 驗證**：compaction 後第一個 round 的 cacheReadTokens > 0（代表 prefix 保留成功）
- **Phase 3 驗證**：telemetry prompt event 中 dynamic_system + core_system_prompt < 5,500 tokens
- **整體驗證**：cache-miss rounds 佔比 < 20%，overall cache hit rate > 90%
- **回歸測試**：無 context overflow API error，compaction summary 品質不下降

## Handoff

- Build agent must read this spec first.
- Build agent must read companion artifacts before coding.
- Build agent must materialize runtime todo from tasks.md.
- Phase 1 和 Phase 2 涉及 TypeScript 改動，需載入 `code-thinker` skill。
- Phase 3 是純文件工作，不需要特殊 skill。
