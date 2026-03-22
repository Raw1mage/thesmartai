# Handoff

## Execution Contract

- `specs/autorunner/` is the canonical autorunner root.
- Readers should use the main six files first.
- For mission-consumption and delegated-execution detail, use the supporting docs in this same root.

## Required Reads

- `proposal.md`
- `spec.md`
- `design.md`
- `implementation-spec.md`
- `tasks.md`

## Supporting Reads

- `mission-consumption-baseline.*`
- `delegated-execution-baseline.*`

## Stop Gates In Force

- Do not treat dated predecessor roots as canonical once this root exists.
- Do not bypass mission-consumption failure with todo-only fallback.
- Do not widen delegated role derivation beyond the bounded role set without a new spec slice.

## Completion Note

- This canonical root merges the useful authority from the dated autorunner packages and preserves supporting slices in-place under one semantic destination.
