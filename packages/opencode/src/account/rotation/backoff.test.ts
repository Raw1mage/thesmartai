import { describe, expect, it } from "bun:test"

import { calculateBackoffMs } from "./backoff"

describe("rotation backoff guardrails", () => {
  it("gives quota exhausted vectors at least five hours of cooldown", () => {
    expect(calculateBackoffMs("QUOTA_EXHAUSTED", 0)).toBeGreaterThanOrEqual(18_000_000)
  })

  it("extends repeated same-day generic rate limits to five hours", () => {
    expect(calculateBackoffMs("RATE_LIMIT_EXCEEDED", 0, undefined, 2)).toBeGreaterThanOrEqual(18_000_000)
    expect(calculateBackoffMs("UNKNOWN", 0, undefined, 2)).toBeGreaterThanOrEqual(18_000_000)
  })
})
