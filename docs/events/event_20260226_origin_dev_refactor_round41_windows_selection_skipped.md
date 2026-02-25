# Event: origin/dev refactor round41 (windows selection/manual ctrl+c)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream Windows-specific TUI selection/manual ctrl+c UX changes.

## 2) Candidate

- Upstream commit: `a8f2884521e755cea9b9e4e52406267bcbda15d2`
- Subject: `feat: windows selection behavior, manual ctrl+c`

## 3) Decision + rationale

- Decision: **Skipped**
- Rationale:
  - Introduces multi-file TUI interaction changes (new selection helper + app/dialog wiring + platform-default flag behavior).
  - High regression surface overlaps with ongoing cms TUI input/monitor customizations.
  - Defer to dedicated Windows UX hardening pass instead of incremental insertion in current flow.

## 4) File scope reviewed

- `packages/opencode/src/cli/cmd/tui/app.tsx`
- `packages/opencode/src/cli/cmd/tui/ui/dialog.tsx`
- `packages/opencode/src/cli/cmd/tui/util/selection.ts` (new upstream)
- `packages/opencode/src/flag/flag.ts`

## 5) Validation plan / result

- Validation method: upstream diff inspection against current cms TUI flow.
- Result: skipped due scope/risk for current rewrite-only stream.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
