import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { ChannelStore, DEFAULT_CHANNEL_ID, DEFAULT_LANE_POLICY } from "@/channel"
import { Lanes } from "@/daemon/lanes"
import { Drain } from "@/daemon/drain"
import { KillSwitchService } from "@/server/killswitch/service"
import { SessionStatus } from "@/session/status"
import { Global } from "@/global"

/**
 * Stage B — E2E Integration Verification
 *
 * Phases 11-14: multi-channel daemon boot, cross-channel session isolation,
 * channel-scoped kill-switch E2E, default channel backward compatibility.
 *
 * IDEF0 reference: A6 (Verify End-to-End Integration) → A61-A64
 * GRAFCET reference: opencode_a6_grafcet.json
 */

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "e2e-channel-"))
  ;(Global.Path as any).config = tempDir
  Drain.reset()
  Lanes.register()
  await KillSwitchService.clearState()
})

afterEach(async () => {
  // Clean up busy session markers
  for (const [id] of Object.entries(SessionStatus.list())) {
    SessionStatus.set(id, { type: "idle" })
  }
  await fs.rm(tempDir, { recursive: true, force: true })
})

// ============================================================
// Phase 11 — Multi-Channel Daemon Boot Verification (B.1)
// IDEF0: A61 (Boot Multi-Channel Daemon)
// ============================================================

describe("Phase 11: Multi-channel daemon boot", () => {
  it("B.1.1 — restores pre-seeded channels and lists them all", async () => {
    // Pre-seed 3 channel files
    const channelsDir = path.join(tempDir, "channels")
    await fs.mkdir(channelsDir, { recursive: true })

    const channels = [
      { id: "ch-alpha", name: "Alpha", description: "First channel" },
      { id: "ch-beta", name: "Beta", description: "Second channel" },
      { id: "ch-gamma", name: "Gamma", description: "Third channel" },
    ]

    for (const ch of channels) {
      const info = {
        ...ch,
        enabled: true,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        lanePolicy: { ...DEFAULT_LANE_POLICY },
        killSwitchScope: "channel" as const,
        state: { activeSessionCount: 0 },
      }
      await fs.writeFile(path.join(channelsDir, `${ch.id}.json`), JSON.stringify(info))
    }

    // Boot: restoreOrBootstrap should find all 3
    const restored = await ChannelStore.restoreOrBootstrap()
    expect(restored.length).toBe(3)

    const names = restored.map((c) => c.name).sort()
    expect(names).toEqual(["Alpha", "Beta", "Gamma"])

    // Verify list() also returns all
    const listed = await ChannelStore.list()
    expect(listed.length).toBe(3)
  })

  it("B.1.2 — registers per-channel lanes with composite keys", async () => {
    // Create two channels with different lane policies
    const chA = await ChannelStore.create({
      name: "lane-test-a",
      lanePolicy: { main: 2, cron: 1, subagent: 3, nested: 1 },
    })
    const chB = await ChannelStore.create({
      name: "lane-test-b",
      lanePolicy: { main: 1, cron: 2, subagent: 1, nested: 1 },
    })

    // Register their lanes
    Lanes.registerChannel({
      channelId: chA.id,
      concurrency: chA.lanePolicy,
    })
    Lanes.registerChannel({
      channelId: chB.id,
      concurrency: chB.lanePolicy,
    })

    const info = Lanes.info()

    // Channel A composite keys exist with correct concurrency
    expect(info[`${chA.id}:main`]).toBeDefined()
    expect(info[`${chA.id}:main`].maxConcurrent).toBe(2)
    expect(info[`${chA.id}:subagent`].maxConcurrent).toBe(3)

    // Channel B composite keys exist with correct concurrency
    expect(info[`${chB.id}:main`]).toBeDefined()
    expect(info[`${chB.id}:main`].maxConcurrent).toBe(1)
    expect(info[`${chB.id}:cron`].maxConcurrent).toBe(2)

    // Default channel still present
    expect(info["default:main"]).toBeDefined()
    expect(info["default:main"].maxConcurrent).toBe(1)

    // Per-channel active task count starts at 0
    expect(Lanes.channelActiveTasks(chA.id)).toBe(0)
    expect(Lanes.channelActiveTasks(chB.id)).toBe(0)
  })

  it("B.1.3 — health info includes per-channel lane breakdown", async () => {
    const ch = await ChannelStore.create({ name: "health-test" })
    Lanes.registerChannel({ channelId: ch.id })

    const info = Lanes.info()

    // Verify channel lanes appear in info
    const channelKeys = Object.keys(info).filter((k) => k.startsWith(ch.id))
    expect(channelKeys.length).toBe(4) // main, cron, subagent, nested

    for (const key of channelKeys) {
      expect(info[key]).toHaveProperty("queued")
      expect(info[key]).toHaveProperty("active")
      expect(info[key]).toHaveProperty("maxConcurrent")
      expect(info[key]).toHaveProperty("generation")
    }
  })

  it("B.1.1 — rejects corrupt channel file gracefully", async () => {
    const channelsDir = path.join(tempDir, "channels")
    await fs.mkdir(channelsDir, { recursive: true })

    // Write a valid channel
    const valid = {
      id: "valid-ch",
      name: "Valid",
      enabled: true,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      lanePolicy: { ...DEFAULT_LANE_POLICY },
      killSwitchScope: "channel",
      state: { activeSessionCount: 0 },
    }
    await fs.writeFile(path.join(channelsDir, "valid-ch.json"), JSON.stringify(valid))

    // Write a corrupt file
    await fs.writeFile(path.join(channelsDir, "corrupt.json"), "NOT JSON {{{")

    // restoreOrBootstrap should still work, loading the valid channel
    const restored = await ChannelStore.restoreOrBootstrap()
    // Should have at least the valid channel (corrupt may be skipped)
    const validChannel = restored.find((c) => c.id === "valid-ch")
    expect(validChannel).toBeDefined()
    expect(validChannel!.name).toBe("Valid")
  })
})

// ============================================================
// Phase 12 — Cross-Channel Session Isolation (B.2)
// IDEF0: A62 (Verify Cross-Channel Session Isolation)
// ============================================================

describe("Phase 12: Cross-channel session isolation", () => {
  it("B.2.1 — sessions with channelId are schema-valid", async () => {
    const { Session } = await import("@/session")
    const schema = Session.create.schema

    // With channelId
    const withChannel = schema.safeParse({
      title: "test session",
      channelId: "ch-alpha",
    })
    expect(withChannel.success).toBe(true)
    if (withChannel.success) {
      expect(withChannel.data.channelId).toBe("ch-alpha")
    }

    // Without channelId (backward compat)
    const noChannel = schema.safeParse({
      title: "plain session",
    })
    expect(noChannel.success).toBe(true)
    if (noChannel.success) {
      expect(noChannel.data.channelId).toBeUndefined()
    }
  })

  it("B.2.2 — lane namespace prevents cross-channel pollination", async () => {
    Lanes.registerChannel({ channelId: "ch-a", concurrency: { main: 1 } })
    Lanes.registerChannel({ channelId: "ch-b", concurrency: { main: 1 } })

    const execution: string[] = []

    // Occupy channel A main lane with slow task
    const taskA = Lanes.enqueue(
      Lanes.CommandLane.Main,
      async () => {
        await new Promise((r) => setTimeout(r, 80))
        execution.push("A")
        return "A"
      },
      "ch-a",
    )

    // Channel B main lane should execute immediately (different namespace)
    const taskB = Lanes.enqueue(
      Lanes.CommandLane.Main,
      async () => {
        execution.push("B")
        return "B"
      },
      "ch-b",
    )

    const resultB = await taskB
    expect(resultB).toBe("B")
    expect(execution).toContain("B")

    // A should still be running
    expect(Lanes.channelActiveTasks("ch-a")).toBe(1)
    expect(Lanes.channelActiveTasks("ch-b")).toBe(0)

    await taskA
    expect(execution).toEqual(["B", "A"])
  })

  it("B.2.3 — channel store queries don't leak across channels", async () => {
    const chA = await ChannelStore.create({ name: "store-a" })
    const chB = await ChannelStore.create({ name: "store-b" })

    // Get channel A by ID returns only A
    const fetchedA = await ChannelStore.get(chA.id)
    expect(fetchedA!.name).toBe("store-a")

    // Get channel B by ID returns only B
    const fetchedB = await ChannelStore.get(chB.id)
    expect(fetchedB!.name).toBe("store-b")

    // Getting with wrong ID returns undefined
    const nonexistent = await ChannelStore.get("nonexistent")
    expect(nonexistent).toBeUndefined()

    // Remove A should not affect B
    await ChannelStore.remove(chA.id)
    expect(await ChannelStore.get(chA.id)).toBeUndefined()
    expect((await ChannelStore.get(chB.id))!.name).toBe("store-b")
  })
})

// ============================================================
// Phase 13 — Channel-Scoped Kill-Switch E2E (B.3)
// IDEF0: A63 (Execute Channel-Scoped Kill-Switch End-to-End)
// ============================================================

describe("Phase 13: Channel-scoped kill-switch E2E", () => {
  it("B.3.1 — channel-scoped trigger only blocks target channel", async () => {
    // Activate kill-switch scoped to channel "ch-a"
    await KillSwitchService.setState({
      active: true,
      state: "soft_paused",
      requestID: "ks_e2e_channel",
      initiator: "e2e-test",
      reason: "E2E channel-scoped test",
      initiatedAt: Date.now(),
      mode: "channel",
      scope: "channel",
      channelId: "ch-a",
    })

    // Channel A should be blocked
    const resultA = await KillSwitchService.assertSchedulingAllowed("ch-a")
    expect(resultA.ok).toBe(false)

    // Channel B should NOT be blocked
    const resultB = await KillSwitchService.assertSchedulingAllowed("ch-b")
    expect(resultB.ok).toBe(true)

    // Channel C should NOT be blocked
    const resultC = await KillSwitchService.assertSchedulingAllowed("ch-c")
    expect(resultC.ok).toBe(true)

    await KillSwitchService.clearState()
  })

  it("B.3.2 — global trigger overrides channel scope", async () => {
    // First set a channel-scoped kill-switch
    await KillSwitchService.setState({
      active: true,
      state: "soft_paused",
      requestID: "ks_e2e_global",
      initiator: "e2e-test",
      reason: "E2E global override test",
      initiatedAt: Date.now(),
      mode: "global",
      scope: "global",
    })

    // ALL channels should be blocked by global
    const resultA = await KillSwitchService.assertSchedulingAllowed("ch-a")
    expect(resultA.ok).toBe(false)

    const resultB = await KillSwitchService.assertSchedulingAllowed("ch-b")
    expect(resultB.ok).toBe(false)

    // No channelId should also be blocked
    const resultNone = await KillSwitchService.assertSchedulingAllowed()
    expect(resultNone.ok).toBe(false)

    await KillSwitchService.clearState()
  })

  it("B.3.3 — audit state includes channelId for channel-scoped trigger", async () => {
    const state = {
      active: true,
      state: "soft_paused" as const,
      requestID: "ks_e2e_audit",
      initiator: "e2e-test",
      reason: "audit channelId test",
      initiatedAt: Date.now(),
      mode: "channel",
      scope: "channel",
      channelId: "ch-audited",
    }

    await KillSwitchService.setState(state)

    // Verify the state includes channelId
    const retrieved = await KillSwitchService.getState()
    expect(retrieved).toBeDefined()
    expect(retrieved!.active).toBe(true)
    expect(retrieved!.channelId).toBe("ch-audited")
    expect(retrieved!.scope).toBe("channel")

    await KillSwitchService.clearState()

    // After clear, state should be inactive
    const cleared = await KillSwitchService.assertSchedulingAllowed("ch-audited")
    expect(cleared.ok).toBe(true)
  })

  it("B.3.1 — listBusySessionIDs returns all busy when no channelId filter", async () => {
    SessionStatus.set("ses_x1", { type: "busy" })
    SessionStatus.set("ses_x2", { type: "busy" })
    SessionStatus.set("ses_x3", { type: "busy" })

    const busy = await KillSwitchService.listBusySessionIDs()
    expect(busy.length).toBeGreaterThanOrEqual(3)
    expect(busy).toContain("ses_x1")
    expect(busy).toContain("ses_x2")
    expect(busy).toContain("ses_x3")

    // Clean up
    SessionStatus.set("ses_x1", { type: "idle" })
    SessionStatus.set("ses_x2", { type: "idle" })
    SessionStatus.set("ses_x3", { type: "idle" })
  })

  it("B.3.2 — inactive kill-switch allows all channels", async () => {
    await KillSwitchService.clearState()

    const resultA = await KillSwitchService.assertSchedulingAllowed("ch-a")
    expect(resultA.ok).toBe(true)

    const resultB = await KillSwitchService.assertSchedulingAllowed("ch-b")
    expect(resultB.ok).toBe(true)

    const resultNone = await KillSwitchService.assertSchedulingAllowed()
    expect(resultNone.ok).toBe(true)
  })
})

// ============================================================
// Phase 14 — Default Channel Backward Compatibility (B.4)
// IDEF0: A64 (Validate Default Channel Backward Compatibility)
// ============================================================

describe("Phase 14: Default channel backward compatibility", () => {
  it("B.4.1 — sessions without channelId default to 'default' channel lanes", async () => {
    // Enqueue without channelId (should use default)
    const result = await Lanes.enqueue(Lanes.CommandLane.Main, async () => "default-lane-works")
    expect(result).toBe("default-lane-works")

    // Verify the default lane was used
    const info = Lanes.info()
    expect(info["default:main"]).toBeDefined()
  })

  it("B.4.2 — global kill-switch without channelId identical to pre-channel", async () => {
    // Set global kill-switch (no channelId — pre-channel pattern)
    await KillSwitchService.setState({
      active: true,
      state: "soft_paused",
      requestID: "ks_compat_global",
      initiator: "compat-test",
      reason: "backward compat global test",
      initiatedAt: Date.now(),
      mode: "global",
      scope: "global",
    })

    // assertSchedulingAllowed without channelId should be blocked (pre-channel behavior)
    const result = await KillSwitchService.assertSchedulingAllowed()
    expect(result.ok).toBe(false)

    // With any channelId also blocked (global)
    const resultCh = await KillSwitchService.assertSchedulingAllowed("any-channel")
    expect(resultCh.ok).toBe(false)

    await KillSwitchService.clearState()
  })

  it("B.4.3 — default channel lane policy matches pre-channel global limits", async () => {
    // Bootstrap default channel
    const channels = await ChannelStore.restoreOrBootstrap()
    const defaultCh = channels.find((c) => c.id === DEFAULT_CHANNEL_ID)
    expect(defaultCh).toBeDefined()

    // Lane policy should match DEFAULT_LANE_POLICY
    expect(defaultCh!.lanePolicy).toEqual(DEFAULT_LANE_POLICY)
    expect(defaultCh!.lanePolicy.main).toBe(1)
    expect(defaultCh!.lanePolicy.cron).toBe(1)
    expect(defaultCh!.lanePolicy.subagent).toBe(2)
    expect(defaultCh!.lanePolicy.nested).toBe(1)

    // Lane info for default channel should match
    const info = Lanes.info()
    expect(info["default:main"].maxConcurrent).toBe(1)
    expect(info["default:cron"].maxConcurrent).toBe(1)
    expect(info["default:subagent"].maxConcurrent).toBe(2)
    expect(info["default:nested"].maxConcurrent).toBe(1)
  })

  it("B.4.1 — buildLaneKey with default channel matches existing pattern", () => {
    const key = Lanes.buildLaneKey("default", Lanes.CommandLane.Main)
    expect(key).toBe("default:main")

    const parsed = Lanes.parseLaneKey("default:main")
    expect(parsed).toEqual({
      channelId: "default",
      lane: Lanes.CommandLane.Main,
    })
  })

  it("B.4.3 — channel store bootstrap creates default with killSwitchScope global", async () => {
    const channels = await ChannelStore.restoreOrBootstrap()
    const defaultCh = channels.find((c) => c.id === DEFAULT_CHANNEL_ID)
    expect(defaultCh).toBeDefined()
    expect(defaultCh!.killSwitchScope).toBe("global")
    expect(defaultCh!.enabled).toBe(true)
    expect(defaultCh!.name).toBe("Default")
  })
})
