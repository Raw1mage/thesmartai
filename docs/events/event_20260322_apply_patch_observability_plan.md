# Event: Apply Patch Observability Planning

## Requirement

- User asked for an explanation of how `apply_patch` works because executions feel long and opaque.
- User identified the real issue as item 3: the expand control is ineffective before completion, so no running-state visibility exists.
- User then requested root-cause explanation plus the full remediation plan, and explicitly entered plan mode.

## Scope

### IN

- Trace the current `apply_patch` backend and TUI rendering pipeline.
- Define a build-ready plan to make `apply_patch` expandable and observable during running state.
- Produce aligned planner artifacts and modeling diagrams under `/plans/20260322_apply-patch-tool-tool-call/`.

### OUT

- Generic redesign of all tool cards.
- Performance-only optimization without observability changes.
- Generic redesign of all tool cards.
- Performance-only optimization without observability changes.

## Task List

- [x] Read architecture and current planning/event context.
- [x] Trace `apply_patch` backend execution and TUI render gating.
- [x] Confirm the root cause behind non-responsive pre-completion expand behavior.
- [x] Rewrite plan artifacts into an implementation-ready package.
- [x] Replace placeholder diagrams with task-specific models.

## Conversation Summary

- The user reported four symptoms, then narrowed the focus: duration is not the core problem; missing pre-completion expandability is.
- Initial analysis showed the running tool card stays on an inline fallback until `metadata.files` exists.
- The user selected two deliverables: root-cause explanation and a full remediation plan.
- After receiving the explanation, the user requested concrete implementation tasks and then entered plan mode.

## Debug Checkpoints

### Baseline

- Symptom: `apply_patch` appears static while running; the operator cannot open meaningful details until completion.
- Impact: subagent/orchestrator progress appears stalled because the UI exposes almost no execution evidence.

### Instrumentation Plan

- Read the TUI `ApplyPatch` renderer and the shared `ToolPart` metadata adapter.
- Read the backend `apply_patch` tool implementation to identify when metadata is created and returned.
- Compare the current behavior against an observable running-state model.

### Execution

- Confirmed `ToolPart` passes `props.part.state.metadata` for non-pending parts via `index.tsx:1430-1438`.
- Confirmed `ApplyPatch` in `index.tsx:2139-2235` renders `BlockTool` only when `props.metadata.files` is non-empty; otherwise it renders `InlineTool` with `Preparing apply_patch...`.
- Confirmed `packages/opencode/src/tool/apply_patch.ts:24-279` computes `fileChanges`, permission metadata, writes files, publishes file/bus events, runs `LSP.touchFile()` / `LSP.diagnostics()`, and only then returns final `metadata: { diff, files, diagnostics }`.
- Confirmed current plan package and modeling artifacts were still placeholders, then rewrote them into implementation-ready content for this feature.

### Root Cause

- The root cause is not simply runtime duration.
- The TUI expandability gate depends on `metadata.files.length > 0`, but the backend only provides `files` at the end of execution.
- Therefore, the running tool stays on a non-expandable inline placeholder throughout the long middle section, especially while writing files and awaiting diagnostics.

### Validation

- Planning validation confirmed the plan package now contains non-placeholder proposal/spec/design/tasks/handoff artifacts aligned to the observability problem.
- Diagram validation confirmed IDEF0/GRAFCET/C4/Sequence models now trace the apply_patch observability workflow rather than generic placeholders.
- Architecture Sync: Verified (No doc changes). This feature changes tool metadata and renderer behavior inside existing session-runtime boundaries without introducing a new long-lived module boundary.

## Execution Evidence

- Implemented `ApplyPatchPhase`, `ApplyPatchFileMetadata`, and `ApplyPatchMetadata` in `packages/opencode/src/tool/apply_patch.ts`, then bound `ctx.metadata()` emissions to that typed contract.
- Verified backend phased emissions still cover `parsing`, `planning`, `awaiting_approval`, `applying`, `diagnostics`, `failed`, and final `completed` metadata while preserving final `diff/files/diagnostics` payloads.
- Rewrote `ApplyPatch` in `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` to render a running `BlockTool` whenever phased metadata exists, removing the old dependency on `metadata.files.length > 0` before the running card appears.
- Preserved completed-state per-file diff rendering and diagnostics attachment behavior; only the running/failed gating logic changed.

## Validation Evidence

- `bun test "packages/opencode/test/tool/apply_patch.test.ts"` ✅ (`27 pass / 0 fail`), including the new phased metadata observability coverage.
- `bunx tsc --noEmit --pretty false -p packages/opencode/tsconfig.json` ❌ blocked by pre-existing unrelated errors in `packages/opencode/src/bus/subscribers/task-worker-continuation.ts` and `packages/opencode/src/session/prompt.ts`; no reported failures came from the touched `apply_patch` files.
- Manual live TUI verification is still recommended for the exact pre-completion expand/collapse UX, but the mainline code now contains the phased metadata path and running-state `BlockTool` renderer.

## Divergence Resolution

- This main-worktree implementation is now the real apply_patch observability fix.
- The prior rollback note is superseded: the feature no longer exists only as a plan package; the authoritative runtime and TUI changes are now landed in the main worktree.

## Remaining

- None for this scoped implementation task.
