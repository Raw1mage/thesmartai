# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first
- Build agent must read proposal.md / spec.md / design.md / tasks.md before coding
- Build agent must read wire protocol reference at `plans/codex-auth-plugin/diagrams/codex_a4_protocol_ref.json`
- Materialize tasks.md into runtime todos before coding
- Each phase is independently deliverable — commit and validate before proceeding to next

## Required Reads

- implementation-spec.md — phases, scope, validation criteria
- proposal.md — why, constraints
- spec.md — behavioral requirements with GIVEN/WHEN/THEN
- design.md — architecture decisions (DD-1 through DD-6), risks
- tasks.md — execution checklist (26 tasks across 4 phases)
- `plans/codex-auth-plugin/diagrams/codex_a4_protocol_ref.json` — wire protocol reference

## Current State

- Codex provider is working end-to-end (auth, models, request/response)
- AI SDK custom fetch path is the primary transport (C binary available as alternate)
- No server-side efficiency features are enabled
- Token consumption is baseline (no cache, no delta, no compression)

## Stop Gates In Force

- **SG-1**: prompt_cache_key ineffective → analyze packet capture
- **SG-2**: WebSocket rejected → stay on HTTP SSE
- **SG-3**: encrypted reasoning body overflow → implement truncation

## Build Entry Recommendation

**Start with Phase 1, Task 1.1**: Inject `prompt_cache_key` into codex custom fetch.

This is a single-line addition to the body transform in `codex.ts` custom fetch. Immediate, measurable impact on token consumption.

**Phase 1 parallel work**:
- Tasks 1.1-1.2 are independent (cache key vs turn state capture)
- Tasks 1.3-1.5 depend on 1.2 (turn state storage needs capture first)
- Tasks 1.6-1.7 are validation (run after 1.1-1.5)

**Phase 2 depends on Phase 1** being validated (need cache infrastructure working first).

**Phase 3 is independent** of Phase 2 (can start in parallel if resources allow).

**Phase 4 depends on Phase 3** conceptually but can use HTTP transport.

## Execution-Ready Checklist

- [x] Implementation spec is complete with 4 phases
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit per phase
- [x] Runtime todo seed is present in tasks.md (26 tasks)
- [x] Wire protocol reference available
- [x] Stop gates defined with mitigation
- [x] Build entry point and parallelization documented
