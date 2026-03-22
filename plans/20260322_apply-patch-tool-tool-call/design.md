# Design

## Context

- Previously, `ApplyPatch` only rendered `BlockTool` when `metadata.files` existed, which occurred only after backend completion.
- The backend already had meaningful execution checkpoints, but the UI could not consume them because the metadata arrived only at the end.
- The existing tool runtime already supported incremental metadata via `Tool.Context.metadata()`.

## Goals / Non-Goals

**Goals:**

- Make `ApplyPatch` expandable during running state.
- Surface real backend execution phases and progress evidence.
- Preserve final diff/diagnostics rendering.

**Non-Goals:**

- Redesigning all tool cards.
- Introducing speculative progress or fallbacks.

## Decisions

- `ApplyPatch` uses a running-state `BlockTool` path rather than a completed-only gate.
- Backend metadata uses explicit phases: `parsing`, `planning`, `awaiting_approval`, `applying`, `diagnostics`, `completed`, `failed`.
- Progress stays evidence-backed via known file counts/current file only.
- Final `files`, `diagnostics`, and `diff` remain in the completed payload for compatibility.

## Data / State / Control Flow

- `apply_patch` parses the patch and derives file changes.
- The backend emits phased metadata through `Tool.Context.metadata()`.
- Session tool-part state propagates metadata into the TUI.
- `ApplyPatch` renders running-state progress from phase/progress metadata and completed-state diff review from final `files`.

## Risks / Trade-offs

- Repeated metadata updates increase payload churn, but keep observability local and evidence-backed.
- Root typecheck still includes unrelated infra noise, so feature-local validation must stay explicit in docs.

## Critical Files

- `packages/opencode/src/tool/apply_patch.ts`
- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`
- `docs/events/event_20260322_apply_patch_observability_plan.md`
