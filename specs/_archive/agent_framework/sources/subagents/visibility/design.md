# Design: Subagent IO Visibility

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Main Session (Orchestrator)                                │
│  ┌────────────────────────────────┐                         │
│  │  Assistant Message              │                         │
│  │  ┌──────────────────────────┐  │                         │
│  │  │  ToolPart (tool="task")  │  │                         │
│  │  │  state: {                │  │                         │
│  │  │    status: "running"     │──┼──┐                      │
│  │  │    metadata: {           │  │  │  metadata.sessionId  │
│  │  │      sessionId: "ses_…"  │  │  │                      │
│  │  │    }                     │  │  │                      │
│  │  │  }                       │  │  │                      │
│  │  └──────────────────────────┘  │  │                      │
│  └────────────────────────────────┘  │                      │
│                                      │                      │
│  ┌───────────────────────────────────▼──────────────────┐   │
│  │  SubagentActivityCard                                │   │
│  │  ┌─ Header ────────────────────────────────────────┐ │   │
│  │  │  🔧 explore agent | Telemetry status     2m 30s │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  ┌─ Activity Feed (collapsible) ───────────────────┐ │   │
│  │  │  ✓ grep   "telemetry"                           │ │   │
│  │  │  ✓ read   /src/util/telemetry.ts                │ │   │
│  │  │  ⟳ bash   bun run typecheck                     │ │   │
│  │  │                                                  │ │   │
│  │  │  [Final output text when completed]              │ │   │
│  │  └──────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         │ sync.session.sync(childSessionId)
         │ sync.data.message[childSessionId]
         │ sync.data.part[childMsgId]
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Child Session (Worker Process)                             │
│  ┌─ User Message ──────────────────────────────────────┐    │
│  │  [Task prompt from orchestrator]                     │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌─ Assistant Message ─────────────────────────────────┐    │
│  │  ToolPart: grep → completed                         │    │
│  │  ToolPart: read → completed                         │    │
│  │  ToolPart: bash → running                           │    │
│  │  TextPart: "Found telemetry config at…"             │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Child SessionID Availability (Already Implemented)

task tool 在建立子 session 後立即呼叫 `ctx.metadata()`：

```
task.ts:917  ctx.metadata({ title: ..., metadata: { sessionId: session.id, model, ... } })
     ↓
resolve-tools.ts:181  onMetadata → Session.updatePart(part, { state: { status: "running", metadata: { sessionId } } })
     ↓
Bus → SSE → Frontend sync store → part.state.metadata.sessionId available
```

關鍵：`metadata.sessionId` 在 **running** 狀態就可用，不需等到 completed。

### 2. Bridge Event Flow (Already Implemented)

Worker process 的子 session events 透過 bridge 轉發到主 process：

```
Worker Process stdout → "__OPENCODE_BRIDGE_EVENT__ {type, properties}"
     ↓
Main Process task.ts:140  publishBridgedEvent()
     ↓
Bus.publish(MessageV2.Event.PartUpdated, ...) / Session.Event.Updated, etc.
     ↓
SSE → Frontend event-reducer.ts → sync.data.message[childSessionId] / sync.data.part[childMsgId]
```

### 3. Frontend Rendering (New)

```
SubagentActivityCard
  ├── createEffect: sync.session.sync(childSessionId)     // 初次載入
  ├── createEffect: setInterval(sync, 3000) while running // 定期重新同步
  ├── childMessages = sync.data.message[childSessionId]    // reactive
  ├── activityItems = childMessages → filter assistant → extract tool/text parts
  └── Render:
       ├── BasicTool (collapsible, defaultOpen when running)
       │    ├── Header: "{agentType} agent" | description | elapsed time
       │    └── Content:
       │         ├── Error banner (if error)
       │         ├── Tool call items (status icon + tool name + subtitle)
       │         ├── Text items (last 500 chars, markdown rendered)
       │         ├── Loading indicator (if no activity yet)
       │         └── Final output (if completed, last 1000 chars)
       └── Timer: tick every 1s while running → displayElapsed()
```

## Component: SubagentActivityCard

### Location

`packages/app/src/pages/session/components/message-tool-invocation.tsx`

### Props

```typescript
interface SubagentActivityCardProps {
  part: ToolPart        // The task tool part from parent session
  errorText?: string    // Pre-extracted error message (for error state rendering)
}
```

### State Derivation

| Source | Field | Usage |
|--------|-------|-------|
| `part.state.input.subagent_type` | Agent type label | Header title |
| `part.state.input.description` | Task description | Header subtitle |
| `part.state.metadata?.sessionId` | Child session ID | Load child messages |
| `part.state.status` | Running/completed/error | UI state |
| `part.state.time.start/end` | Elapsed time | Timer display |
| `sync.data.message[childSessionId]` | Child messages | Activity feed |
| `sync.data.part[childMsgId]` | Child parts | Tool/text items |

### Match Priority in Switch

```
1. error + task     → SubagentActivityCard with errorText
2. error (generic)  → Card variant="error" (existing)
3. bash             → BasicTool console (existing)
4. edit/write       → BasicTool code-lines (existing)
5. task             → SubagentActivityCard (new)
6. catch-all        → BasicTool mcp (existing)
```

## Prompt Change: Sequential Delegation

### SYSTEM.md §2.3 (Modified)

```diff
 ### 2.3 Dispatch Rules
-- Launch multiple subagents in parallel when tasks have no dependencies.
+- **Sequential execution**: Dispatch ONE subagent at a time. Wait for it to complete before dispatching the next.
+- Never launch multiple `task()` calls in parallel — the system does not support concurrent subagents efficiently.
 - Give each subagent a self-contained prompt: ...
```

### Rationale

1. 並行 3 subagents 導致 worker pool 飽和（WORKER_POOL_MAX = 3）
2. 所有 3 個 subagent 全部 timeout（600s）
3. 使用者無法同時觀察多個 subagent 活動
4. Sequential 允許 orchestrator 根據前一個 subagent 的結果調整後續任務

## Limitations & Future Work

1. **Soft enforcement only**: Sequential delegation 依賴 prompt compliance，無 runtime 強制。若 LLM 仍嘗試並行 dispatch，系統不會阻擋。
2. **Polling interval**: 子 session 資料每 3 秒重新同步。Bridge events 雖然即時推送，但 `sync.session.sync()` 仍需 HTTP fetch 初始化。未來可改為純 event-driven（不需 polling）。
3. **Text truncation**: 子代理文字輸出截取最後 500/1000 字元。長輸出的中間部分不可見。
4. **No nested subagents**: 若子代理自身也 delegate task()，不會遞迴顯示孫代理活動。
