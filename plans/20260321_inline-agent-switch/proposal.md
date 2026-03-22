# Proposal: Inline Agent Switch

## Problem

Current subagent architecture uses child sessions (isolated context):
1. Subagent cold-starts with only a delegation prompt — no conversation history
2. Orchestrator loses subagent work details (only gets final summary)
3. Each session transition = full context re-send to LLM API
4. Coding subagent does 50%+ of session work but has least context
5. SubagentActivityCard hides work in collapsed cards instead of main conversation

## Solution

Replace child-session subagents with **same-session role switching**: Orchestrator delegates by injecting a synthetic message with a new agent ID. The prompt loop reloads agent prompt + permissions, and the model continues with full shared context.

This is already proven by `plan_enter`/`plan_exit` — they switch between plan and build agents within the same session via synthetic messages.

## Scope

### IN
- Inline agent switch mechanism (generalized from plan_exit/plan_enter)
- Shared context between Orchestrator and Worker roles
- Tool permission switching per agent role
- All subagent work visible in main conversation (no SubagentActivityCard)
- Compaction optimization for longer shared-context sessions

### OUT
- Multi-worker parallelism (policy: single-worker only)
- Remote/process-isolated subagents
- Changes to the external API surface
