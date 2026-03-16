import z from "zod"
import { Storage } from "@/storage/storage"
import { Identifier } from "@/id/id"
import type { Lane } from "./lane-policy"
import { LANES_BY_PRIORITY, laneHasCapacity, triggerPriorityToLane } from "./lane-policy"
import type { TriggerPriority } from "./trigger"

/**
 * QueueEntry — a run queue item wrapping the pending continuation data with lane metadata.
 *
 * Backward-compatible: contains all fields from PendingContinuationInfo
 * plus lane assignment and trigger origin.
 */
export const QueueEntry = z.object({
  id: z.string(),
  sessionID: Identifier.schema("session"),
  messageID: Identifier.schema("message"),
  createdAt: z.number(),
  roundCount: z.number(),
  reason: z.enum(["todo_pending", "todo_in_progress"]),
  text: z.string(),
  lane: z.enum(["critical", "normal", "background"]),
  triggerType: z.string(),
  enqueuedAt: z.number(),
})
export type QueueEntry = z.infer<typeof QueueEntry>

function queueKey(lane: Lane, sessionID: string) {
  return ["run_queue", lane, sessionID]
}

function legacyQueueKey(sessionID: string) {
  return ["session_workflow_queue", sessionID]
}

/**
 * RunQueue — lane-aware queue for autonomous run scheduling.
 *
 * Storage layout: ["run_queue", lane, sessionID] → QueueEntry
 * Each session can have at most one entry across all lanes.
 *
 * Also maintains backward-compatible legacy key for getPendingContinuation() callers.
 */
export namespace RunQueue {
  /**
   * Enqueue a run into the appropriate lane.
   * If the session already has an entry in any lane, it is replaced.
   */
  export async function enqueue(input: {
    sessionID: string
    messageID: string
    createdAt: number
    roundCount: number
    reason: "todo_pending" | "todo_in_progress"
    text: string
    triggerType: string
    priority: TriggerPriority
  }): Promise<QueueEntry> {
    const lane = triggerPriorityToLane(input.priority)
    const now = Date.now()

    // Remove any existing entry for this session (could be in a different lane)
    await remove(input.sessionID)

    const entry: QueueEntry = {
      id: `qe_${now.toString(36)}_${input.sessionID.slice(-6)}`,
      sessionID: input.sessionID,
      messageID: input.messageID,
      createdAt: input.createdAt,
      roundCount: input.roundCount,
      reason: input.reason,
      text: input.text,
      lane,
      triggerType: input.triggerType,
      enqueuedAt: now,
    }

    const validated = QueueEntry.parse(entry)
    await Storage.write(queueKey(lane, input.sessionID), validated)
    // Write legacy key for backward compat (getPendingContinuation callers)
    await Storage.write(legacyQueueKey(input.sessionID), {
      sessionID: input.sessionID,
      messageID: input.messageID,
      createdAt: input.createdAt,
      roundCount: input.roundCount,
      reason: input.reason,
      text: input.text,
    })

    return validated
  }

  /**
   * Remove a session's entry from the queue (all lanes + legacy key).
   */
  export async function remove(sessionID: string): Promise<void> {
    await Promise.all([
      ...LANES_BY_PRIORITY.map((lane) => Storage.remove(queueKey(lane, sessionID)).catch(() => undefined)),
      Storage.remove(legacyQueueKey(sessionID)).catch(() => undefined),
    ])
  }

  /**
   * Peek at a session's queue entry (checks all lanes).
   */
  export async function peek(sessionID: string): Promise<QueueEntry | undefined> {
    for (const lane of LANES_BY_PRIORITY) {
      const entry = await Storage.read<QueueEntry>(queueKey(lane, sessionID)).catch(() => undefined)
      if (entry) return entry
    }
    return undefined
  }

  /**
   * List all entries in a specific lane, sorted by createdAt.
   */
  export async function listLane(lane: Lane): Promise<QueueEntry[]> {
    const result: QueueEntry[] = []
    for (const key of await Storage.list(["run_queue", lane]).catch(() => [])) {
      const entry = await Storage.read<QueueEntry>(key).catch(() => undefined)
      if (entry) result.push(entry)
    }
    return result.sort((a, b) => a.createdAt - b.createdAt)
  }

  /**
   * List all entries across all lanes, grouped by lane priority.
   * Returns entries in drain order: critical first, then normal, then background.
   */
  export async function listAll(): Promise<QueueEntry[]> {
    const all: QueueEntry[] = []
    for (const lane of LANES_BY_PRIORITY) {
      const entries = await listLane(lane)
      all.push(...entries)
    }
    return all
  }

  /**
   * Drain: select entries to resume, respecting lane concurrency caps.
   *
   * @param maxCount - total entries to return
   * @param inFlightByLane - current in-flight counts per lane
   * @param preferredSessionID - optional preferred session to prioritize
   * @returns entries eligible for resume, in priority order
   */
  export async function drain(input: {
    maxCount: number
    inFlightByLane: Record<Lane, number>
    preferredSessionID?: string
  }): Promise<QueueEntry[]> {
    const picked: QueueEntry[] = []
    const maxCount = Math.max(0, input.maxCount)

    for (const lane of LANES_BY_PRIORITY) {
      if (picked.length >= maxCount) break

      const currentInFlight = input.inFlightByLane[lane] ?? 0
      if (!laneHasCapacity(lane, currentInFlight)) continue

      const entries = await listLane(lane)
      const available = entries.length
      const capacity = Math.max(0, (await import("./lane-policy")).LANE_CONFIGS[lane].concurrencyCap - currentInFlight)
      const toTake = Math.min(available, capacity, maxCount - picked.length)

      // Prefer the preferred session if it's in this lane
      if (input.preferredSessionID) {
        const preferred = entries.find((e) => e.sessionID === input.preferredSessionID)
        if (preferred && picked.length < maxCount) {
          picked.push(preferred)
        }
      }

      for (const entry of entries) {
        if (picked.length >= maxCount) break
        if (picked.some((p) => p.sessionID === entry.sessionID)) continue
        if (picked.filter((p) => p.lane === lane).length >= toTake) break
        picked.push(entry)
      }
    }

    return picked
  }

  /**
   * Count entries per lane.
   */
  export async function countByLane(): Promise<Record<Lane, number>> {
    const counts: Record<Lane, number> = { critical: 0, normal: 0, background: 0 }
    for (const lane of LANES_BY_PRIORITY) {
      counts[lane] = (await Storage.list(["run_queue", lane]).catch(() => [])).length
    }
    return counts
  }
}
