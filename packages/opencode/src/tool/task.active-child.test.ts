import { beforeEach, describe, expect, it } from "bun:test"
import { SessionActiveChild, terminateActiveChild } from "./task"

describe("terminateActiveChild", () => {
  beforeEach(async () => {
    await SessionActiveChild.set("session_parent", null)
    await SessionActiveChild.set("session_parent_handoff", null)
  })

  it("clears stale running active child when worker is missing", async () => {
    await SessionActiveChild.set("session_parent", {
      sessionID: "session_child",
      parentMessageID: "message_parent",
      toolCallID: "tool_call_1",
      workerID: "missing_worker",
      title: "Subagent",
      agent: "coding",
      status: "running",
      dispatchedAt: Date.now(),
    })

    const result = await terminateActiveChild("session_parent")

    expect(result).toBe(true)
    expect(SessionActiveChild.get("session_parent")).toBeUndefined()
  })

  it("clears stale handoff active child immediately", async () => {
    await SessionActiveChild.set("session_parent_handoff", {
      sessionID: "session_child_handoff",
      parentMessageID: "message_parent_handoff",
      toolCallID: "tool_call_2",
      workerID: "handoff",
      title: "Subagent",
      agent: "coding",
      status: "handoff",
      dispatchedAt: Date.now(),
    })

    const result = await terminateActiveChild("session_parent_handoff")

    expect(result).toBe(true)
    expect(SessionActiveChild.get("session_parent_handoff")).toBeUndefined()
  })
})
