# Proposal

## Why

- `apply_patch` previously looked opaque while running: the card remained effectively inert until final completion metadata arrived, making long executions appear stalled.
- Operators needed pre-completion visibility rather than raw speed improvements.

## Original Requirement Wording (Baseline)

- "解釋一下apply_patch這個tool的運作流程，因為每次調用這個tool call的時候會出現幾個問題。1. 執行時間非常久 2. 執行過程不透明，subagent停滯、Orchestrator停滯，全都在等apply_patch，卻又掌握不到進度。3. apply_patch標題列的「展開鍵」在完成工作前，按了是沒有回應的，看不到過程。4. 唯一能看到的就是task monitor可以看到有apply_patch卡片存在，但也是靜態卡片，1 不是問題，但是根本問題是3"

## Requirement Revision History

- 2026-03-22: reframed from explanation-only into an implementation plan and then a completed feature.
- 2026-03-22: formalized from `/plans/20260322_apply-patch-tool-tool-call/` into `specs/apply-patch-observability/` after implementation and merge.

## Effective Requirement Description

1. Make `apply_patch` expandable before completion.
2. Surface real execution phases and progress evidence during running state.
3. Preserve completed diff/diagnostics review behavior.

## Scope

### IN

- Running-state renderer behavior for `ApplyPatch`.
- Backend phased metadata contract and checkpoint emission.
- Feature-local validation and documentation.

### OUT

- Generic tool renderer redesign.
- Unrelated runtime scheduling or performance work.

## Non-Goals

- Guessing progress.
- Adding fallback mechanisms.
- Solving unrelated repo-wide typecheck noise.

## Constraints

- Fail-fast behavior must be preserved.
- Progress must stay evidence-backed.
- Completed diff/diagnostics UX must remain intact.

## What Changes

- `apply_patch` now emits explicit phases and progress metadata while running.
- TUI `ApplyPatch` now renders a running-state `BlockTool` before final file metadata exists.
- Completed-state diff and diagnostics rendering remains intact.

## Capabilities

### New Capabilities

- Running-state `apply_patch` expandability.
- Operator-visible phase/progress feedback for long patch executions.
- Explicit failed/awaiting-approval rendering using real metadata.

### Modified Capabilities

- The `ApplyPatch` card no longer depends on final `metadata.files` to become expandable.
- `apply_patch` metadata now spans the full execution lifecycle instead of final completion only.

## Impact

- Improves TUI observability for tool execution.
- Extends backend tool metadata usage within the existing session/runtime boundary.
