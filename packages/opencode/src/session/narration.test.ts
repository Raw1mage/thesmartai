import { describe, expect, it } from "bun:test"
import { describeTaskNarration, isNarrationAssistantMessage } from "./narration"

describe("session narration helpers", () => {
  it("formats task lifecycle narration text", () => {
    expect(describeTaskNarration({ phase: "start", description: "audit API edge cases", subagentType: "review" })).toBe(
      "Delegating to review: audit API edge cases",
    )

    expect(describeTaskNarration({ phase: "complete", title: "report ready" })).toBe("Subagent completed: report ready")

    expect(describeTaskNarration({ phase: "error", error: "timeout while waiting for worker" })).toBe(
      "Subagent blocked: timeout while waiting for worker",
    )
  })

  it("detects synthetic assistant narration messages", () => {
    expect(
      isNarrationAssistantMessage(
        { role: "assistant" } as any,
        [
          {
            type: "text",
            synthetic: true,
            metadata: { autonomousNarration: true, excludeFromModel: true },
          },
        ] as any,
      ),
    ).toBe(true)

    expect(
      isNarrationAssistantMessage(
        { role: "assistant" } as any,
        [{ type: "text", synthetic: true, metadata: { autonomousNarration: true } }] as any,
      ),
    ).toBe(false)
  })
})
