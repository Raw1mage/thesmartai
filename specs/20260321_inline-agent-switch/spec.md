# Spec: Inline Agent Switch

## Mechanism

### Agent Switch Protocol

When Orchestrator calls `task()` with inline mode:

1. `task()` does NOT create a child session
2. Instead, injects a **synthetic user message** into current session with:
   - `agent` field set to target agent name (e.g., "coding")
   - Text part containing the delegation prompt
   - Metadata: `{ agentSwitch: true, fromAgent: "build", toAgent: "coding" }`
3. Current prompt loop iteration ends (`break` or natural end)
4. Next prompt loop iteration picks up the new user message
5. `resolveTools()` reads the new agent → loads different prompt + permissions
6. Model continues with full conversation context + new role instructions

### Agent Return Protocol

When Worker completes its task:

1. Worker produces `end_turn` (no more tool calls needed)
2. System injects a **synthetic user message** to switch back:
   - `agent` field set back to "build" (Orchestrator)
   - Text: summary of what was done (auto-generated from tool call history)
   - Metadata: `{ agentSwitch: true, fromAgent: "coding", toAgent: "build" }`
3. Orchestrator resumes with full context including Worker's tool calls

### Permission Boundaries

Each agent switch triggers `resolveTools()` with the new agent's permission ruleset:
- Orchestrator (build): can `task`, `todowrite`, `question`, `plan_enter` — cannot `edit`, `write`
- Coding worker: can `read`, `edit`, `write`, `bash`, `glob`, `grep` — cannot `task`, `todowrite`
- Planner worker: can `read`, `edit`, `write`, `bash`, `glob`, `grep`, `skill` — cannot `task`
- Review worker: can `read`, `glob`, `grep`, `bash` — cannot `edit`, `write`, `task`

### Compaction Impact

Shared context grows faster. Compaction strategy adjustments:
- Agent switch boundaries are **compaction waypoints** — compress content before the switch, keep recent switch context intact
- Tool call details from completed Worker turns can be aggressively summarized
- Decision points and final results must be preserved

## Precedent

`plan_exit` (plan.ts:1026-1230) already implements this pattern:
- Creates synthetic user message with `agent: "build"`
- Appends execution instructions as text part
- Next prompt loop loads build agent config
- No new session created

## Constraints

- Single-worker only: one agent active at a time
- Agent switch is sequential: Orchestrator → Worker → Orchestrator
- No nesting: Worker cannot delegate further (no `task` in Worker permissions)
- Context window managed by compaction, not by isolation
