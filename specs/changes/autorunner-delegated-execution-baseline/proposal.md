# Proposal

## Why

- runner 現在已具備兩個前提：
  1. approved mission authority
  2. approved mission consumption baseline
- 但目前 autonomous flow 仍只會產生 generic continuation text，尚未真正依 mission 內容決定「該由哪種 execution role 接手下一步」。
- 若沒有 delegated execution baseline，runner 仍然只是會讀 spec 的 prompt loop，而不是能依 spec 啟動受控委派的 execution owner。

## What Changes

- 定義 delegated execution baseline：讓 runner 能從 approved mission + actionable todo 推出最小 delegation hint。
- 第一輪只做 bounded role selection / continuation contract，不直接實作完整多代理編排引擎。
- 將 execution role 明確限制在 mission-derived、可觀測、可測試的範圍內。

## Capabilities

### New Capabilities

- `autorunner-delegated-execution-baseline`
  - runtime 可根據 approved mission 與 actionable todo 產生最小 delegation role hint。
- `autorunner-role-shaped-continuation`
  - synthetic continuation 可帶明確 execution role，例如 coding/testing/docs/review。

### Modified Capabilities

- `autorunner-spec-execution-runner`
  - 從「mission 可被讀取」提升為「mission 能開始影響 execution role」。

## Impact

- 影響 `packages/opencode/src/session/workflow-runner.ts`
- 可能新增 mission role-derivation helper
- 影響 workflow-runner tests 與 session prompt side metadata
- 本 slice 仍不包含 cms sync
