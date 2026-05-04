# Design: autonomous-opt-in

## Context

The runloop originally pumped autonomous continuations on every turn-end regardless of session context, and earlier revisions also routed that decision through a synthetic "Continuation Gate" prompt round. The current direction moves the gate fully into runtime policy so chat turns do not depend on an extra LLM self-check round.

This design lifts the arm/disarm decision out of the LLM and into a runtime flag keyed off plan-builder artifact state. The LLM stops being a gatekeeper and becomes purely an executor when autorun is armed. Arm/disarm is driven by two explicit signals (verbal trigger phrase, question tool answer) — no AI-inferred intent, no hidden heuristics.

## Goals / Non-Goals

### Goals

- Collapse L1-L3 compensating layers into a single, auditable runtime gate
- Make autonomous execution opt-in, with plan-builder artifact state as the canonical pre-condition
- Eliminate the ~30s gate-check round in chat-only turns
- Keep the semantics of armed execution unchanged so existing behavior (within implementing flow) is preserved byte-for-byte

### Non-Goals

- Provide a "run without plan" escape hatch (intentional coupling per user requirement)
- Infer intent from AI output (runtime reads user input and explicit question answers only)
- Change plan-builder's state machine (the `.state.json` lifecycle is untouched; we only add reader + a write hook for R6)
- Visualize armed state in TUI / webapp (follow-up spec)

## Decisions

> **Revision 2026-04-23 (main-as-SSOT pivot)** — DD-1 / DD-2 / DD-4 / DD-5 / DD-6 (the AutorunArmed flag path) / DD-7 / DD-8 (second key) are `[SUPERSEDED by DD-11]`. See `tasks.md` Revision section.

- **DD-11** (2026-04-23, added) **Main's `workflow.autonomous.enabled` boolean is the SSOT.** All arming logic flips this single session-scoped field via the existing `Session.updateAutonomous({enabled})` path. No separate `AutorunArmed` Storage key, no `SessionActiveSpec` binding, no R0+R1+R2+R3 layering, no R6 demote-on-edit. Rationale: `shelf/autonomous-opt-in` already implemented the layered design in commits `6db33208d` (Phase 1) and `ed8e9be2e` (Phase 2) but was never merged; main diverged via `1ed57f092` into a simpler gate. User decision (2026-04-23) is to accept main as SSOT rather than resurrect shelf. The verbal-arm feature can be delivered on the simpler gate with acceptable fidelity; the extra layering was protective-over-engineering.
- **DD-1** ~~Arm state is ephemeral Storage, not `.state.json`.~~ **[SUPERSEDED by DD-11]** — on main, arm state is `workflow.autonomous.enabled` in `info.json`; already session-scoped and ephemeral enough.
- **DD-2** ~~Session-spec binding is a separate Storage key `[session_active_spec, sessionID] = slug`.~~ **[SUPERSEDED by DD-11]** — no session→spec binding on main. Refill (Phase 3) will look up `tasks.md` by convention (session directory) rather than via a stored pointer.
- **DD-3** Verbal trigger phrases live in `/etc/opencode/tweaks.cfg` under key `autorun.trigger_phrases` with a default seed array. Loaded through the existing `TweaksConfig` reader. Matching is whole-phrase, case-insensitive, anywhere in the user message (not limited to sentence start). Rationale: users shouldn't have to remember exact punctuation or position. **(KEPT)**
- **DD-4** ~~Plan-edit demotion (R6) is implemented as a hook in plan-builder write scripts~~ **[SUPERSEDED by DD-11]** — R6 dropped entirely.
- **DD-5** ~~Arming question (R3b) fires at both `--to planned` and `--to implementing` transitions.~~ **[SUPERSEDED by DD-11]** — R3b dropped; verbal phrase (R3a) is the sole arm path.
- **DD-6** ~~Disarm is an atomic flag flip (`autorun_armed.armed = false`) + Bus event `autorun.disarmed`.~~ **[REVISED]** — Disarm flips `workflow.autonomous.enabled = false` via `Session.updateAutonomous`; the existing `bus.session.workflow.updated` event already carries the change, no new Bus event type needed.
- **DD-7** ~~R6 demotion preserves in-flight work.~~ **[SUPERSEDED by DD-11]** — no demotion path.
- **DD-8** `/etc/opencode/tweaks.cfg` gains ~~two keys~~ **one key** with fallback default:
  - `autorun.trigger_phrases` (array of string) — default seed: `["接著跑", "自動跑", "開 autonomous", "autorun", "keep going", "continue autonomously"]`
  - ~~`autorun.demote_on_disarm` (bool)~~ **[REMOVED]** — no R6 to demote.
  - (NEW) `autorun.disarm_phrases` (array of string) — default seed: `["停", "暫停", "stop", "halt"]`. Matches same way as trigger phrases.
- **DD-9** Superseded by runtime hardening: autonomous continuation no longer depends on a retained `runner.txt` gate prompt. Armed sessions enqueue only a minimal synthetic resume signal, and stop/continue is decided from runtime policy + todo state rather than a prompt-level self-check.
- **DD-10** Dead slash commands `/plan`, `/auto-yes-enabled`, `/auto-yes-disabled` in `use-session-commands.tsx` are deleted outright, not gated behind a migration flag. They were never wired correctly (the `/plan` handler re-types `/plan` into the input; auto-yes handlers are unused). Keeping them would mislead users.

## Risks / Trade-offs

- **R-1 Binding drift**: session is bound to a spec that gets renamed / archived out from under it. Mitigation: runtime reads `.state.json` each pump; if missing, `log.warn` and auto-disarm.
- **R-2 Trigger phrase false positive**: user says "I want to start building this feature later" — matches `start building`. Mitigation: Phase 1 ships with exact whole-phrase match (no fuzzy); users tune their phrase list; Phase 2 may add lookbehind for negative context.
- **R-3 Question tool MCP dependency**: plan-builder promote script requires the MCP question tool to be registered in the session. Mitigation: script prints a clear error + fallback instruction ("MCP question tool not available; arm by typing a trigger phrase instead") if the tool is absent.
- **R-4 File-watcher races** (OQ-1 Phase 2): watcher could fire during a plan-builder script's own atomic write. Mitigation: scripts acquire a short file-lock; watcher ignores writes inside the lock window.
- **R-5 Phase-rollover mis-parse of tasks.md**: `## N.` heading detection relies on consistent markdown structure. Mitigation: `plan-validate.ts` already checks tasks.md structure at `planned` promotion; invalid structure blocks the promote, so runtime never sees a malformed `tasks.md` in `planned+` states.
- **R-6 Intentional coupling surprises new users**: users not familiar with plan-builder may be confused why their session "doesn't run anything autonomously". Mitigation: first-time-per-session inform message when the runloop would have pumped but isn't armed — `log.info "autorun disabled by default; run plan-promote to arm, or type a trigger phrase"`.

## Critical Files

- `packages/opencode/src/session/workflow-runner.ts` — core runloop decision; all three "always-on" sites plus `enqueueAutonomousContinue` get the arm gate
- `packages/opencode/src/session/prompt.ts` — `handleContinuationSideEffects` (line ~390) must check arm state before calling `enqueueContinue`
- `packages/opencode/src/storage/**` — new `session_active_spec` and `autorun_armed` key namespaces
- `packages/opencode/src/config/tweaks.ts` — (or similar) extend the `TweaksConfig` reader with the two new keys
- `packages/app/src/pages/session/use-session-commands.tsx` — remove three dead commands
- `/home/pkcs12/.claude/skills/plan-builder/scripts/plan-promote.ts` — accept `--session`, invoke MCP question tool, write binding
- `/home/pkcs12/.claude/skills/plan-builder/scripts/plan-amend.ts` / `plan-revise.ts` / `plan-extend.ts` / `plan-refactor.ts` / `plan-sync.ts` — all get the R6 pre-check hook (ideally in a shared `scripts/lib/r6-demote.ts` helper)
- `/etc/opencode/tweaks.cfg` — add two new keys with seed defaults
- `specs/architecture.md` — update runloop section to describe arm-gated pumping

## Dependencies

- plan-builder `.state.json` schema (already stable)
- MCP `question` tool registration in the user's session (already configured in default skill layer)
- Storage API (already used by `SharedContext`, `RunQueue`, etc.)
- `TweaksConfig` reader (per feedback_tweaks_cfg)

## Rollout Strategy

Phase 1 (this spec's scope):

- Runtime arm gate at four call sites
- Storage keys + helpers
- plan-builder script hooks (R6) — primary detection path only
- tweaks.cfg keys with seed defaults
- Delete dead slash commands
- Tests for R0-R6

Phase 2 (follow-up, separate spec):

- File-watcher for R6 secondary path
- TUI/webapp badge showing armed state
- Telemetry on arm/disarm reasons for tuning the trigger phrase list

## Observability

- Bus events: `autorun.armed`, `autorun.disarmed`, `autorun.refill`, `autorun.refill_exhausted`, `autorun.demoted_by_edit`
- Log lines (all prefixed `[autorun]`): arm refused reasons, successful arms, disarm reasons, R6 demotions
- Metrics (future): arm count per session, average armed duration, disarm reason distribution
