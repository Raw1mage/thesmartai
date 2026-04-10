# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Materialize tasks.md into runtime todos before coding

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md

## Current State

- Phase 1-4 implementation is complete (all code written)
- Phase 5 validation is pending (functional testing after server restart)
- AGENTS.md updated with "plan before implement" rule (第零條)

## Stop Gates In Force

- ctl.sock protocol change would require backend route update
- Multi-user UID filtering must be verified before shipping to production
- Gateway unreachable must be handled gracefully (502, empty state)

## Build Entry Recommendation

- Start from Phase 5 (validation) — all code is written, needs functional testing
- If any validation fails, fix the specific component and re-test

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
