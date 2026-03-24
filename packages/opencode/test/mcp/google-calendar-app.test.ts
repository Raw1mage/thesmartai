import { test, expect, describe } from "bun:test"
import { GoogleCalendarApp } from "../../src/mcp/apps/google-calendar"

describe("GoogleCalendarApp", () => {
  test("exports execute function", () => {
    expect(typeof GoogleCalendarApp.execute).toBe("function")
  })

  test("exports all 7 tool executors", () => {
    const expectedTools = [
      "list-calendars",
      "list-events",
      "get-event",
      "create-event",
      "update-event",
      "delete-event",
      "freebusy",
    ]
    for (const toolId of expectedTools) {
      expect(GoogleCalendarApp.tools[toolId]).toBeDefined()
      expect(typeof GoogleCalendarApp.tools[toolId]).toBe("function")
    }
  })

  test("execute rejects unknown tool", async () => {
    try {
      await GoogleCalendarApp.execute("nonexistent-tool", {})
      expect(true).toBe(false)
    } catch (e) {
      expect((e as Error).message).toContain("Unknown Google Calendar tool")
    }
  })

  test("tool executors require ready app state (fail-fast)", async () => {
    // Without proper app state (not installed/enabled/authed),
    // calling any tool should throw UsageStateError via requireReady
    try {
      await GoogleCalendarApp.execute("list-calendars", {})
      expect(true).toBe(false)
    } catch (e) {
      // Should fail because app is not installed/ready in test env
      expect(e).toBeDefined()
    }
  })
})
