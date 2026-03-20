# Design: Inline Agent Switch

## Component Changes

### 1. task.ts — Inline Mode

Current `task()` creates child session + worker process. New inline mode:

```
task(prompt, subagent_type) →
  if (inline eligible) →
    inject synthetic user message (agent=subagent_type, text=prompt)
    return { inline: true } to prompt loop
  else →
    fallback to child session (existing behavior)
```

Inline eligibility: session is root (not already a subagent), single-worker policy.

### 2. prompt.ts — Agent Switch Handling

In the main `while(true)` loop:
- After model produces tool call for `task` with inline result
- Break current iteration
- Next iteration reads the synthetic user message
- `resolveTools()` loads new agent config
- Model continues with shared context

For return:
- Detect Worker `end_turn` (no pending tool calls)
- Inject synthetic return message (agent="build")
- Continue loop as Orchestrator

### 3. resolve-tools.ts — Dynamic Permission Reload

Currently: permissions resolved once from user message's agent field.
No change needed — already reads agent from the latest user message per iteration.

### 4. agent.ts — No Structural Change

Agent definitions stay the same. Permission rulesets already define what each agent can do. The switch just changes which agent's ruleset is active.

### 5. SubagentActivityCard — Remove

With inline mode, all Worker tool calls appear as regular message parts in the main conversation. No need for:
- Bridge events
- Child session sync
- Collapsed activity cards

Replace with lightweight **agent switch indicator** in the message list (e.g., "→ coding agent" header).

### 6. Compaction — Agent-Aware Compression

Add agent switch boundaries as compaction waypoints:
- Before compacting, identify agent switch messages
- Preserve the most recent agent switch + its work
- Aggressively summarize older agent work (keep: what changed, verification result)

## Data Flow

```
User: "implement feature X"
  ↓
[Orchestrator turn] reads context → decides to delegate coding
  ↓ task("implement X", "coding") → inline mode
  ↓
[Synthetic user message: agent="coding", text="implement X"]
  ↓
[Coding turn 1] full context available → reads files, edits code
  ↓
[Coding turn 2] continues with accumulated context → runs tests
  ↓
[Coding end_turn] → system detects completion
  ↓
[Synthetic user message: agent="build", text="coding agent completed: ..."]
  ↓
[Orchestrator turn] full context including all coding work → decides next step
```

## Migration Path

Phase 1: Add inline mode to `task()`, keep child session as fallback
Phase 2: Default to inline for root sessions
Phase 3: Remove child session code path (if inline proves stable)
