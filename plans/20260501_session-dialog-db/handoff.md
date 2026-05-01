# Handoff

## Execution Contract

- Read architecture and prior event docs first.
- Do not introduce silent fallback from DB to legacy files.
- Keep `read_subsession` chunking hints compatible with current callers.
- Stop only if DB API import boundary requires a product decision.

## Validation Plan

- Targeted test for system-manager or affected session storage path.
- Typecheck/build for changed packages if targeted tests are unavailable.
