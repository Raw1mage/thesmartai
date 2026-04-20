import { describe, expect, test } from "bun:test"
import { classifyFidelity, createRateLimitedWarn } from "./freshness"

const T = 1_745_000_000_000
const STANDARD = { softSec: 15, hardSec: 60 }

describe("classifyFidelity — R2 threshold behavior (flag=1)", () => {
  test("R2.S1: fresh when delta < soft", () => {
    expect(classifyFidelity(T, T + 5_000, STANDARD, true)).toBe("fresh")
  })

  test("R2.S2: stale when soft <= delta < hard", () => {
    expect(classifyFidelity(T, T + 20_000, STANDARD, true)).toBe("stale")
  })

  test("R2.S3: hard-stale when delta >= hard", () => {
    expect(classifyFidelity(T, T + 75_000, STANDARD, true)).toBe("hard-stale")
  })

  test("boundary: delta exactly at soft -> stale", () => {
    expect(classifyFidelity(T, T + 15_000, STANDARD, true)).toBe("stale")
  })

  test("boundary: delta exactly at hard -> hard-stale", () => {
    expect(classifyFidelity(T, T + 60_000, STANDARD, true)).toBe("hard-stale")
  })
})

describe("classifyFidelity — R5 invalid receivedAt (DD-4 no silent fresh)", () => {
  test("R5.S1: undefined -> hard-stale", () => {
    expect(classifyFidelity(undefined, T, STANDARD, true)).toBe("hard-stale")
  })

  test("null -> hard-stale", () => {
    expect(classifyFidelity(null, T, STANDARD, true)).toBe("hard-stale")
  })

  test("R5.S2: NaN -> hard-stale", () => {
    expect(classifyFidelity(Number.NaN, T, STANDARD, true)).toBe("hard-stale")
  })

  test("Infinity -> hard-stale", () => {
    expect(classifyFidelity(Number.POSITIVE_INFINITY, T, STANDARD, true)).toBe("hard-stale")
  })

  test("0 (instant-stale sentinel) -> hard-stale", () => {
    expect(classifyFidelity(0, T, STANDARD, true)).toBe("hard-stale")
  })

  test("negative -> hard-stale", () => {
    expect(classifyFidelity(-1, T, STANDARD, true)).toBe("hard-stale")
  })

  test("invalid receivedAt triggers onInvalid callback with raw value", () => {
    let seen: unknown = "__none__"
    classifyFidelity(Number.NaN, T, STANDARD, true, {
      onInvalid: (v) => {
        seen = v
      },
    })
    expect(Number.isNaN(seen as number)).toBe(true)
  })

  test("valid receivedAt does NOT trigger onInvalid", () => {
    let called = false
    classifyFidelity(T, T + 5_000, STANDARD, true, {
      onInvalid: () => {
        called = true
      },
    })
    expect(called).toBe(false)
  })
})

describe("classifyFidelity — R6 flag=0 bypass (DD-5)", () => {
  test("R6.S1: flag=0 always returns fresh even when receivedAt is hard-stale", () => {
    expect(classifyFidelity(T, T + 9999_000, STANDARD, false)).toBe("fresh")
  })

  test("R6.S1: flag=0 returns fresh even for invalid receivedAt", () => {
    expect(classifyFidelity(undefined, T, STANDARD, false)).toBe("fresh")
  })

  test("R6.S2: flag=1 restores normal classification", () => {
    expect(classifyFidelity(T, T + 9999_000, STANDARD, true)).toBe("hard-stale")
  })
})

describe("createRateLimitedWarn", () => {
  test("first call warns; subsequent calls within window suppressed", () => {
    const calls: Array<[string, unknown]> = []
    const warn = createRateLimitedWarn((msg, detail) => calls.push([msg, detail]), 60_000)
    warn("entry-1", Number.NaN)
    warn("entry-1", Number.NaN)
    warn("entry-1", Number.NaN)
    expect(calls.length).toBe(1)
  })

  test("different entry ids warn independently", () => {
    const calls: string[] = []
    const warn = createRateLimitedWarn((msg) => calls.push(msg), 60_000)
    warn("entry-1", Number.NaN)
    warn("entry-2", Number.NaN)
    expect(calls.length).toBe(2)
  })
})
