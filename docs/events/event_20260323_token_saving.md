# Event: Token Saving Optimization

**Date**: 2026-03-23
**Plan**: `/plans/20260323_token_saving/`

## 需求

長 session 中 compaction 導致 LLM server-side cache 失效，造成大量 input tokens 浪費。Telemetry 分析發現 130 rounds session 中 229 次 compaction，14 個 cache-miss rounds 佔 61.7% total input tokens。

## 範圍

### IN
- 方案 A: Compaction 閾值調高（headroom 8000）
- 方案 B: Compaction 冷卻期（default 8 rounds）
- 方案 C: Prefix-preserving compaction（Phase 2，尚未實作）
- 方案 D: Global/Project AGENTS.md 去冗餘

### OUT
- Provider-specific cache API
- Session lifecycle 改動
- SYSTEM.md 改動

## 任務清單

引用 tasks.md items：1.1-1.6（完成）、2.1-2.6（Phase 2）、3.1-3.5（完成）

## Key Decisions

1. **DD-1**: `headroom` default 8000 tokens（從 20000 降低），延後 compaction 觸發
2. **DD-2**: `cooldownRounds` default 8 rounds，防止振盪
3. **DD-3**: Emergency ceiling = context - 2000，不受冷卻期限制
4. **DD-4**: AGENTS.md 分層：SYSTEM.md 最高權威 > Global（指揮官戰術）> Project（專案規範）

## Implementation Details

### Phase 1: compaction.ts + prompt.ts + config.ts

- `config.ts`: 新增 `compaction.headroom` 和 `compaction.cooldownRounds` schema 欄位
- `compaction.ts`:
  - `inspectBudget()` 使用 headroom 計算 usable，新增 `emergency` 和 `cooldownRounds` 回傳
  - `isOverflow()` 擴展簽名加入 `sessionID` + `currentRound`，加入 cooldown 判斷和 emergency bypass
  - 新增 `recordCompaction()` 和 `getCooldownState()` 管理 per-session 冷卻狀態
- `prompt.ts:854-866`: overflow 檢查傳入 sessionID + step，compaction create 前記錄 round

### Phase 3: AGENTS.md 去冗餘

| 文件 | Before | After | Reduction |
|---|---|---|---|
| Global AGENTS.md | 13,252 B | 1,669 B | 87% |
| Project AGENTS.md | 15,123 B | 4,197 B | 72% |
| SYSTEM.md | 10,653 B | 10,653 B | 0% |
| **Total** | **39,028 B** | **16,519 B** | **58%** |

去除的重複：語言回應規範、開發任務預設工作流、核心文件責任分工、Debug契約、Enablement Registry、Token最佳化、Subagent指派標準、跨專案SOP基線、禁止fallback。

## Verification

### Phase 1
- [x] TypeScript transpile pass（bun build --no-bundle）
- [ ] Telemetry 實測：compaction 頻率下降
- [ ] 無 context overflow API error

### Phase 3
- [x] templates/AGENTS.md 同步完成
- [ ] Telemetry 確認 dynamic_system + core_system_prompt < 5,500 tokens
- [ ] 指令完整性比對

### Architecture Sync
- Architecture Sync: Not applicable — 本次改動未影響模組邊界或資料流結構，compaction 參數調整屬於行為調優

## Remaining

- Phase 2（方案 C: prefix-preserving compaction）尚未開始
- 需要實際 session telemetry 驗證 Phase 1 效果
- 精簡後的 AGENTS.md 需觀察 LLM 行為品質
