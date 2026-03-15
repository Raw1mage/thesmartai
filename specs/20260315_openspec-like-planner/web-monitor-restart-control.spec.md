# Spec: Web monitor + controlled restart control

## Requirements

### 1. Sidebar work monitor

- The session sidebar MUST expose a single primary `工作監控` card for execution status.
- The sidebar MUST remove legacy Smart Runner history / narration / result / debug fragmentation.
- The sidebar MUST allow card order and expand/collapse state to persist globally.

### 2. Runner visibility

- The Web UI MUST present Runner as a distinct execution unit (`[R]`) rather than a vague status summary.
- The Runner card MUST remain visible even when inactive.
- When no active runner work exists, the Runner card MUST show `idle`.
- When runner activity exists, the card MUST surface current task/step and relevant execution traces.

### 3. Runner activity details

- The Runner card SHOULD summarize:
  - current task / step
  - active tools
  - delegated subagents
  - observable MCP/server usage traces when available
  - runtime / queue / waiting state

### 4. Todo display semantics

- Todo checkboxes MUST reflect the real persisted todo `status`.
- Follow-up replans MUST NOT silently revert completed/cancelled/in-progress work back to pending when the new list overlaps the same work.
- Todo metadata labels SHOULD only display meaningful states, not low-signal `implement` badges.

### 5. Controlled restart

- The Web settings UI MUST provide an explicit `Restart Web` action.
- Triggering restart MUST call an authenticated backend control route.
- The frontend MUST enter a bounded waiting state and reload only after health recovery is observed.
- The restart flow MUST be action-triggered, not always-on auto-refresh.

### 6. Runtime control path

- The backend MUST use a runtime-configurable control script path.
- The default contract path SHOULD be `/etc/opencode/webctl.sh`.
- The runtime config contract SHOULD expose this path via `OPENCODE_WEBCTL_PATH`.

## Acceptance scenarios

### Scenario A — runner inactive

- Given a session with no active runner work
- When the sidebar opens
- Then `[R]` is visible and shows `idle`

### Scenario B — overlapping replan

- Given a todo list with completed items
- When a follow-up plan rewrites overlapping todos
- Then prior completed items remain completed

### Scenario C — controlled restart

- Given the user selects `Restart Web`
- When restart is accepted
- Then the page waits for `/api/v2/global/health` to recover
- And the page reloads automatically when healthy

### Scenario D — meaningful todo labels

- Given a todo item whose action kind is `implement`
- When the todo list renders
- Then `implement` is not shown as a separate low-value badge
