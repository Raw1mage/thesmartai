import { describe, expect, test } from "bun:test"
import { deriveActiveChildStatus } from "./session-prompt-helpers"

describe("deriveActiveChildStatus", () => {
  test("prefers narration text over running tool and seeded todo", () => {
    const result = deriveActiveChildStatus({
      activeChild: {
        sessionID: "child-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: { content: "Seeded todo step" },
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
    const result = deriveActiveChildStatus({
      activeChild: {
        sessionID: "child-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: { content: "Seeded todo step" },
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
    const result = deriveActiveChildStatus({
      activeChild: {
        sessionID: "child-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: { content: "Seeded todo step" },
      },
      messages: [{ id: "msg-1", role: "assistant" } as never],
      partsByMessage: {
        "msg-1": [{ type: "reasoning", text: "Reasoning step" } as never],
      },
    })

    expect(result.step).toBe("Reasoning step")
  })

  test("falls back to seeded todo when no live step exists", () => {
    const result = deriveActiveChildStatus({
      activeChild: {
        sessionID: "child-1",
        title: "Worker",
        agent: "coding",
        status: "running",
        todo: { content: "Seeded todo step" },
      },
      messages: [],
      partsByMessage: {},
    })

    expect(result.step).toBe("Seeded todo step")
  })
})
