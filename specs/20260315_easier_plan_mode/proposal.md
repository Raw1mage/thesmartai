# Proposal: easier_plan_mode

## Why

- 目前 plan mode 被定義得過於嚴謹，導致 casual debug / small fix / exploratory work 也被迫假裝成完整 planner workflow。
- 使用者希望放寬 todo 更新條件：plan mode 可自由運作，build mode 才嚴格與 planned tasks 對齊。

## Effective Requirement Description

1. 讓 plan mode 同時代表 planner-first mode 與 casual/debug mode。
2. 讓 plan mode 的 todo 成為 working ledger，而不是只能是 planner projection。
3. 讓 build mode 的 todo 繼續作為 execution ledger，嚴格綁定 planned tasks。
4. 一併修復 `todowrite` 的 mode-aware 與 sync 能力，避免 sidebar/runtime todo 再次在 plan/build 邊界漂移。

## Constraints

- 不可破壞 build mode 的 mission / approval / task authority。
- 不可讓 build mode 回退成 freeform todo 驅動。
- 不可新增 fallback-based repair 機制。

## Decision Summary

- 使用者已同意把這個問題做成小 plan，且明確批准：除了放寬 plan mode 外，還要一併修復 `todowrite` 的 mode-aware 與 sync 能力。
- 因此本 plan 不只是 prompt policy rewrite，而是 runtime todo authority rewrite。
