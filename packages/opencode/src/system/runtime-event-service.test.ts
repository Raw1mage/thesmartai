import { describe, expect, it } from "bun:test"
import { Instance } from "../project/instance"
import { Session } from "../session"
import { RuntimeEventService } from "./runtime-event-service"
import { tmpdir } from "../../test/fixture/fixture"

describe("runtime event service", () => {
  it("persists structured session-scoped events and lists them in order", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "mission",
          eventType: "mission.contract.attached",
          payload: { contract: "implementation_spec" },
        })
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "warn",
          domain: "anomaly",
          eventType: "workflow.unreconciled_wait_subagent",
          todoID: "todo_1",
          anomalyFlags: ["unreconciled_wait_subagent"],
          payload: { activeSubtasks: 0 },
        })

        const events = await RuntimeEventService.list(session.id)
        expect(events).toHaveLength(2)
        expect(events[0]).toMatchObject({
          level: "info",
          domain: "mission",
          eventType: "mission.contract.attached",
          sessionID: session.id,
        })
        expect(events[1]).toMatchObject({
          level: "warn",
          domain: "anomaly",
          eventType: "workflow.unreconciled_wait_subagent",
          todoID: "todo_1",
          anomalyFlags: ["unreconciled_wait_subagent"],
        })
      },
    })
  })

  it("supports recent-event limits", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "runner",
          eventType: "runner.started",
          payload: { seq: 1 },
          ts: 1,
        })
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "runner",
          eventType: "runner.progress",
          payload: { seq: 2 },
          ts: 2,
        })
        await RuntimeEventService.append({
          sessionID: session.id,
          level: "info",
          domain: "runner",
          eventType: "runner.progress",
          payload: { seq: 3 },
          ts: 3,
        })

        const recent = await RuntimeEventService.list(session.id, { limit: 2 })
        expect(recent).toHaveLength(2)
        expect(recent[0]?.payload).toEqual({ seq: 2 })
        expect(recent[1]?.payload).toEqual({ seq: 3 })
      },
    })
  })
})
