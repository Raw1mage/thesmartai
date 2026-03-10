import { beforeEach, describe, expect, it, mock } from "bun:test"

const state = {
  rateLimits: {} as Record<string, Record<string, { resetTime: number; reason: string; model?: string }>>,
  dailyRateLimitCounts: {} as Record<string, { count: number; lastReset: number }>,
}

describe("RateLimitTracker provider-level cooldowns", () => {
  beforeEach(() => {
    state.rateLimits = {}
    state.dailyRateLimitCounts = {}
    mock.restore()
    mock.module("./state", () => ({
      readUnifiedState: () => state,
      writeUnifiedState: (next: typeof state) => {
        state.rateLimits = structuredClone(next.rateLimits)
        state.dailyRateLimitCounts = structuredClone(next.dailyRateLimitCounts)
      },
    }))
  })

  it("treats provider-level cooldown as blocking every model in that provider", async () => {
    const { RateLimitTracker } = await import("./rate-limit-tracker")
    const tracker = new RateLimitTracker()

    tracker.markRateLimited("acct-1", "github-copilot", "QUOTA_EXHAUSTED", 18_000_000)

    expect(tracker.isRateLimited("acct-1", "github-copilot", "gpt-4o")).toBe(true)
    expect(tracker.getWaitTime("acct-1", "github-copilot", "gpt-4o")).toBeGreaterThan(0)
  })
})
