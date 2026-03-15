# Proposal: openclaw runner benchmark

## Why

- 目前 autorunner 已補齊 planner / bootstrap / prompt contract，但距離 7x24 持續運行 agent 仍有明顯差距。
- 使用者希望直接向 OpenClaw 對標，理解成熟長時自治 agent 的控制面，並反推 opencode runner 下一步該怎麼演進。

## Effective Requirement Description

1. 搞清楚 OpenClaw 如何支撐 7x24 agent：loop、queue、scheduler、persistence、recovery、gates、observability。
2. 不停留在研究摘要；必須回到現有 runner，說清楚哪些缺口最重要。
3. 必要時可規劃復刻 / 移植其核心，但必須先做可移植性與風險判斷。

## Scope

### IN

- OpenClaw benchmark research
- current autorunner runner substrate comparison
- next-phase runner evolution planning

### OUT

- immediate large-scale code port
- speculative design without evidence
- fallback-based workaround proposals

## Constraints

- 必須保留 fail-fast、no-silent-fallback 原則。
- 不能把外部專案的假設直接當成 opencode 的現況。
- 若研究結論不確定，必須保留 unknowns，不得腦補。

## Decision Summary

- OpenClaw 最值得移植的不是產品層 channel/gateway feature set，而是 control-plane 思維：
  1. always-on daemon / gateway
  2. lane-aware queue
  3. heartbeat / cron / wakeup 作為 first-class trigger sources
  4. isolated autonomous job sessions
  5. restart / drain / observability contract
- opencode 下一輪不應直接照搬 OpenClaw channel-centric runtime，而應先把現有 runner 升級成 scheduler-ready substrate。

## Proposed Direction

- 短期：先做 trigger model + queue substrate generalization。
- 中期：補 isolated job sessions + heartbeat / wakeup。
- 長期：再做 host-wide daemon lifecycle、restart drain、scheduler observability。
