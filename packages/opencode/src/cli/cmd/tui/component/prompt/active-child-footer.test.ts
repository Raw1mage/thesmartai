import { describe, expect, test } from "bun:test"
import { deriveActiveChildFooter } from "./active-child-footer"

describe("deriveActiveChildFooter", () => {
  test("prefers narration text over running tool and seeded todo", () => {
    const result = deriveActiveChildFooter({
      activeChild: {
        sessionID: "child-1",
        parentMessageID: "parent-1",
        toolCallID: "tool-1",
        workerID: "worker-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: {
          id: "todo-1",
          content: "Seeded todo step",
          status: "pending",
        },
      },
      messages: [{ id: "msg-1", role: "assistant" } as never],
      partsByMessage: {
        "msg-1": [
          {
            type: "tool",
            state: {
              status: "running",
              input: { description: "Running tool step" },
            },
          } as never,
          { type: "text", text: "Narration step" } as never,
        ],
      },
    })

    expect(result.step).toBe("Narration step")
  })

  test("prefers running tool over reasoning when no narration text exists", () => {
    const result = deriveActiveChildFooter({
      activeChild: {
        sessionID: "child-1",
        parentMessageID: "parent-1",
        toolCallID: "tool-1",
        workerID: "worker-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: {
          id: "todo-1",
          content: "Seeded todo step",
          status: "pending",
        },
      },
      messages: [{ id: "msg-1", role: "assistant" } as never],
      partsByMessage: {
        "msg-1": [
          { type: "reasoning", text: "Reasoning step" } as never,
          {
            type: "tool",
            state: {
              status: "running",
              input: { description: "Running tool step" },
            },
          } as never,
        ],
      },
    })

    expect(result.step).toBe("Running tool step")
  })

  test("prefers reasoning over seeded todo when no narration or tool exists", () => {
    const result = deriveActiveChildFooter({
      activeChild: {
        sessionID: "child-1",
        parentMessageID: "parent-1",
        toolCallID: "tool-1",
        workerID: "worker-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: {
          id: "todo-1",
          content: "Seeded todo step",
          status: "pending",
        },
      },
      messages: [{ id: "msg-1", role: "assistant" } as never],
      partsByMessage: {
        "msg-1": [{ type: "reasoning", text: "Reasoning step" } as never],
      },
    })

    expect(result.step).toBe("Reasoning step")
  })

  test("falls back to seeded todo when no live step exists", () => {
    const result = deriveActiveChildFooter({
      activeChild: {
        sessionID: "child-1",
        parentMessageID: "parent-1",
        toolCallID: "tool-1",
        workerID: "worker-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: {
          id: "todo-1",
          content: "Seeded todo step",
          status: "pending",
        },
      },
      messages: [],
      partsByMessage: {},
    })

    expect(result.step).toBe("Seeded todo step")
  })
})
