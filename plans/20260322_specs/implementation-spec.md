# Implementation Spec

## Goal

- Reorganize legacy `/specs` dated roots so unfinished work lives under `/plans` and implemented, semantically related work is normalized into conservative semantic spec roots.

## Scope

### IN

- Commit-first triage for legacy dated roots under `/specs`
- Moves from `/specs` to `/plans` for clearly unimplemented/shelved packages
- Consolidation from dated `/specs/<date_slug>/` roots into semantic `/specs/<feature>/` roots where implementation evidence is clear
- Event and architecture sync for the resulting repository structure

### OUT

- Re-implementing unfinished features
- Rewriting every historical artifact for prose consistency
- Force-classifying ambiguous legacy roots without evidence

## Assumptions

- Commit history, event closeout, and code blame are sufficient to classify the prioritized legacy roots.
- Conservative semantic roots are acceptable even if some historical dated-package names were more verbose.
- Telemetry optimization provenance should be folded directly into the existing telemetry semantic root.

## Stop Gates

- Stop if any legacy root has conflicting evidence about whether implementation actually landed.
- Stop if consolidation would destroy meaningful semantic distinctions instead of organizing provenance.
- Stop if architecture sync uncovers a repo contract inconsistent with the intended final tree.

## Critical Files

- /home/pkcs12/projects/opencode/specs/20260319_account-manager-phase2-hardening/
- /home/pkcs12/projects/opencode/specs/20260320_llm/
- /home/pkcs12/projects/opencode/specs/20260321_branch-repo-mcp-cicd/
- /home/pkcs12/projects/opencode/specs/20260321_beta-tool-branch-beta-branch-beta-repo-specs-20260321-continuous-orchestration-p/
- /home/pkcs12/projects/opencode/specs/20260321_subagent-io-visibility/
- /home/pkcs12/projects/opencode/specs/20260318_unified-message-bus/
- /home/pkcs12/projects/opencode/specs/20260316_kill-switch/
- /home/pkcs12/projects/opencode/specs/architecture.md
- /home/pkcs12/projects/opencode/docs/events/event_20260322_specs_reorganization.md

## Structured Execution Phases

- Phase 1: Move second-pass clearly unimplemented legacy dated roots from `/specs` into `/plans`
- Phase 2: Normalize second-pass implemented dated roots into conservative semantic `/specs/<feature>/` roots while preserving provenance
- Phase 3: Verify final tree shape, update event closeout, and sync `specs/architecture.md`

## Validation

- Inspect the resulting `/specs` and `/plans` directory layout and confirm the targeted dated roots no longer live in the wrong place.
- Confirm semantic destination roots exist and retain meaningful provenance/reference content.
- Update the event log with the exact migration decisions and record `Architecture Sync: Updated` or `Verified (No doc changes)`.

## Handoff

- Build agent must read this spec first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md / handoff.md before coding.
- Build agent must materialize runtime todo from tasks.md and preserve planner task naming.
- Build agent must prefer delegation-first execution when the task slice can be safely handed off.
