import { Log } from "../util/log"
import { Drain } from "./drain"
import { DEFAULT_CHANNEL_ID } from "../channel/types"

/**
 * Command lane queue with concurrency control (D.3.4-D.3.5, D.3.7).
 *
 * Each lane has its own FIFO queue, concurrency limit, and generation number.
 * Generation numbers are bumped on restart to invalidate stale task completions.
 *
 * Lanes are namespaced per channel using composite keys: `<channelId>:<lane>` (DD-15).
 * The default channel preserves backward-compatible behavior.
 *
 * IDEF0 reference: A3 (Allocate Per-Channel Lane Resources), A41-A44
 * GRAFCET reference: opencode_a3_grafcet.json (lane allocation state machine)
 * Design decisions: DD-12 (lane concurrency defaults), DD-15 (channel:lane composite key)
 * Benchmark: refs/openclaw/src/process/command-queue.ts
 */
export namespace Lanes {
  const log = Log.create({ service: "daemon.lanes" })

  // DD-12: Lane concurrency defaults
  export enum CommandLane {
    Main = "main",
    Cron = "cron",
    Subagent = "subagent",
    Nested = "nested",
  }

  const DEFAULT_CONCURRENCY: Record<CommandLane, number> = {
    [CommandLane.Main]: 1,
    [CommandLane.Cron]: 1,
    [CommandLane.Subagent]: 2,
    [CommandLane.Nested]: 1,
  }

  /**
   * Build composite lane key: `<channelId>:<lane>` (DD-15).
   */
  export function buildLaneKey(channelId: string, lane: CommandLane): string {
    return `${channelId}:${lane}`
  }

  /**
   * Parse composite lane key back to channelId and lane.
   */
  export function parseLaneKey(key: string): { channelId: string; lane: CommandLane } | undefined {
    const idx = key.lastIndexOf(":")
    if (idx === -1) return undefined
    const channelId = key.slice(0, idx)
    const lane = key.slice(idx + 1) as CommandLane
    if (!Object.values(CommandLane).includes(lane)) return undefined
    return { channelId, lane }
  }

  type QueueEntry<T = unknown> = {
    id: number
    task: () => Promise<T>
    resolve: (value: T) => void
    reject: (error: Error) => void
    generation: number
  }

  type LaneState = {
    queue: QueueEntry[]
    activeTaskIds: Set<number>
    maxConcurrent: number
    generation: number
    draining: boolean // per-lane pump guard
  }

  let taskIdCounter = 0
  const lanes = new Map<string, LaneState>()

  export type ChannelLaneConfig = {
    channelId: string
    concurrency?: Partial<Record<CommandLane, number>>
  }

  /**
   * Initialize lanes for the default channel (D.3.4, GRAFCET step S0).
   * Backward-compatible: creates `default:<lane>` entries.
   */
  export function register(overrides?: Partial<Record<CommandLane, number>>): void {
    registerChannel({ channelId: DEFAULT_CHANNEL_ID, concurrency: overrides })
  }

  /**
   * Register lanes for a specific channel with its own concurrency policy.
   * Each channel gets isolated lane queues (DD-15).
   */
  export function registerChannel(config: ChannelLaneConfig): void {
    for (const lane of Object.values(CommandLane)) {
      const key = buildLaneKey(config.channelId, lane)
      const maxConcurrent = config.concurrency?.[lane] ?? DEFAULT_CONCURRENCY[lane]
      lanes.set(key, {
        queue: [],
        activeTaskIds: new Set(),
        maxConcurrent,
        generation: 0,
        draining: false,
      })
    }
    log.info("channel lanes registered", {
      channelId: config.channelId,
      lanes: Object.fromEntries(
        [...lanes.entries()]
          .filter(([k]) => k.startsWith(config.channelId + ":"))
          .map(([k, v]) => [k, v.maxConcurrent]),
      ),
    })
  }

  /**
   * Unregister all lanes for a specific channel.
   */
  export function unregisterChannel(channelId: string): void {
    for (const lane of Object.values(CommandLane)) {
      const key = buildLaneKey(channelId, lane)
      const laneState = lanes.get(key)
      if (laneState) {
        for (const entry of laneState.queue) {
          entry.reject(new CommandLaneClearedError())
        }
        lanes.delete(key)
      }
    }
    log.info("channel lanes unregistered", { channelId })
  }

  /**
   * Enqueue a task in a lane (D.3.4, GRAFCET steps S1-S2).
   * Rejects with GatewayDrainingError if daemon is draining.
   * Defaults to the default channel if channelId is not specified.
   */
  export function enqueue<T>(
    lane: CommandLane,
    task: () => Promise<T>,
    channelId: string = DEFAULT_CHANNEL_ID,
  ): Promise<T> {
    if (Drain.isDraining()) {
      return Promise.reject(new GatewayDrainingError())
    }

    const key = buildLaneKey(channelId, lane)
    const laneState = getLane(key)
    const id = ++taskIdCounter
    const generation = laneState.generation

    return new Promise<T>((resolve, reject) => {
      laneState.queue.push({ id, task: task as () => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject, generation })
      pump(key)
    })
  }

  /**
   * Pump the lane: execute queued tasks up to maxConcurrent (D.3.5, GRAFCET step S4).
   */
  function pump(laneKey: string): void {
    const laneState = getLane(laneKey)
    if (laneState.draining) return

    while (
      laneState.queue.length > 0 &&
      laneState.activeTaskIds.size < laneState.maxConcurrent
    ) {
      const entry = laneState.queue.shift()!
      laneState.activeTaskIds.add(entry.id)

      void executeEntry(laneKey, laneState, entry)
    }
  }

  async function executeEntry<T>(
    laneKey: string,
    laneState: LaneState,
    entry: QueueEntry<T>,
  ): Promise<void> {
    try {
      const result = await (entry.task as () => Promise<T>)()

      // Validate generation before resolving (D.3.7, GRAFCET step S6)
      if (entry.generation !== laneState.generation) {
        log.warn("stale task completion — generation mismatch", {
          lane: laneKey,
          taskId: entry.id,
          taskGen: entry.generation,
          currentGen: laneState.generation,
        })
        entry.reject(new CommandLaneClearedError())
        return
      }

      entry.resolve(result)
    } catch (e) {
      entry.reject(e instanceof Error ? e : new Error(String(e)))
    } finally {
      laneState.activeTaskIds.delete(entry.id)
      pump(laneKey)
    }
  }

  /**
   * Reset all lanes — bump generation, clear active sets, reject queued entries (D.3.8).
   * Called post-restart to invalidate stale tasks.
   *
   * IDEF0 reference: A44 (Reset Lane State Post Restart)
   * GRAFCET reference: opencode_a4_grafcet.json step S7
   */
  export function resetAll(): void {
    for (const [lane, laneState] of lanes.entries()) {
      laneState.generation++

      // Reject all queued entries
      for (const entry of laneState.queue) {
        entry.reject(new CommandLaneClearedError())
      }
      laneState.queue = []
      laneState.activeTaskIds.clear()
      laneState.draining = false

      log.info("lane reset", { lane, generation: laneState.generation })
    }
  }

  /**
   * Get total active task count across all lanes.
   */
  export function totalActiveTasks(): number {
    let total = 0
    for (const laneState of lanes.values()) {
      total += laneState.activeTaskIds.size
    }
    return total
  }

  /**
   * Get queue size for a specific lane (defaults to default channel).
   */
  export function queueSize(lane: CommandLane, channelId: string = DEFAULT_CHANNEL_ID): number {
    const key = buildLaneKey(channelId, lane)
    const laneState = lanes.get(key)
    if (!laneState) return 0
    return laneState.queue.length + laneState.activeTaskIds.size
  }

  /**
   * Get active task count for a specific channel.
   */
  export function channelActiveTasks(channelId: string): number {
    let total = 0
    const prefix = channelId + ":"
    for (const [key, laneState] of lanes.entries()) {
      if (key.startsWith(prefix)) {
        total += laneState.activeTaskIds.size
      }
    }
    return total
  }

  /**
   * Check if all lanes have no active tasks.
   */
  export function isIdle(): boolean {
    return totalActiveTasks() === 0
  }

  /**
   * Check if a specific channel has no active tasks.
   */
  export function isChannelIdle(channelId: string): boolean {
    return channelActiveTasks(channelId) === 0
  }

  /**
   * Get lane info for monitoring (D.3.8).
   */
  export function info(): Record<string, { queued: number; active: number; maxConcurrent: number; generation: number }> {
    const result: Record<string, any> = {}
    for (const [lane, laneState] of lanes.entries()) {
      result[lane] = {
        queued: laneState.queue.length,
        active: laneState.activeTaskIds.size,
        maxConcurrent: laneState.maxConcurrent,
        generation: laneState.generation,
      }
    }
    return result
  }

  function getLane(laneKey: string): LaneState {
    let laneState = lanes.get(laneKey)
    if (!laneState) {
      // Auto-register with defaults if not yet registered
      const parsed = parseLaneKey(laneKey)
      const maxConcurrent = parsed ? (DEFAULT_CONCURRENCY[parsed.lane] ?? 1) : 1
      laneState = {
        queue: [],
        activeTaskIds: new Set(),
        maxConcurrent,
        generation: 0,
        draining: false,
      }
      lanes.set(laneKey, laneState)
    }
    return laneState
  }

  // --- Error types ---

  export class GatewayDrainingError extends Error {
    constructor() {
      super("Gateway is draining — new enqueues rejected")
      this.name = "GatewayDrainingError"
    }
  }

  export class CommandLaneClearedError extends Error {
    constructor() {
      super("Command lane cleared — task invalidated by restart")
      this.name = "CommandLaneClearedError"
    }
  }
}
