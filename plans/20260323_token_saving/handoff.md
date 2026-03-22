# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State

- Plan 已建立，所有 artifacts 已完成
- 尚未開始任何實作
- Telemetry 分析數據已收集，作為 baseline：
  - 130 rounds, 229 compactions, 14 cache-miss rounds (61.7%)
  - System prompt ~7,720 tokens/prompt
  - Overall cache hit rate: 80.7%

## Stop Gates In Force

- 方案 C prefix-preserving compaction 實測後若 cache hit rate 無改善 → 暫停方案 C
- AGENTS.md 精簡後若 LLM 行為品質下降 → 回退方案 D
- Emergency compaction 若觸發 API error → 重新調整閾值

## Build Entry Recommendation

- **Phase 1 先行**（方案 A + B）：改動最少、風險最低、立即見效
- Phase 1 完成後收集新 telemetry 數據作為 Phase 2 baseline
- Phase 3（方案 D）可與 Phase 1 平行進行（純文件工作，不影響程式碼）
- Phase 2（方案 C）最後做，因為改動最大且需要 Phase 1 的冷卻期配合

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
- [x] Telemetry baseline 已收集
- [x] Critical files 已識別並讀取
