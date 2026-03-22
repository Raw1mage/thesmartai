# Handoff

## Execution Contract

- Build agent must read implementation-spec.md first.
- Build agent must read proposal.md / spec.md / design.md / tasks.md / the event file before modifying directories.
- Build agent must preserve commit-first triage logic and not regress to tasks-only classification.
- Build agent must keep semantic root naming conservative and direct.

## Required Reads

- implementation-spec.md
- proposal.md
- spec.md
- design.md
- tasks.md
- /home/pkcs12/projects/opencode/docs/events/event_20260322_specs_reorganization.md

## Current State

- Commit-based triage is complete for the highest-risk legacy roots.
- User decisions are resolved for telemetry consolidation and semantic naming posture.
- Filesystem reorganization and final validation remain.

## Stop Gates In Force

- Stop if a candidate dated root has ambiguous implementation evidence.
- Stop if a merge would overwrite distinct semantic content rather than normalize provenance.
- Stop if architecture sync reveals a conflicting repo-level contract.

## Build Entry Recommendation

- First move clearly unimplemented roots (`20260321_inline-agent-switch`, `20260320_remote-terminal`) into `/plans`.
- Then normalize the strongest implemented roots into semantic `/specs` destinations (`account-management`, `planner-lifecycle`, telemetry provenance).
- Re-verify the tree and update architecture sync last.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in tasks.md
