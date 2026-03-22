# Tasks

## 1. Define apply_patch metadata contract
- [x] 1.1 Confirm the shared tool runtime can publish running-state metadata updates
- [x] 1.2 Define the phased `ApplyPatchMetadata` shape and backward-compatibility rules

## 2. Rewrite running-state TUI rendering
- [x] 2.1 Replace the `files.length > 0` render gate in `ApplyPatch`
- [x] 2.2 Render running-state block content for phase, progress, and placeholder states

## 3. Emit backend execution checkpoints
- [x] 3.1 Emit metadata for `parsing`, `planning`, and `awaiting_approval`
- [x] 3.2 Emit metadata for per-file `applying`, `diagnostics`, `completed`, and `failed`

## 4. Validate UX and regressions
- [x] 4.1 Validate multi-file running expandability and phase visibility (code-path verified; full UI runtime blocked by unrelated repo tooling noise)
- [x] 4.2 Validate completed diff/diagnostics compatibility and failed-state behavior (feature-local tests passed; root typecheck remains blocked by unrelated infra typing errors)

## 5. Sync documentation
- [x] 5.1 Update the event log with evidence, decisions, and validation
- [x] 5.2 Record architecture sync conclusion
