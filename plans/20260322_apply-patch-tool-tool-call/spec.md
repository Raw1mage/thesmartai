# Spec

## Purpose

- Ensure `apply_patch` is observable before completion so operators can inspect running-state progress directly in the TUI.

## Requirements

### Requirement: Running-State Expandability
The system SHALL render `apply_patch` as an expandable block card while the tool is still running.

#### Scenario: Running card expands before completion
- **GIVEN** an `apply_patch` tool part is in a running state
- **WHEN** the session route renders the tool card
- **THEN** the operator can expand the card before final `metadata.files` exists

### Requirement: Execution-Phase Metadata
The system SHALL expose explicit execution phases through tool metadata.

#### Scenario: Backend reports stable checkpoints
- **GIVEN** the backend is processing a patch
- **WHEN** it reaches parse, plan, approval, apply, diagnostics, completion, or failure checkpoints
- **THEN** the tool metadata includes the current phase and any known progress evidence

### Requirement: Completed-State Compatibility
The system SHALL preserve per-file diff and diagnostics rendering after completion.

#### Scenario: Completed patch review still works
- **GIVEN** an `apply_patch` execution completes successfully
- **WHEN** the operator expands the completed card
- **THEN** the UI shows per-file diff previews and diagnostics from the final metadata payload

## Acceptance Checks

- `bun test "packages/opencode/test/tool/apply_patch.test.ts"` passes.
- Running-state renderer code paths handle `parsing`, `awaiting_approval`, `applying`, `diagnostics`, `failed`, and `completed`.
- The completed diff/diagnostics path remains present in `ApplyPatch`.
