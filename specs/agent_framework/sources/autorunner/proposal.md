# Proposal: autorunner

## Why

- `autorunner` 的核心目標已從抽象自主執行願景收斂為可驗證的 spec-driven runner contract。
- 既有 dated packages 分散了 authority：一份聚焦 runtime evidence substrate，另一份聚焦 planner/bootstrap/delegation contract。
- 需要一個 canonical semantic root 來保存已驗證的 autorunner 規格，同時吸收後續 mission-consumption 與 delegated-execution supporting slices。

## Merged Sources

- `/home/pkcs12/projects/opencode/specs/20260313_autorunner-spec-execution-runner/`
- `/home/pkcs12/projects/opencode/specs/20260315_autorunner/`

## Effective Requirement Description

1. runner 的 execution authority 必須來自已批准且已完整編譯的 OpenSpec-style 開發計畫。
2. runner 的第一個真實產品用例是消費 repo 內的開發計畫，並以受限、可觀測的 delegation contract 持續推進 coding/testing/docs/review 等工作。
3. runtime 必須建立最小 event evidence substrate，將 `wait_subagent` 類 stale mismatch 與 mission consumption failure 轉成顯式可追溯信號，而不是 silent fallback。
4. bootstrap、planner artifacts、runner prompts、workflow contracts 必須共同形成 delegation-first、gate-driven auto-continue execution environment。
5. daemon / multi-access attachable runtime 仍是候選長期方向，但不是此 canonical spec 的已承諾交付。

## Scope

### IN

- approved plan authority contract
- mission consumption baseline
- bounded delegated execution baseline
- runtime anomaly / journal baseline
- planner/bootstrap/prompt contract alignment for autorunner

### OUT

- full daemon mesh rewrite
- unrestricted multi-agent orchestration
- silent fallback when mission/artifact/runtime truth drifts
- direct cms sync work

## What Changes

- Consolidate autorunner planning history into one semantic root: `specs/autorunner/`.
- Preserve supporting slices for mission consumption and delegated execution beside the main six files.
- Treat predecessor dated roots as migration sources rather than active authorities.

## Capabilities

### New Capabilities

- `autorunner-approved-plan-authority`
- `autorunner-mission-consumption-baseline`
- `autorunner-delegated-execution-baseline`
- `autorunner-runtime-anomaly-evidence`

### Modified Capabilities

- `planner-to-runtime-handoff`
- `agent-workflow delegation contract`
- `autonomous-workflow observability`

## Impact

- `packages/opencode/src/session/**`
- `packages/opencode/src/tool/plan.ts`
- runtime prompts / workflow skills / AGENTS contracts
- `docs/ARCHITECTURE.md` and related event records when architecture wording changes
