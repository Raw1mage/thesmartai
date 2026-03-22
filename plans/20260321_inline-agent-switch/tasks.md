# Tasks: Inline Agent Switch

## Phase 1: Core Mechanism

- [ ] T1: task.ts inline mode
  - Add `inline` code path to `task()` tool execute function
  - When inline eligible: inject synthetic user message with target agent, return signal to prompt loop
  - Inline eligibility: root session (no parentID), not already in inline switch
  - Keep child session path as fallback for non-eligible cases

- [ ] T2: prompt.ts agent switch detection
  - Detect `task` tool result with `inline: true` signal
  - Break current prompt loop iteration to let next iteration pick up synthetic message
  - Detect Worker `end_turn` (agent !== "build" && no pending tool calls)
  - Inject synthetic return message to switch back to Orchestrator

- [ ] T3: Agent return & summary generation
  - On Worker end_turn, auto-generate summary from recent tool calls (files changed, verification results)
  - Inject as synthetic user message with agent="build"
  - Include metadata: `{ agentSwitch: true, fromAgent, toAgent, toolCallCount, filesChanged }`

- [ ] T4: Permission boundary enforcement
  - Verify `resolveTools()` correctly reloads permissions when agent field changes between iterations
  - Test: Orchestrator cannot edit/write, Worker cannot task/todowrite
  - No code change expected (already reads agent from latest user message)

## Phase 2: Frontend

- [ ] T5: Agent switch indicator in message list
  - Replace SubagentActivityCard with lightweight inline header
  - Show agent name + description when switch occurs
  - Show elapsed time and tool call count when switch completes

- [ ] T6: Remove SubagentActivityCard & bridge event dependencies
  - Remove SubagentActivityCard component
  - Remove child session sync logic (`sync.session.sync(childSessionId)`)
  - Remove bridge event handling for inline sessions

## Phase 3: Compaction

- [ ] T7: Agent-aware compaction waypoints
  - Mark agent switch messages as compaction boundaries
  - Compaction preserves most recent agent switch context
  - Older agent work compressed to: summary of changes + verification result

## Phase 4: Cleanup

- [ ] T8: Unify plan_enter/plan_exit with inline agent switch
  - plan_enter → inline switch to "plan" agent (already same pattern)
  - plan_exit → inline switch to "build" agent + mission materialization
  - Reduce code duplication between plan.ts and new inline switch mechanism

- [ ] T9: Remove child session fallback (if Phase 1-2 stable)
  - Remove worker process spawning for inline-eligible sessions
  - Remove bridge event protocol
  - Remove session-level permission narrowing for subagents
  - Keep child session only for API-triggered tasks (non-interactive)

## Validation

- [ ] V1: End-to-end test: Orchestrator delegates coding task → coding agent works with full context → returns to Orchestrator
- [ ] V2: Permission boundary test: coding agent cannot call task(), Orchestrator cannot call edit()
- [ ] V3: Compaction test: long session with multiple agent switches compacts correctly
- [ ] V4: Context continuity test: after switch, Worker can reference earlier conversation without re-reading
