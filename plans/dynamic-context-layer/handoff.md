# Handoff

## Execution Contract

- Build agent must read `implementation-spec.md` first.
- Build agent must read `proposal.md`, `spec.md`, `design.md`, and `tasks.md` before coding.
- Runtime todo must be materialized from `tasks.md` before execution continues.
- Build agent must not rely on discussion memory when this plan package is available.
- Same-workstream changes stay inside `plans/dynamic-context-layer/` unless the user explicitly approves a new plan root.

## Required Reads

- `plans/dynamic-context-layer/implementation-spec.md`
- `plans/dynamic-context-layer/proposal.md`
- `plans/dynamic-context-layer/spec.md`
- `plans/dynamic-context-layer/design.md`
- `plans/dynamic-context-layer/tasks.md`
- `specs/architecture.md`
- `docs/events/event_20260409_unload_idle_context_planning.md`

## Current State

- Planning mode only; no implementation slice has started.
- Existing repo evidence confirms system prompt is rebuilt per round in `packages/opencode/src/session/llm.ts`.
- Existing repo evidence confirms skill content currently enters transcript history via `packages/opencode/src/tool/skill.ts` and therefore stays in active context until compaction.
- Existing repo evidence confirms `packages/opencode/src/session/resolve-tools.ts` already manages on-demand MCP idle disconnect, providing a reference lifecycle pattern.
- The current plan root reuses an existing partial topic root (`plans/dynamic-context-layer/`) and upgrades it into a complete execution contract.
- User direction now clarifies that unload matters primarily for token-based providers; by-request providers must be treated as a separate policy branch.
- User direction also clarifies that AI should be allowed to silently stop re-injecting irrelevant skills when topic drift is clear, but only as a prompt-layer decision.
- Current agreed direction for `summary` state is a fixed-field structured residue, not a freeform prose summary; `keepRules` is relevance-driven, while `lastReason` stays short.
- Current recommended authority design is: model-manager provider billing mode setting as SSOT, resolved into runtime metadata for prompt/unload decisions.
- Current agreed product decisions: provider billing mode is edited per canonical provider, and pin is session-scoped in v1.
- Current agreed UI direction: manual skill lifecycle controls live in `Status Tab` as a `Skill Layers` card.
- The plan is now organized into four executable slices: Slice A (authority + plumbing), Slice B (managed skill injection), Slice C (Status Tab controls), Slice D (validation + hardening).
- Admitted beta authority for this run:
  - `mainRepo=/home/pkcs12/projects/opencode`
  - `mainWorktree=/home/pkcs12/projects/opencode`
  - `baseBranch=main`
  - `implementationRepo=/home/pkcs12/projects/opencode`
  - `implementationWorktree=/home/pkcs12/projects/opencode-worktrees/dynamic-context-layer`
  - `implementationBranch=beta/dynamic-context-layer`
  - `docsWriteRepo=/home/pkcs12/projects/opencode`

## Stop Gates In Force

- Stop if the proposed lifecycle tries to unload core system/safety prompt blocks.
- Stop if the design requires transcript mutation or deletion to simulate unload.
- Stop if runtime-owned layer state cannot be established and the design falls back to model memory.
- Stop and re-plan if rollout must become big-bang across all prompt blocks.
- Stop if provider pricing mode cannot be identified and the implementation still tries to enable aggressive unload.

## Build Entry Recommendation

- Start with `tasks.md` section 1 and confirm the exact cut between immutable core and managed layers.
- Execute Slice A first: model-manager billing mode SSOT + runtime resolution + registry/telemetry seam with no behavior change.
- Execute Slice B second: managed skill injection with AI desired-state and session-scoped pin.
- Execute Slice C third: `Status Tab` / `Skill Layers` operator controls.
- Execute Slice D last: provider-specific validation, prompt-cache/token benchmarking, and lazy-tool follow-up decision.
- Model `AI relevance decision -> runtime apply/veto -> telemetry evidence` as a first-class pipeline, not an implicit heuristic.
- Add the provider billing mode control to the model manager first or in the same slice that introduces unload gating, because that setting is the SSOT.
- Keep topic sensitivity inside AI relevance evaluation; do not overload v1 pin with topic-scoped semantics.
- Do not create a separate skill market in v1; keep UI scope on session operational control.
- Treat `summary` as a compact schema-backed payload, not a second long-form skill prompt.

## Execution-Ready Checklist

- [x] Implementation spec is complete
- [x] Companion artifacts are aligned
- [x] Validation plan is explicit
- [x] Runtime todo seed is present in `tasks.md`
- [x] Event log is present for this planning session

## Completion / Retrospective Contract

- Compare the delivered implementation against the proposal's effective requirement description.
- Report whether the build achieved `full -> summary residue -> absent` lifecycle control for skills.
- Report prompt token and cache-impact evidence, not only code changes.
- Do not declare completion without documenting unload observability and architecture-sync status.
