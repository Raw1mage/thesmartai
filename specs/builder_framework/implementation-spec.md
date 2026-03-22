# Implementation Spec: builder_framework

## Goal

- Canonicalize builder-related taxonomy into one semantic root without losing the detailed source artifacts from beta-tool, build_beta, and planner-lifecycle.

## Scope

### IN

- Create the canonical `specs/builder_framework/` root.
- Preserve merged source material under `specs/builder_framework/sources/`.
- Record explicit provenance and entry-point guidance.
- Add cross-source synthesis for the builder beta-enforcement gap discovered after builder-native beta integration landed.

### OUT

- Rewriting source documents into a newly invented framework contract beyond what the merged roots already establish.
- Discarding preserved diagrams or supporting artifacts from the merged sources.

## Required Synthesis

- Preserve the distinction between:
  - **builder beta capability** already proven by `sources/build_beta/`
  - **builder beta enforcement** still required so implementation work defaults to beta worktree after `plan_exit`
- Make explicit that `plan_enter` enforcement comes from a single tool boundary, while builder requires a runtime enforcement gate because execution spans mission handoff, continuations, and delegation.
- Define the follow-up contract needed for beta-enabled builder execution:
  - beta execution gate
  - implementation-surface resolver
  - delegation-time workdir routing
  - main-repo fail-fast for beta-enabled coding
  - end-to-end enforcement validation

## Validation

- `specs/builder_framework/` exists with canonical entry files.
- Merged source roots are preserved under `specs/builder_framework/sources/`.
- The old top-level roots `specs/beta-tool/`, `specs/build_beta/`, and `specs/planner-lifecycle/` no longer exist as parallel authorities.
- Canonical builder framework docs explicitly distinguish capability integration from execution-surface enforcement and describe the missing enforcement layer.
