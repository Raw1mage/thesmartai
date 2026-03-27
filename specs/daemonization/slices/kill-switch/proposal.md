# Proposal: Kill-switch

## Why

- OpenCode needs a controlled emergency stop path for autonomous/runtime activity so operators can pause or terminate automation safely during incidents.
- The runtime already spans daemon, scheduler, agent execution, and control-plane surfaces, so kill-switch behavior must be explicit, auditable, and resistant to partial shutdown ambiguity.

## Original Requirement Wording (Baseline)

- "需要一個 kill-switch，讓有權限的操作者能暫停或終止自動代理系統。"
- "必須支援受控 API / Web / TUI 觸發，並保留 audit 與 snapshot 能力。"

## Requirement Revision History

- 2026-03-16: initial implementation planning captured global kill-switch semantics, RBAC/MFA, snapshot orchestration, and runtime integration requirements.
- 2026-03-16 onward: core backend, CLI, soft-kill, hard-kill, snapshot, Web settings control surface, and tests landed; TUI hotkey follow-up and security sign-off remained pending in the slice task list.

## Effective Requirement Description

1. The system must provide a privileged kill-switch that can stop or pause autonomous runtime activity in a controlled, observable way.
2. Trigger/cancel behavior must be auditable and protected by RBAC/MFA.
3. New task launches must short-circuit when kill-switch is active, and running work must move through soft-kill to hard-kill semantics when needed.

## Scope

### IN

- Global kill-switch API/state model
- RBAC/MFA protection for trigger/cancel paths
- Agent/scheduler preflight checks
- Soft-pause and hard-kill runtime behavior
- Snapshot/audit integration
- CLI control surface

### OUT

- Additional Web admin hardening beyond the shipped settings control surface
- Full TUI hotkey completion in this slice
- Cross-cluster / multi-region kill-switch replication
- Provider-side restart/remediation orchestration

## Non-Goals

- Replacing all runtime control behavior with kill-switch-specific logic
- Silent best-effort shutdown without audit evidence

## Constraints

- Security-sensitive paths must remain explicit and reviewable
- Runtime must fail closed for new task starts while active
- Snapshot failure must not block state write or audit trail

## What Changes

- Added kill-switch state, trigger/cancel semantics, and runtime enforcement hooks
- Added audit/snapshot-oriented operational model
- Added CLI and shipped Web operator surfaces while leaving TUI/security follow-up work pending

## Capabilities

### New Capabilities

- Emergency runtime stop control with soft-kill and hard-kill phases
- Auditable kill-switch trigger/cancel flow with snapshot support

### Modified Capabilities

- Agent/scheduler startup now respects kill-switch state
- Runtime control plane now includes an explicit operator stop boundary

## Impact

- `packages/opencode/src/server/killswitch/*`
- `packages/opencode/src/server/routes/killswitch.ts`
- `packages/opencode/src/cli/cmd/killswitch.ts`
- scheduler / agent launch preflight paths
- kill-switch docs, runbook, and security review artifacts
