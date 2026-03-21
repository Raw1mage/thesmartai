import { describe, expect, test } from "bun:test"
import { buildMonitorEntries, buildSessionTelemetryProjection, monitorDisplayCard } from "./monitor-helper"

describe("buildMonitorEntries", () => {
  test("links task monitor entries back to todo step metadata and latest result", () => {
    const entries = buildMonitorEntries({
      raw: [
        {
          id: "tool:session_1:part_1",
          level: "tool",
          sessionID: "session_1",
          title: "API audit",
          status: { type: "working" },
          agent: "coding",
          model: { providerId: "openai", modelID: "gpt-5" },
          requests: 1,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          totalTokens: 0,
          activeTool: "task",
          activeToolStatus: "completed",
          updated: 1,
        },
      ],
      messages: [
        {
          id: "m1",
          sessionID: "session_1",
          role: "assistant",
          parentID: "u1",
          modelID: "gpt-5",
          providerId: "openai",
          mode: "default",
          agent: "coding",
          path: { cwd: "/tmp", root: "/tmp" },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: 1 },
        } as any,
      ],
      partsByMessage: {
        m1: [
          {
            id: "part_1",
            sessionID: "session_1",
            messageID: "m1",
            type: "tool",
            callID: "call_1",
            tool: "task",
            metadata: {
              todo: {
                id: "todo_1",
                content: "Audit API edge cases",
                status: "in_progress",
                action: { kind: "delegate", canDelegate: true },
              },
            },
            state: { status: "completed", output: "done", title: "report ready", time: { start: 1, end: 2 } },
          } as any,
          {
            id: "part_note",
            sessionID: "session_1",
            messageID: "m1",
            type: "text",
            text: "Subagent completed: report ready",
            synthetic: true,
            metadata: { autonomousNarration: true, taskNarration: true, toolCallId: "call_1" },
          } as any,
        ],
      },
    })

    expect(entries).toMatchObject([
      {
        todo: { id: "todo_1", content: "Audit API edge cases", status: "in_progress" },
        latestResult: "report ready",
        latestNarration: "Subagent completed: report ready",
      },
    ])
    expect(monitorDisplayCard(entries[0] as any)).toEqual({
      badge: "T",
      title: "task",
      headline: "Audit API edge cases",
    })
  })

  test("builds round/session telemetry from existing projection inputs", () => {
    const telemetry = buildSessionTelemetryProjection({
      session: {
        id: "session_1",
        slug: "session-1",
        projectID: "project_1",
        directory: "/tmp",
        title: "Telemetry",
        version: "1",
        time: { created: 1_000, updated: 7_000 },
        stats: {
          requestsTotal: 3,
          totalTokens: 900,
          tokens: { input: 300, output: 500, reasoning: 50, cache: { read: 25, write: 25 } },
          lastUpdated: 7_000,
        },
        execution: {
          providerId: "anthropic",
          modelID: "claude-3.7",
          accountId: "acct-1",
          revision: 2,
          updatedAt: 7_000,
        },
      } as any,
      status: { type: "busy" } as any,
      monitorEntries: [
        {
          id: "agent:session_1:coding",
          level: "agent",
          sessionID: "session_1",
          title: "Telemetry",
          status: { type: "working" },
          agent: "coding",
          model: { providerId: "anthropic", modelID: "claude-3.7" },
          requests: 3,
          tokens: { input: 300, output: 500, reasoning: 50, cache: { read: 25, write: 25 } },
          totalTokens: 900,
          updated: 7_000,
          telemetry: {
            roundIndex: 3,
            requestId: "u1",
            compactionResult: "completed",
            compactionDraftTokens: 180,
            compactionCount: 2,
          },
        } as any,
      ],
      messages: [
        {
          id: "m1",
          sessionID: "session_1",
          role: "assistant",
          parentID: "u1",
          modelID: "claude-3.7",
          providerId: "anthropic",
          accountId: "acct-1",
          mode: "default",
          agent: "coding",
          path: { cwd: "/tmp", root: "/tmp" },
          cost: 0,
          tokens: { input: 120, output: 240, reasoning: 30, cache: { read: 10, write: 5 }, total: 405 },
          time: { created: 4_000, completed: 5_000 },
        } as any,
      ],
      partsByMessage: { m1: [{ id: "comp_1", sessionID: "session_1", messageID: "m1", type: "compaction" } as any] },
    })

    expect(telemetry.roundPhase).toBe("ready")
    expect(telemetry.round).toMatchObject({
      sessionId: "session_1",
      roundIndex: 3,
      providerId: "anthropic",
      accountId: "acct-1",
      modelId: "claude-3.7",
      promptTokens: 120,
      responseTokens: 240,
      reasoningTokens: 30,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      totalTokens: 405,
      requestId: "u1",
      compacting: false,
      compactionResult: "completed",
      compactionDraftTokens: 180,
    })
    expect(telemetry.sessionSummary).toMatchObject({
      sessionId: "session_1",
      durationMs: 6000,
      cumulativeTokens: 0,
      totalRequests: 0,
      providerId: "anthropic",
      accountId: "acct-1",
      modelId: "claude-3.7",
      compacting: false,
      compactionCount: 0,
    })
  })
})
