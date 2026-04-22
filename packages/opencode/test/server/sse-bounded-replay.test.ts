import { describe, expect, test } from "bun:test"
import {
  buildHandshakeReplayPlan,
  clipReplayWindow,
  type SseBufferEntry,
} from "../../src/server/routes/global"

// R1.2 unit tests — pure window-clipping logic behind sseGetBoundedSince.
// Covers TV-R8-S1..S5 from specs/frontend-session-lazyload/test-vectors.json.

function entry(id: number, ageMs: number, now: number): SseBufferEntry {
  return { id, event: { id }, receivedAt: now - ageMs }
}

describe("clipReplayWindow (R8 bounded replay)", () => {
  const now = 1_000_000_000
  const maxEvents = 100
  const maxAgeMs = 60 * 1000

  test("TV-R8-S1 — window 内的 20 笔全送，不裁切", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 101; i <= 120; i++) raw.push(entry(i, 1000, now))
    const res = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    expect(res.events).not.toBeNull()
    expect(res.events!.length).toBe(20)
    expect(res.droppedCount).toBe(0)
    expect(res.droppedBoundary).toBeNull()
  })

  test("TV-R8-S2 — 超过 max_events 裁到 tail 100", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 101; i <= 600; i++) raw.push(entry(i, 1000, now))
    const res = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    expect(res.events).not.toBeNull()
    expect(res.events!.length).toBe(100)
    expect(res.events![0].id).toBe(501)
    expect(res.events![99].id).toBe(600)
    expect(res.droppedCount).toBe(400)
    expect(res.droppedBoundary).toBe("count")
  })

  test("TV-R8-S3 — 超过 max_age_sec 丢掉旧的", () => {
    const raw: SseBufferEntry[] = [
      entry(101, 120_000, now),
      entry(102, 119_000, now),
      entry(128, 59_000, now),
      entry(129, 20_000, now),
      entry(130, 5_000, now),
    ]
    const res = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    expect(res.events).not.toBeNull()
    expect(res.events!.map((e) => e.id)).toEqual([128, 129, 130])
    expect(res.droppedCount).toBe(2)
    expect(res.droppedBoundary).toBe("age")
  })

  test("TV-R8-S4 — raw=null 代表 buffer 已 shift 過 lastId", () => {
    const res = clipReplayWindow(null, maxEvents, maxAgeMs, now)
    expect(res.events).toBeNull()
    expect(res.droppedCount).toBe(-1)
    expect(res.droppedBoundary).toBe("count")
  })

  test("TV-R8-S5 — 任何情况 events.length ≤ maxEvents", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 1; i <= 10000; i++) raw.push(entry(i, 1000, now))
    const res = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    expect(res.events).not.toBeNull()
    expect(res.events!.length).toBeLessThanOrEqual(maxEvents)
    expect(res.droppedCount).toBe(10000 - maxEvents)
    expect(res.droppedBoundary).toBe("count")
  })

  test("空输入 → 回空、无 boundary", () => {
    const res = clipReplayWindow([], maxEvents, maxAgeMs, now)
    expect(res.events).toEqual([])
    expect(res.droppedCount).toBe(0)
    expect(res.droppedBoundary).toBeNull()
  })

  test("count 与 age 同时命中 → boundary=count (count 更严格)", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 1; i <= 30; i++) raw.push(entry(i, 120_000, now)) // too old
    for (let i = 31; i <= 200; i++) raw.push(entry(i, 1000, now)) // fresh
    const res = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    expect(res.events!.length).toBe(100)
    expect(res.events![0].id).toBe(101)
    expect(res.droppedCount).toBe(100)
    expect(res.droppedBoundary).toBe("count")
  })
})

// R1.6 — handshake plan invariant: for ANY input, total writeSSE calls
// (sync.required prefix + events) is bounded by maxEvents + 1. This is the
// INV-8 guarantee the daemon event-loop depends on.

describe("buildHandshakeReplayPlan (R1.6 INV-8 bound)", () => {
  const now = 1_000_000_000
  const maxEvents = 100
  const maxAgeMs = 60 * 1000

  function planWriteSseCount(raw: SseBufferEntry[] | null) {
    const clipped = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    const plan = buildHandshakeReplayPlan(clipped)
    return plan.eventsToSend.length + (plan.prefixSyncRequired ? 1 : 0)
  }

  test("buffer=10000 reconnect → writeSSE count ≤ maxEvents+1", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 1; i <= 10000; i++) raw.push(entry(i, 1000, now))
    expect(planWriteSseCount(raw)).toBeLessThanOrEqual(maxEvents + 1)
  })

  test("buffer=1000 reconnect → writeSSE count ≤ maxEvents+1", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 1; i <= 1000; i++) raw.push(entry(i, 1000, now))
    const count = planWriteSseCount(raw)
    expect(count).toBeLessThanOrEqual(maxEvents + 1)
    expect(count).toBe(maxEvents + 1) // 100 events + 1 sync.required
  })

  test("buffer-overflow (null) → only sync.required, 1 writeSSE", () => {
    expect(planWriteSseCount(null)).toBe(1)
  })

  test("empty reconnect → 0 writeSSE, no sync.required", () => {
    expect(planWriteSseCount([])).toBe(0)
  })

  test("small reconnect within windows → no sync.required prefix", () => {
    const raw: SseBufferEntry[] = []
    for (let i = 1; i <= 50; i++) raw.push(entry(i, 1000, now))
    const clipped = clipReplayWindow(raw, maxEvents, maxAgeMs, now)
    const plan = buildHandshakeReplayPlan(clipped)
    expect(plan.prefixSyncRequired).toBe(false)
    expect(plan.eventsToSend.length).toBe(50)
  })

  test("随机 buffer 规模 → 从不突破 maxEvents+1 上限", () => {
    // Property-like check: 500 pseudo-random buffer sizes × age distributions.
    let rand = 1
    const lcg = () => {
      rand = (rand * 1103515245 + 12345) & 0x7fffffff
      return rand
    }
    for (let iter = 0; iter < 500; iter++) {
      const size = lcg() % 3000
      const raw: SseBufferEntry[] = []
      for (let i = 0; i < size; i++) {
        const age = (lcg() % 180_000) - 30_000 // -30s to +150s
        raw.push(entry(i, Math.max(0, age), now))
      }
      expect(planWriteSseCount(raw)).toBeLessThanOrEqual(maxEvents + 1)
    }
  })
})
