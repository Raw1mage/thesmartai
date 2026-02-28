# Event: Web/TUI SSOT unification planning kickoff

Date: 2026-02-27
Status: In Progress

## Decision

- Start a dedicated unification stream to resolve dual-track behavior between Web and TUI.
- Treat TUI behavior and server-backed model preference state as canonical references.

## Scope

- Model selector parity
- Slash command parity
- `/session` list parity

## Artifact

- Created planning spec:
  - `docs/specs/tui-web-ssot-unification-plan.md`

## Next

1. Produce parity matrix doc (`tui-web-parity-matrix.md`).
2. Lock canonical state contracts and key normalization.
3. Execute phase-by-phase refactor with parity tests.
