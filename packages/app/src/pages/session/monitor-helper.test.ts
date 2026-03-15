import { describe, expect, test } from "bun:test"
import { buildMonitorEntries, buildRunnerDisplayCard, monitorDisplayCard } from "./monitor-helper"

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
            state: {
              status: "completed",
              output: "done",
              title: "report ready",
              time: { start: 1, end: 2 },
            },
          } as any,
          {
            id: "part_note",
            sessionID: "session_1",
            messageID: "m1",
            type: "text",
            text: "Subagent completed: report ready",
            synthetic: true,
            metadata: {
              autonomousNarration: true,
              taskNarration: true,
              toolCallId: "call_1",
            },
          } as any,
        ],
      },
    })

    expect(entries).toMatchObject([
      {
        todo: {
          id: "todo_1",
          content: "Audit API edge cases",
          status: "in_progress",
        },
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

  test("builds runner card summary and falls back to idle when inactive", () => {
    expect(
      buildRunnerDisplayCard({
        currentStep: { content: "wait for subagent result" },
        methodChips: [{ label: "wait", tone: "info" }],
        processLines: ["Workflow: Waiting", "Stop: Wait subagent"],
        status: { type: "busy" },
        autonomousHealth: {
          summary: { label: "Degraded: workflow.unreconciled_wait_subagent" },
          queue: { hasPendingContinuation: true, reason: "todo_in_progress", roundCount: 2 },
        },
        monitorEntries: [
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
            activeToolStatus: "running",
            updated: 1,
            todo: { content: "Audit API edge cases", status: "in_progress" },
          } as any,
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
              state: {
                status: "running",
                input: {
                  description: "Audit API edge cases",
                  subagent_type: "coding",
                  mcpName: "system-manager",
                },
                time: { start: 1 },
              },
            } as any,
          ],
        },
      }),
    ).toEqual({
      badge: "R",
      title: "Runner",
      headline: "wait for subagent result",
      chips: [{ label: "wait", tone: "info" }],
      lines: ["Workflow: Waiting", "Stop: Wait subagent", "Tools: task", "Delegated: coding", "MCP: system-manager"],
      tools: ["task"],
      subagents: ["coding"],
      mcpServers: ["system-manager"],
    })

    expect(buildRunnerDisplayCard({ status: { type: "idle" } })).toEqual({
      badge: "R",
      title: "Runner",
      headline: "Idle",
      chips: [],
      lines: ["Runtime: idle"],
      tools: [],
      subagents: [],
      mcpServers: [],
    })
  })
})
