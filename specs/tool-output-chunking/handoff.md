# Handoff — context-management

> Execution contract for any agent (human or AI) picking up `tasks.md`.
> Read top-to-bottom before starting any phase.

---

## Execution Contract

1. **One phase at a time.** TodoWrite materialises only the current `## N.`
   phase's `- [ ]` items. Do not load multiple phases.
2. **One slice at a time.** Exactly one `- [~]` (`in_progress`) at any
   moment per plan-builder §16.2.
3. **Per-task ritual** (plan-builder §16.3): mark `- [x]` immediately on
   completion → run `bun run ~/projects/skills/plan-builder/scripts/plan-sync.ts
   specs/tool-output-chunking/` → handle drift output → update TodoWrite to
   `completed`.
4. **Phase rollover is automatic** (plan-builder §16.5): write phase summary
   per §16.4 → TodoWrite REPLACE with next phase items → start first item.
   No user prompt between phases unless the user has explicitly opted into
   stricter review.
5. **Stop only at legitimate gates** (plan-builder §16.5): destructive ops
   needing approval, product decision required, external blocker, sync
   warned `extend`/`refactor`, all tasks consumed, user interrupt.

## Required Reads

Read these in order. Skipping any will likely cause rework.

1. `proposal.md` — why this exists, paradigm shift, original requirement
   wording. **Critical**: Refactor notice at top.
2. `spec.md` — R-1..R-13 + 15 acceptance checks. The contract you must
   satisfy.
3. `design.md` — DD-1..DD-15 decisions. Each task in `tasks.md` references
   one or more DD-N.
4. `invariants.md` — INV-1..INV-10 cross-cut guarantees. These MUST hold
   throughout implementation; not just at acceptance time.
5. `gaps.md` — G-1..G-9 RESOLVED records (linkage from gap → DD-N → INV).
   G-10..G-14 still open as Implementation Detail / Watch tier.
6. `data-schema.json` — canonical types. Implementation types in
   `memory.ts` must match exactly.
7. `c4.json` + `sequence.json` — component map and runtime flows. Use as
   reference when implementing cross-component interactions.
8. `hybrid-llm-framing.md` — the actual LLM prompt for Phase 2. Read
   before starting any 2.6+ task.
9. `errors.md` — error taxonomy. Implementations of DD-6 paths must emit
   the catalogued codes verbatim.
10. `observability.md` — telemetry contract. Phase 2 task 2.21 (cache
    hit-rate gate) and Phase 5 task 5.9 (pin density) reference it.

## Companion skills

- **`beta-workflow`**: invoke if implementation touches the main repo
  (`packages/opencode/src/...`). All code changes for this spec do, so
  beta-workflow IS engaged for Phases 1-5. Branch naming: `beta/<phase-N>-context-management`.
- **`miatdiagram`**: not invoked during build (idef0/grafcet artifacts
  already drafted at `designed`). Re-run only if `revise` mode adds new
  phases.
- **`plan-builder`**: every task completion triggers `plan-sync.ts`.

## Critical Files (will be edited; back up XDG before any test run per AGENTS.md)

See `design.md` → "Critical Files" section. Highlights:

- `packages/opencode/src/session/compaction.ts` — central rewrite (Phase 2)
- `packages/opencode/src/session/memory.ts` — first-class anchor/journal/pinned_zone (Phase 2)
- `packages/opencode/src/session/prompt.ts` — 5-zone build, pinned-zone materialisation, status injection (Phase 2 + 3 + 5)
- `packages/opencode/src/session/prompt/hybrid-llm-framing.md` — moved from specs/ in task 2.1 (Phase 2)
- `packages/opencode/src/tool/{read,glob,grep,bash,webfetch,apply_patch,task,system-manager_read_subsession}.ts` — Phase 1
- `packages/opencode/src/tool/compact-now.ts` (NEW) — Phase 4
- `packages/opencode/src/config/tweaks.ts` + `templates/etc/opencode/tweaks.cfg.example` — Phase 1 + 2

## Stop Gates In Force

1. **Cache hit-rate regression**: task 2.21 measures regression at 80–90%
   utilisation band. If regression > 5pp, STOP and surface to user. Do
   not merge Phase 2 over a regression.
2. **Cross-provider regression failure**: if TV-13 fails for any provider
   (anchor body shape rejected by validation), STOP. Framing prompt
   needs revision; may require `amend` mode on design.md DD-11.
3. **Phase 2 fires too often in fixtures**: if test runs show Phase 2
   firing > 1% of compaction events, STOP. Indicates pinning behaviour
   or framing target sizing needs revisit.
4. **AGENTS.md rule 1 violation**: if any task tempts a silent fallback
   (catch-and-ignore, default-on-miss, hidden retry), STOP and ask. The
   no-silent-fallback rule has bitten this codebase before.
5. **XDG backup absent**: per opencode AGENTS.md "XDG Config 備份規則",
   no `bun test` / daemon restart may run without an
   `~/.config/opencode.bak-<YYYYMMDD-HHMM>-tool-output-chunking/`
   directory containing the white-listed config files. Verify before
   Phase 1 task 1.14.
6. **Daemon spawn**: per opencode AGENTS.md "Daemon Lifecycle Authority",
   AI must NOT spawn / kill / restart the opencode daemon directly. Use
   `system-manager:restart_self` MCP tool. If a code change requires
   daemon restart for testing, call that tool — do not run `webctl.sh`
   or `kill` from Bash.
7. **Phase boundary commit**: each `## N. Phase` produces its own commit
   set. Do not bundle multi-phase work in one commit. Use feature branches
   per phase: `beta/phase-N-<slug>` (per beta-workflow conventions).

## Execution-Ready Checklist

- [ ] `~/.config/opencode.bak-*-tool-output-chunking/` exists with whitelisted
      config files (see opencode AGENTS.md `## XDG Config 備份規則`)
- [ ] `bun --version` works in the repo (required for plan-sync.ts)
- [ ] Branch created per beta-workflow convention OR confirmation that work
      lands directly on a beta worktree
- [ ] All "Required Reads" above complete
- [ ] `plan-validate.ts` returns PASS for `state=planned`

## Drift handling shortcuts

When `plan-sync.ts` warns drift after a task:

| Drift type | Action |
|---|---|
| Touched code that data-schema.json describes but the touch added a new field | `--mode amend` at phase boundary; update data-schema.json + design.md inline |
| Touched code that adds a new error code | `--mode amend`; update errors.md |
| Touched code that adds a new C4 component or breaks an existing one | STOP phase; `--mode refactor` consideration with user |
| Touched architecture.md entry for compaction subsystem | normal `amend`; expected within Phase 2 |

## Validation evidence to collect (for `verified` promotion)

After all 5 phases complete, attach to this handoff (or create
`verification.md`):

- bun test output for each phase's TV-N fixtures
- cache hit-rate measurement (pre vs post merge, 80–90% band)
- cross-provider regression matrix (TV-13)
- failure injection test outputs (TV-10/11/12)
- daemon-restart test (TV-20)
- 1000-round cold-start test (TV-15) latency measurement
- `pin_density` telemetry sample (Phase 5)
- screenshot or transcript of admin override UI working (Phase 5)
