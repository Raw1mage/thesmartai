# Invariants — compaction-redesign

## Invariants

Cross-cut guarantees that must hold regardless of code-generation language
or implementation choice. Every invariant maps to at least one enforcement
point.

- **INV-1 State-driven evaluation only** — the runloop's decision to
  invoke `SessionCompaction.run` shall depend solely on **observable
  session state** (Memory, Anchor in message stream, session.execution
  pinned identity, lastFinished tokens, message-stream tail). No flags
  set by previous iterations may be consulted.
  - **Scope**: `prompt.ts` runloop; `compaction.ts` `run()`; `processor.ts`
    mid-stream account-switch handler.
  - **Why**: stale flags caused the 2026-04-27 infinite loop. State
    cannot go stale; flags can.
  - **DD**: DD-1

- **INV-2 Single anchor per real condition** — exactly one Anchor is
  written per real triggering condition. A single rotation, single
  overflow, single manual `/compact` produces at most one Anchor write
  via `run()`.
  - **Scope**: `SessionCompaction.run`; runloop iteration body.
  - **Why**: the 2026-04-27 double-compaction incident was two Anchors
    per single user action. Cooldown + state-driven evaluation make this
    unrepresentable.
  - **DD**: DD-7

- **INV-3 Synthetic Continue gated by trigger** — synthetic Continue
  user message is appended **iff** `INJECT_CONTINUE[observed] === true`.
  No code path may inject Continue under any other condition.
  - **Scope**: `SessionCompaction.run` post-anchor-write.
  - **Why**: the 2026-04-27 infinite loop's amplifier was unconditional
    Continue injection on rebind; making the gate a single table lookup
    eliminates accidental injection.
  - **DD**: R-6, DD-9

- **INV-4 Cost-monotonic chain** — for every `Observed` value, the
  KIND_CHAIN entry shall be ordered such that cost is non-decreasing.
  Reordering kinds within a chain is permitted only if the new order
  remains non-decreasing in cost.
  - **Scope**: `KIND_CHAIN` table literal in `compaction.ts`.
  - **Why**: the entire economic model of the redesign rests on "free
    first, paid only when forced". Out-of-order kind cost wastes quota
    and defeats the point.
  - **DD**: DD-9, R-2

- **INV-5 Memory persistence is idempotent** — `Memory.read(sid)`
  followed by `Memory.write(sid, sameMem)` shall produce a Storage
  state byte-equivalent to the read input.
  - **Scope**: `memory.ts` Memory.read / Memory.write.
  - **Why**: lazy migration relies on read→project→write being safe;
    non-idempotent write would amplify on every legacy session touch.

- **INV-6 TurnSummary append is durable before runloop returns** —
  when `Memory.appendTurnSummary` is called at runloop exit, the new
  TurnSummary entry shall be persisted to Storage (not just held in
  memory) before the runloop returns control to the caller.
  - **Scope**: `prompt.ts` runloop exit; `Memory.appendTurnSummary`.
  - **Why**: a daemon crash immediately after runloop return must not
    lose the most recent turn's narrative. The fire-and-forget pattern
    in DD-2 says "do not block runloop on it" — but the append itself
    must complete before the next durable boundary, not before runtime
    state can change.
  - **Note**: this is "durable before next boundary", not "blocking the
    return". Implementation: use Storage's ordered write semantics.

- **INV-7 Anchor accountId/providerId reflects time-of-write** — the
  Anchor written by `run()` carries `providerId`, `modelID`, `accountId`
  values from `session.execution` at the moment of write, not from
  message-stream history.
  - **Scope**: anchor-write helper.
  - **Why**: state-driven rebind detection compares pinned identity to
    last Anchor's identity. If Anchor's identity were stale, rebind
    detection would mis-fire.
  - **DD**: DD-1

- **INV-8 Legacy paths are read-only after migration** — once
  `Memory.write(sid, ...)` succeeds for a session, no code may write to
  `shared_context/<sid>` Storage key or `rebind-checkpoint-<sid>.json`
  disk file again for that session.
  - **Scope**: deprecation shim layer.
  - **Why**: dual-write would create drift. DD-3 mandates new path is
    sole writer; legacy is read-only fallback only.

- **INV-9 No silent kind transitions** — every kind chain step that
  fails or is skipped emits a `log.info` (or higher) line naming the
  kind and reason. Empty fallback paths leave a non-empty log.
  - **Scope**: `SessionCompaction.run` chain walk; every executor's null
    return path.
  - **Why**: AGENTS.md rule 1. Silent fallback breaks debuggability;
    we already paid for that lesson with the 2026-04-27 incidents.

## Rationale

The redesign's value proposition collapses if any of INV-1..INV-3 is
violated — those three together are what makes the two 2026-04-27 bug
classes structurally impossible. INV-4 is the economic backbone (free
first). INV-5..INV-8 are durability and consistency guarantees that keep
the migration safe. INV-9 is an AGENTS.md derivative.

## Enforcement Points

- **INV-1** → enforced by:
  - `deriveObservedCondition` unit tests with injected legacy flags
    (TV-R1-3 — flag must not affect output)
  - Code grep CI step asserting zero references to deleted flag symbols
    outside shim layer
- **INV-2** → enforced by:
  - Manual smoke S4 in sequence.json (rotation produces one Anchor)
  - Cooldown unit tests (existing 9 cases continue to pass)
- **INV-3** → enforced by:
  - TV-R6-1 / TV-R6-2 (rebind ≠ Continue; overflow = Continue)
  - Code review checklist on any new entry to `INJECT_CONTINUE` table
- **INV-4** → enforced by:
  - Compile-time review of `KIND_CHAIN` table literal
  - Property-based test: for every Observed, walking the chain produces
    monotonically non-decreasing cost values
- **INV-5** → enforced by:
  - TV-R7-1 (legacy fallback projection)
  - Round-trip unit test: write(read(write(read(initial)))) === initial
- **INV-6** → enforced by:
  - Unit test that simulates daemon crash immediately after runloop
    return; verifies TurnSummary present in Storage on restart
- **INV-7** → enforced by:
  - TV-R5-1 / sequence.json S4 (Anchor identity used for next-iteration
    rebind detection)
- **INV-8** → enforced by:
  - Code grep CI step: legacy Storage keys / file paths appear only in
    shim layer reads, never writes
- **INV-9** → enforced by:
  - TV-R2-2 (fall-through transition emits log.info)
  - Manual smoke: verify CI logs contain expected log lines for each
    failed kind during phase-11 acceptance
