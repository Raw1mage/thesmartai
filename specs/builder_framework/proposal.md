# Proposal: builder_framework

## Why

- Builder-related spec authority was split across three roots covering beta worktree orchestration, builder-native beta integration, and planner/build lifecycle semantics.
- A single canonical semantic root is needed so builder workflow readers can start from one place without guessing which root is authoritative.

## Merged Sources

- `/home/pkcs12/projects/opencode/specs/builder_framework/sources/beta-tool/`
- `/home/pkcs12/projects/opencode/specs/builder_framework/sources/build_beta/`
- `/home/pkcs12/projects/opencode/specs/builder_framework/sources/planner-lifecycle/`

## Effective Requirement Description

1. Preserve the builder control plane as the canonical execution surface.
2. Keep beta/worktree workflow and builder-native orchestration under one framework.
3. Preserve `/plans` as the active planner root and keep promotion to `/specs` explicit.
4. Retain source-specific detail under `sources/` instead of flattening away useful context.

## Preservation Note

- Canonical summary files live at `specs/builder_framework/`.
- Source materials remain preserved under `specs/builder_framework/sources/` for detailed slice-specific context.
