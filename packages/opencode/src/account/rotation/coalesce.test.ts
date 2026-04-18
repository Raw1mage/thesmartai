import { describe, test, expect, beforeEach, afterAll } from "bun:test"
import {
  withRotationCoalesce,
  __resetRotationCoalesceForTests,
  __setRotationCoalesceTimingForTests,
  getRotationCoalesceWindowMs,
  getRotationMinIntervalMs,
} from "./coalesce"

const TEST_COALESCE_MS = 100
const TEST_MIN_INTERVAL_MS = 200

const makeWork = (result: unknown, delayMs = 5, counter?: { n: number }) => async () => {
  if (counter) counter.n += 1
  await new Promise((r) => setTimeout(r, delayMs))
  return result
}

const originalWindow = getRotationCoalesceWindowMs()
const originalInterval = getRotationMinIntervalMs()

afterAll(() => {
  __setRotationCoalesceTimingForTests({
    coalesceWindowMs: originalWindow,
    minIntervalMs: originalInterval,
  })
})

describe("withRotationCoalesce", () => {
  beforeEach(() => {
    __resetRotationCoalesceForTests()
    __setRotationCoalesceTimingForTests({
      coalesceWindowMs: TEST_COALESCE_MS,
      minIntervalMs: TEST_MIN_INTERVAL_MS,
    })
  })

  test("concurrent eligible callers share a single work execution (single-flight)", async () => {
    const counter = { n: 0 }
    const work = makeWork({ kind: "Y" }, 30, counter)
    const coalesceKey = "codex:acc1:gpt-5.4"
    const providerId = "codex-sf"

    const [a, b, c] = await Promise.all([
      withRotationCoalesce({ coalesceKey, providerId, eligibleForCoalesce: true, work, shouldCache: () => true }),
      withRotationCoalesce({ coalesceKey, providerId, eligibleForCoalesce: true, work, shouldCache: () => true }),
      withRotationCoalesce({ coalesceKey, providerId, eligibleForCoalesce: true, work, shouldCache: () => true }),
    ])

    expect(a).toEqual({ kind: "Y" })
    expect(b).toEqual({ kind: "Y" })
    expect(c).toEqual({ kind: "Y" })
    expect(counter.n).toBe(1)
  })

  test("recent-decision cache reuses result within window", async () => {
    const counter = { n: 0 }
    const work = makeWork({ kind: "Y" }, 5, counter)
    const coalesceKey = "codex:acc1:gpt-5.4"
    const providerId = "codex-cache"

    const a = await withRotationCoalesce({
      coalesceKey,
      providerId,
      eligibleForCoalesce: true,
      work,
      shouldCache: () => true,
    })
    const b = await withRotationCoalesce({
      coalesceKey,
      providerId,
      eligibleForCoalesce: true,
      work,
      shouldCache: () => true,
    })

    expect(a).toEqual({ kind: "Y" })
    expect(b).toEqual({ kind: "Y" })
    expect(counter.n).toBe(1)
  })

  test("cache expires after window and re-runs work", async () => {
    const counter = { n: 0 }
    const work = makeWork({ kind: "Y" }, 5, counter)
    const coalesceKey = "codex:acc1:gpt-5.4"
    // Use different providerIds so min-interval doesn't block the second call
    await withRotationCoalesce({
      coalesceKey,
      providerId: "codex-expire-A",
      eligibleForCoalesce: true,
      work,
      shouldCache: () => true,
    })
    await new Promise((r) => setTimeout(r, TEST_COALESCE_MS + 30))
    await withRotationCoalesce({
      coalesceKey,
      providerId: "codex-expire-B",
      eligibleForCoalesce: true,
      work,
      shouldCache: () => true,
    })
    expect(counter.n).toBe(2)
  })

  test("cache does not fire for ineligible (retry) callers", async () => {
    const counter = { n: 0 }
    const work = makeWork({ kind: "Y" }, 5, counter)
    const coalesceKey = "codex:acc1:gpt-5.4"
    // Different providerIds so the min-interval doesn't swallow the second call
    await withRotationCoalesce({
      coalesceKey,
      providerId: "codex-retry-A",
      eligibleForCoalesce: true,
      work,
      shouldCache: () => true,
    })
    await withRotationCoalesce({
      coalesceKey,
      providerId: "codex-retry-B",
      eligibleForCoalesce: false,
      work,
      shouldCache: () => true,
    })
    expect(counter.n).toBe(2)
  })

  test("cache is not populated when shouldCache returns false", async () => {
    const counter = { n: 0 }
    const work = makeWork(null, 5, counter)
    const coalesceKey = "codex:acc1:gpt-5.4"

    const a = await withRotationCoalesce({
      coalesceKey,
      providerId: "codex-nocache-A",
      eligibleForCoalesce: true,
      work,
      shouldCache: (r) => r !== null,
    })
    const b = await withRotationCoalesce({
      coalesceKey,
      providerId: "codex-nocache-B",
      eligibleForCoalesce: true,
      work,
      shouldCache: (r) => r !== null,
    })

    expect(a).toBeNull()
    expect(b).toBeNull()
    expect(counter.n).toBe(2)
  })

  test("different coalesceKeys do not share", async () => {
    const counter = { n: 0 }
    await Promise.all([
      withRotationCoalesce({
        coalesceKey: "codex:accA:gpt-5.4",
        providerId: "codex-diff-A",
        eligibleForCoalesce: true,
        work: makeWork({ kind: "Y" }, 5, counter),
        shouldCache: () => true,
      }),
      withRotationCoalesce({
        coalesceKey: "codex:accB:gpt-5.4",
        providerId: "codex-diff-B",
        eligibleForCoalesce: true,
        work: makeWork({ kind: "Z" }, 5, counter),
        shouldCache: () => true,
      }),
    ])
    expect(counter.n).toBe(2)
  })

  test("min-interval guard waits between successive rotations on same provider", async () => {
    const providerId = "codex-guard"
    const work = makeWork({ kind: "Y" }, 5)

    const start = Date.now()
    await withRotationCoalesce({
      coalesceKey: "codex:accA:gpt-5.4",
      providerId,
      eligibleForCoalesce: false,
      work,
      shouldCache: () => true,
    })
    const firstDoneAt = Date.now()
    await withRotationCoalesce({
      coalesceKey: "codex:accB:gpt-5.4",
      providerId,
      eligibleForCoalesce: false,
      work,
      shouldCache: () => true,
    })
    const secondDoneAt = Date.now()

    // Second rotation must wait until min-interval has elapsed since first.
    // Allow ~15% tolerance for scheduling/timer drift.
    const gap = secondDoneAt - firstDoneAt
    expect(gap).toBeGreaterThanOrEqual(TEST_MIN_INTERVAL_MS * 0.85)
    expect(secondDoneAt - start).toBeGreaterThanOrEqual(TEST_MIN_INTERVAL_MS * 0.85)
  })

  test("min-interval guard does not block first rotation (clean state)", async () => {
    const start = Date.now()
    await withRotationCoalesce({
      coalesceKey: "codex:accA:gpt-5.4",
      providerId: "codex-first",
      eligibleForCoalesce: false,
      work: makeWork({ kind: "Y" }, 5),
      shouldCache: () => true,
    })
    expect(Date.now() - start).toBeLessThan(TEST_MIN_INTERVAL_MS / 2)
  })

  test("min-interval guard only applies within same provider, not across", async () => {
    const work = makeWork({ kind: "Y" }, 5)
    const start = Date.now()
    await withRotationCoalesce({
      coalesceKey: "codex:accA:gpt-5.4",
      providerId: "codex-iso-A",
      eligibleForCoalesce: false,
      work,
      shouldCache: () => true,
    })
    await withRotationCoalesce({
      coalesceKey: "gemini:accB:pro",
      providerId: "codex-iso-B",
      eligibleForCoalesce: false,
      work,
      shouldCache: () => true,
    })
    expect(Date.now() - start).toBeLessThan(TEST_MIN_INTERVAL_MS / 2)
  })

  test("failed result (shouldCache=false) does not arm min-interval guard", async () => {
    const providerId = "codex-failed-nomin"
    const start = Date.now()
    await withRotationCoalesce({
      coalesceKey: "codex:accA:gpt-5.4",
      providerId,
      eligibleForCoalesce: false,
      work: makeWork(null, 5),
      shouldCache: (r) => r !== null,
    })
    await withRotationCoalesce({
      coalesceKey: "codex:accB:gpt-5.4",
      providerId,
      eligibleForCoalesce: false,
      work: makeWork({ kind: "Y" }, 5),
      shouldCache: (r) => r !== null,
    })
    // First call returned null → guard NOT armed → second call doesn't wait
    expect(Date.now() - start).toBeLessThan(TEST_MIN_INTERVAL_MS / 2)
  })
})
