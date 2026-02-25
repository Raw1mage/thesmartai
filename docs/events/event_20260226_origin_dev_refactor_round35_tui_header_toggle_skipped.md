# Event: origin/dev refactor round35 (tui header toggle)

Date: 2026-02-26
Status: In Progress

## 1) Goal

Evaluate upstream TUI session-header visibility toggle feature for cms UX fit.

## 2) Candidate

- Upstream commit: `135f8ffb2a0b6759a5bf8e03b2869d4258d5013b`
- Subject: `feat(tui): add toggle to hide session header`

## 3) Decision + rationale

- Decision: **Skipped**
- Rationale:
  - Feature is optional UI preference, not a bugfix.
  - cms TUI has diverged session layout/monitor behavior recently; introducing an additional header visibility state risks UI interaction regressions with low immediate value.
  - Keep current UX stable while prioritizing behavioral and reliability deltas.

## 4) File scope reviewed

- `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`

## 5) Validation plan / result

- Validation method: upstream diff review against current session route layout state.
- Result: skipped for UX risk/value tradeoff.

## Architecture gate

- Checked `docs/ARCHITECTURE.md` before decision.
- No architecture change applied.
