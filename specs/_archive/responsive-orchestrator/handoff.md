# Handoff: responsive-orchestrator

## Execution Contract

The build agent picks up at Phase 1 and works phase-by-phase per
tasks.md. Each phase is a rhythmic checkpoint (per plan-builder §16.5)
— write phase summary, roll TodoWrite, continue. Do not prompt user
between phases unless a Stop Gate condition fires.

State machine for this build:
- entered `implementing` when Phase 1.1 first checkbox flips to `[~]`
- stays in `implementing` until Phase 9 (validation) all checked
- transitions to `verified` after acceptance evidence captured in
  this folder (validation outputs, test logs)
- transitions to `living` after merge to main repo

## Required Reads

Before touching code:

1. [proposal.md](proposal.md) — six effective requirements + IN/OUT scope
2. [spec.md](spec.md) — seven Requirements with G/W/T scenarios + 7
   acceptance checks (A1..A7)
3. [design.md](design.md) — DD-1..DD-11 (especially DD-1 stub
   contract, DD-2 disk-terminal substrate, DD-3 wake-only notice,
   DD-3.1 rotateHint)
4. [data-schema.json](data-schema.json) — every wire format and
   stored entity
5. [errors.md](errors.md), [observability.md](observability.md) —
   what to emit when things go right and wrong

Reference (consult on demand):
- [idef0.json](idef0.json), [grafcet.json](grafcet.json),
  [c4.json](c4.json), [sequence.json](sequence.json) — modeling
  artifacts for cross-checking against implementation

## Beta Workflow

This implementation **must run on the beta worktree**
(`/home/pkcs12/projects/opencode-beta/`) per AGENTS.md. The build
agent invokes `beta-workflow` skill for admission gate, fetch-back,
and finalize. Direct edits to the main repo (`/home/pkcs12/projects/opencode/`)
are forbidden until fetch-back at Phase 10.

XDG backup before Phase 1 first edit:
- already taken at spec proposal time:
  `~/.config/opencode.bak-20260423-1128-responsive-orchestrator/`
- if rotation accumulated since then, take a fresh one

## Stop Gates In Force

Pause work and ask user when any of these fire:

- **SG-1 destructive**: any code change to a path outside
  `packages/opencode/src/{tool,session,bus,config}/` or
  `packages/mcp/system-manager/src/` requires user approval —
  blast radius unclear
- **SG-2 prompt cache**: if Phase 9 measurements show prompt cache
  hit rate dropped > 20% from baseline, pause — may need DD-12 added
- **SG-3 LLM contract violation**: if any provider rejects the new
  stub `tool_result` shape (`{status:"dispatched", ...}`), pause —
  DD-1 needs revision
- **SG-4 disk-terminal race**: if Phase 9.3 reveals any case where
  watchdog A misses a finish, pause — the spec assumes 守門 fix
  is sufficient; if not, design needs amendment
- **SG-5 multi-subagent shared-state**: if Phase 9.6 surfaces any
  data corruption / double-injection / lost-notice under parallel
  load, pause — issues.md I-2 may need to elevate to in-scope
- **SG-6 architecture drift**: if discoveries during implementation
  reveal that any DD assumption is structurally wrong, pause and
  amend design.md before continuing

## Per-Task Ritual

After each `- [ ]` flips to `- [x]`:

1. Mark completed in tasks.md immediately (not batched)
2. Run `bun run ~/projects/skills/plan-builder/scripts/plan-sync.ts
   /home/pkcs12/projects/opencode/specs/_archive/responsive-orchestrator/`
3. Read sync output:
   - `clean` → continue
   - `warned` → apply decision tree from plan-builder §16.3
4. Update TodoWrite item to `completed`

## Phase-boundary Ritual

After last `- [x]` of a phase:

1. Append a phase-summary block to
   `docs/events/event_<YYYYMMDD>_responsive_orchestrator_phase<N>.md`
   covering: tasks completed, key decisions added (DD-NN), validation
   evidence, drift resolved, what remains
2. Roll TodoWrite to next phase's items
3. Mark first task of next phase `in_progress`
4. Continue immediately — no user prompt unless Stop Gate fires

## Execution-Ready Checklist

Build agent confirms before Phase 1.1:

- [ ] Read all five Required Reads sections above
- [ ] Beta worktree allocated; main repo confirmed at clean state
- [ ] XDG backup exists from today
- [ ] daemon currently running (will be restarted at Phase 10.1)
- [ ] system-manager MCP version known (will bump at Phase 7.6)
- [ ] No other in-flight spec touches the same files (check
  `find specs -name '.state.json' -exec grep -l implementing {} \;`)

## Out-of-Scope Reminders (do not drift)

Per proposal.md:
- Do not implement multi-subagent stress test (issues.md I-2)
- Do not implement subagent stream reconnect / status bar hydration
  (issues.md I-1) — stop and tell user if encountered
- Do not implement frontend UI styling for synthetic messages —
  there are no synthetic messages (DD-3)
- Do not generalize liveness contract to other A-waits-for-B sites —
  separate process-liveness-contract initiative

## Promotion

- `planned → implementing` happens automatically on first 1.1 check
- `implementing → verified` requires all of Phase 9 checked + evidence
  files attached to this folder (e.g.
  `validation-A1.md`, `validation-A3.log`, etc.)
- `verified → living` requires merge to main repo confirmed
