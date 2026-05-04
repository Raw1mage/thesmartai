# Agent Framework Specs

Canonical semantic root for agent runtime, planner/build workflow, orchestration, subagent visibility, prompt/context structure, and agent-facing telemetry.

## Current State Summary

This root now spans three layers:

1. **Canonical root contract**
   - `proposal.md`, `spec.md`, `design.md`, `implementation-spec.md`, `handoff.md`
   - Establish the semantic entry point for agent-runtime authority

2. **Promoted implementation slices**
   - `slices/builder_framework/` — planner/build/beta admission behavior
   - `slices/shared-context-structure/` — shared context and compaction structure
   - `slices/system-prompt/` — prompt assembly hooks
   - `slices/telemetry/` — agent-facing observability slices

3. **Historical source provenance**
   - `sources/` preserves older source roots and benchmark artifacts

## How to Read This Root

- Start at this root for current agent-runtime taxonomy.
- Use `slices/builder_framework/` for the current planner / build-admission / workflow-runner admission truth.
- Use `specs/architecture.md` when you need concrete module/file ownership rather than semantic architecture.
- Do not assume every preserved slice is fully normalized into the root yet; some slices still carry more current detail than the root summary files.
