# Design

## Context

- `packages/opencode/src/tool/plan.ts` already acts as the hardcoded build-entry gate by validating artifacts, materializing todos, persisting mission metadata, and injecting a synthetic build-mode handoff.
- `packages/opencode/src/session/index.ts` and `packages/opencode/src/session/workflow-runner.ts` already form the runtime control plane for build-mode continuation, pause conditions, and mission consumption.
- `packages/opencode/src/session/prompt/runner.txt` provides the generic build-mode execution contract, but it does not currently encode beta lifecycle guidance.
- `packages/mcp/branch-cicd` already implements the concrete beta workflow logic, but currently exposes it only as an MCP-facing package rather than a builder-facing runtime primitive layer.
- User requirement is explicitly conservative: optimize the existing builder flow, do not break current capabilities, and reduce AI dependence for routine git/worktree/runtime operations.

## Goals / Non-Goals

**Goals:**

- Preserve the existing builder control plane and optimize it rather than replacing it.
- Reuse one shared beta orchestration implementation across MCP and internal builder runtime.
- Make beta bootstrap, syncback validation, and merge preflight first-class builder lifecycle stages.
- Reduce routine AI token spend by moving deterministic orchestration into shared tools/primitives.
- Preserve explicit question/approval gates and fail-fast behavior.

**Non-Goals:**

- Replace builder with a new standalone control system.
- Auto-run merge or cleanup when build succeeds without explicit approval.
- Hide project/runtime ambiguity behind fallback defaults.

## Decisions

- Keep `plan_exit`, mission, workflow-runner, and runner contract as the backbone of builder execution; extend them narrowly for beta awareness instead of replacing them.
- Extract or expose the project-aware branch/worktree/runtime logic from `packages/mcp/branch-cicd` as shared deterministic beta primitives used by both MCP handlers and builder runtime.
- Extend planner artifacts and handoff metadata so beta-loop execution is explicit, not inferred from the mere existence of beta-tool.
- Build-mode validation should use syncback-equivalent operations plus runtime policy execution; manual runtime policy remains a stop/report path instead of an implicit command fallback.
- Successful build progression should enter builder-owned merge preflight, but destructive finalize actions still require an explicit approval stop gate.
- Protect existing builder behavior by treating non-beta plans as a compatibility path that should continue to work without beta-specific churn.

## Data / State / Control Flow

- Planner artifacts define whether beta-loop execution is in scope and what validation/finalize posture is required.
- `plan_exit` validates artifacts, materializes tasks, resolves beta execution metadata, and runs shared beta bootstrap before persisting mission handoff when beta flow is enabled.
- Mission/handoff metadata carries beta context (repo root, main worktree, beta path, branch name, base branch, runtime policy, validation posture, finalize posture) into build mode.
- Workflow runner remains the continuation controller; when it reaches a beta-aware validation slice, builder uses shared syncback-equivalent orchestration to update the main worktree and optionally run runtime commands.
- Successful validation returns control to normal build progression; builder then enters merge preflight using shared merge-equivalent logic and pauses for explicit approval before finalize operations.
- Non-beta plans bypass beta-specific stages and continue through the legacy-compatible builder path.

## Risks / Trade-offs

- Shared-core extraction touches both builder runtime and MCP package boundaries -> mitigate by keeping primitive signatures close to current MCP behavior and adding focused tests.
- Adding beta awareness to builder can accidentally regress legacy build flow -> mitigate with explicit compatibility checks and by making beta metadata opt-in.
- Deterministic tooling reduces token use but adds runtime coupling -> mitigate by keeping the shared primitive layer narrow and observable.
- Finalize-loop automation can blur operator expectations -> mitigate by documenting clear stop gates and explicit merge approval.

## Critical Files

- /home/pkcs12/projects/opencode/packages/opencode/src/tool/plan.ts
- /home/pkcs12/projects/opencode/packages/opencode/src/session/index.ts
- /home/pkcs12/projects/opencode/packages/opencode/src/session/workflow-runner.ts
- /home/pkcs12/projects/opencode/packages/opencode/src/session/prompt/runner.txt
- /home/pkcs12/projects/opencode/packages/mcp/branch-cicd/src/beta-tool.ts
- /home/pkcs12/projects/opencode/packages/mcp/branch-cicd/src/context.ts
- /home/pkcs12/projects/opencode/packages/mcp/branch-cicd/src/project-policy.ts
