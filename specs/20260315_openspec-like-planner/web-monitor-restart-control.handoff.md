# Handoff: Web monitor + controlled restart control

## Read first

1. `proposal.md`
2. `spec.md`
3. `design.md`
4. `tasks.md`
5. `plan-build-target-model.md`
6. `planner-hardening-roadmap.md`
7. `autorunner-compat-analysis.md`
8. `runner-contract.md`
9. `docs/events/event_20260315_sidebar_status_card_simplify.md`

## Current handoff state

- Sidebar simplification, runner card, todo integrity fix, and controlled restart code paths have been implemented.
- A first target-model definition now exists for `plan/build` semantics, but runtime implementation has not yet been refactored to match it.
- A first autorunner compatibility analysis now exists: current architecture already follows mission+todo+handoff contracts, but still lacks a dedicated runner-level contract.
- A first runner contract draft now exists and defines the intended authority split: planner owns planning truth; runner owns build-mode execution continuity.
- First-slice planner surface convergence is now landed: builtin `/plan` and `@planner` both point toward the same canonical planner path instead of remaining split between missing command vs planner-ish mention routing.
- The remaining work is now split between operational closure and planner/runtime contract alignment.

## Remaining stop gates

### Gate A — host runtime install

`/etc/opencode/webctl.sh` could not be installed from this session because the shell lacked permission to write under `/etc/opencode`.

Required host action:

```bash
sudo install -m 755 "/home/pkcs12/projects/opencode/webctl.sh" "/etc/opencode/webctl.sh"
```

And ensure `/etc/opencode/opencode.cfg` contains:

```bash
OPENCODE_WEBCTL_PATH="/etc/opencode/webctl.sh"
```

### Gate B — architecture sync

Architecture sync for the already-implemented restart/planner reinterpretation is done, but the new runner contract draft is still **design-only** and has not yet changed runtime architecture.

Therefore current doc posture is:

- `docs/ARCHITECTURE.md` = already updated for implemented runtime truths
- runner contract draft = no additional architecture rewrite required until runtime binding lands

### Gate C — legacy mode convergence

Legacy `plan/build` behavior is still biased toward readonly-vs-writable semantics.

Before declaring planner/runtime convergence complete, implementation must align with:

- `plan-build-target-model.md`
- `planner-hardening-roadmap.md`
- `autorunner-compat-analysis.md`

This includes confirming that:

- `plan` behaves as a planner-first discussion agent
- `build` behaves as an execution workflow mode
- todo is treated as plan-derived runtime state
- autorunner can maintain the session against the same plan/build contract
- `/plan` and `@planner` remain semantically aligned after deeper runtime refactors (current slice only converged the entry path)

## Expected runtime todo seed

- update architecture doc
- verify host runtime script install/config
- run end-to-end restart button validation
- refactor legacy plan/build mode implementation
- add runner-level contract (`runner.txt` or equivalent) if autorunner is to become the explicit session governor
- bind build-mode continuation to the future runner contract asset
- deepen planner entry/runtime convergence beyond first-slice aliasing

## Definition of execution-ready

This change set is execution-ready for final closure only when:

1. host runtime script path is installed and configured
2. `Restart Web` is validated end-to-end
3. architecture doc is updated to match the new contract
4. runner contract is bound into runtime (`runner.txt` or equivalent)
5. final event/commit status reflects planner-first retrofit rather than ad hoc implementation
