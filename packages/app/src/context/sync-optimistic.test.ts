import { describe, expect, test } from "bun:test"
import type { Message, Part } from "@opencode-ai/sdk/v2/client"
import { applyOptimisticAdd, applyOptimisticRemove } from "./sync"
import { buildSessionTelemetryFromProjector } from "@/pages/session/monitor-helper"

const userMessage = (id: string, sessionID: string): Message => ({
  id,
  sessionID,
  role: "user",
  time: { created: 1 },
  agent: "assistant",
  model: { providerId: "openai", modelID: "gpt" },
})

const textPart = (id: string, sessionID: string, messageID: string): Part => ({
  id,
  sessionID,
  messageID,
  type: "text",
  text: id,
})

describe("sync optimistic reducers", () => {
  test("applyOptimisticAdd inserts message in sorted order and stores parts", () => {
    const sessionID = "ses_1"
    const draft = {
      message: { [sessionID]: [userMessage("msg_2", sessionID)] },
      part: {} as Record<string, Part[] | undefined>,
    }

    applyOptimisticAdd(draft, {
      sessionID,
      message: userMessage("msg_1", sessionID),
      parts: [textPart("prt_2", sessionID, "msg_1"), textPart("prt_1", sessionID, "msg_1")],
    })

    expect(draft.message[sessionID]?.map((x) => x.id)).toEqual(["msg_1", "msg_2"])
    expect(draft.part.msg_1?.map((x) => x.id)).toEqual(["prt_1", "prt_2"])
  })

  test("applyOptimisticRemove removes message and part entries", () => {
    const sessionID = "ses_1"
    const draft = {
      message: { [sessionID]: [userMessage("msg_1", sessionID), userMessage("msg_2", sessionID)] },
      part: {
        msg_1: [textPart("prt_1", sessionID, "msg_1")],
        msg_2: [textPart("prt_2", sessionID, "msg_2")],
      } as Record<string, Part[] | undefined>,
    }

    applyOptimisticRemove(draft, { sessionID, messageID: "msg_1" })

    expect(draft.message[sessionID]?.map((x) => x.id)).toEqual(["msg_2"])
    expect(draft.part.msg_1).toBeUndefined()
    expect(draft.part.msg_2).toHaveLength(1)
  })

  test("projector telemetry builder stays empty without projector payload", () => {
    const telemetry = buildSessionTelemetryFromProjector({
      session: {
        id: "ses_1",
        slug: "ses-1",
        projectID: "proj_1",
        directory: "/tmp",
        title: "Telemetry",
        version: "1",
        time: { created: 1, updated: 2 },
      } as any,
      status: { type: "busy" } as any,
      monitorEntries: [
        {
          id: "session:ses_1",
          level: "session",
          sessionID: "ses_1",
          title: "Telemetry",
          status: { type: "busy" },
          requests: 3,
          tokens: { input: 1, output: 2, reasoning: 0, cache: { read: 0, write: 0 } },
          totalTokens: 3,
          updated: 2,
        } as any,
      ],
    })

    expect(telemetry.phase).toBe("empty")
    expect(telemetry.prompt.blocks).toEqual([])
    expect(telemetry.sessionSummary.totalRequests).toBe(0)
  })
})
