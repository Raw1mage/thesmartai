# Event: Specs Folder Reorganization

## Requirement

- User requested a cleanup of `/specs`.
- Move legacy dated packages that are still unimplemented or active-plan in nature into `/plans`.
- Merge implemented legacy dated spec packages with similar subject matter into semantic spec roots under `/specs/<feature>/`.
- User explicitly required implementation-status evidence to come from commits first, not from `tasks.md` alone.

## Scope

### IN

- Triage legacy `specs/<date_slug>/` packages using commit history, event verification, and code blame.
- Move commit-unimplemented packages from `/specs` to `/plans`.
- Consolidate commit-implemented dated packages into conservative semantic roots.
- Update plan/event/architecture docs to reflect the resulting repository information architecture.

### OUT

- Rewriting the substantive technical content of every legacy spec package.
- Re-opening unfinished implementation work just to close old tasks.
- Auto-promoting any `/plans/` package back into `/specs` without semantic evidence.

## Task List

- [x] Re-triage legacy spec roots using commit-level evidence instead of trusting `tasks.md`.
- [x] Ask the user to choose telemetry consolidation posture and semantic naming posture.
- [x] Execute folder moves/merges into `/plans` and semantic `/specs` roots.
- [x] Verify post-migration layout and sync architecture documentation.

## Conversation Summary

- Initial triage over-weighted `tasks.md`; user corrected the standard and required commit-based evidence.
- Re-triage then used `git log --follow`, `git show --stat`, code-path `git blame`, existing event verification, and only secondarily artifact/task content.
- User chose to directly merge telemetry optimization material into the semantic telemetry spec root rather than holding it in `/plans` pending closeout.
- User also chose conservative semantic root names (for example `account-management`, `planner-lifecycle`, `beta-tool`) rather than long historical dated-root names.

## Debug Checkpoints

### Baseline

- `specs/architecture.md` already documents the lifecycle rule: active dated plan/build workspaces belong under `/plans`, while `/specs` is reserved for long-lived semantic roots plus `specs/architecture.md`.
- The repository still contains multiple legacy dated roots under `/specs`, some representing real implemented features and some representing shelved or still-active plans.

### Instrumentation Plan

- Use commit history first to determine whether each legacy package has corresponding implementation evidence.
- Cross-check with event verification/closeout records.
- Use code blame on critical file paths when the commit touches runtime code.
- Treat `tasks.md` as supporting evidence only.

### Execution

- Inline-agent-switch: commit history shows only a shelved spec commit; runtime still uses child-session task flow and `SubagentActivityCard` surfaces.
- Remote-terminal: only pending-spec commit found; no `RemoteToolBackend`, `ToolBackend`, `remoteTarget`, or `opencode remote setup` implementation exists.
- Account-management-refactor: commit `67d337e6eb` implemented the corresponding runtime/account/auth/UI paths; architecture and follow-up event evidence confirm the 3-tier model.
- Telemetry-implementation: commit `6bae3c2b49` implemented bus/projector/reducer telemetry surfaces; dated root is superseded by `specs/telemetry/`.
- Telemetry-optimization: commit `0d5ef22081` implemented context-sidebar card unification/order persistence; user chose to fold this into the telemetry semantic root.
- Plans/specs lifecycle: commit `0e25872e9e` changed planner runtime, prompts, and tests to use `/plans`; this should become a semantic planner-lifecycle spec root.

### Root Cause

- Historic dated planner packages remained under `/specs` even after the lifecycle model changed.
- Repository organization drift happened because implemented dated roots were not normalized into semantic spec roots, and shelved plans were not demoted back into `/plans`.
- `tasks.md` can lag or remain partially open after implementation, so it is not a safe single source for migration decisions.

### Validation

- Commit evidence used:
  - `6eb5ef9cae` for shelved inline-agent-switch specs.
  - `286a9b973d` for pending remote-terminal specs.
  - `67d337e6eb` plus follow-up blame in account/auth/UI paths for account-management implementation.
  - `6bae3c2b49` for telemetry rewrite implementation.
  - `0d5ef22081` for telemetry context-sidebar optimization implementation.
  - `0e25872e9e` for planner lifecycle implementation.
- Event evidence used:
  - `docs/events/event_20260321_telemetry_implementation.md`
  - `docs/events/event_20260322_plans_specs_lifecycle.md`
  - `docs/events/event_20260318_gemini-cli_account_overwrite_fix.md`
- Architecture Sync: Verified (No doc changes) — `specs/architecture.md` already reflected the lifecycle split and semantic-spec rule after the reorganization.

## Key Decisions

- Evidence standard: commit/event/code-blame first; `tasks.md` is advisory only.
- Telemetry consolidation: directly merge dated telemetry optimization provenance into the semantic telemetry root.
- Semantic root naming: use conservative names.
- Planned semantic roots:
  - `specs/account-management/`
  - `specs/planner-lifecycle/`
  - `specs/beta-tool/`
  - existing `specs/telemetry/`
- Planned moves to `/plans`:
  - `plans/20260321_inline-agent-switch/`
  - `plans/20260320_remote-terminal/`
- Executed semantic normalizations:
  - `specs/20260318_account-management-refactor/` -> `specs/account-management/`
  - `specs/20260321_specs/` -> `specs/planner-lifecycle/`
  - `specs/20260320_telemetry-implementation/` -> `specs/telemetry/provenance/20260320_telemetry-implementation/`
  - `specs/20260321_telemetry-optimization/` -> `specs/telemetry/provenance/20260321_telemetry-optimization/`
- Executed second-pass plan demotions:
  - `specs/20260319_account-manager-phase2-hardening/` -> `plans/20260319_account-manager-phase2-hardening/`
  - `specs/20260320_llm/` -> `plans/20260320_llm/`
- Executed second-pass semantic normalizations:
  - `specs/20260321_branch-repo-mcp-cicd/` -> `specs/beta-tool/branch-cicd/`
  - `specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/` -> `specs/continuous-orchestration/`
  - `specs/20260321_subagent-io-visibility/` -> `specs/subagents/visibility/`
  - `specs/20260318_unified-message-bus/` -> `specs/message-bus/`
  - `specs/20260316_kill-switch/` -> `specs/kill-switch/`

## Second-pass Validation

- Verified destination roots now exist under `/plans` and semantic `/specs` paths for all seven approved second-pass migrations.
- Verified the original dated roots no longer exist under `/specs` for those seven mappings.
- Architecture Sync: Verified (No doc changes) — `specs/architecture.md` already describes the `/plans` vs semantic `/specs` lifecycle and already contains the normalized architecture sections for beta-tool MCP, subagent visibility, and message-bus/kill-switch domains.

## Remaining

- Remaining lower-confidence dated roots still need a later commit/event pass.
