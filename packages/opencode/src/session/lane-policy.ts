import type { TriggerPriority } from "./trigger"

/**
 * Lane definitions for the run queue.
 *
 * Each lane has a name, concurrency cap, and priority rank (lower = higher priority).
 * The supervisor drains lanes in priority order: critical → normal → background.
 */
export type Lane = "critical" | "normal" | "background"

export type LaneConfig = {
  name: Lane
  concurrencyCap: number
  priorityRank: number
}

export const LANE_CONFIGS: Record<Lane, LaneConfig> = {
  critical: { name: "critical", concurrencyCap: 2, priorityRank: 0 },
  normal: { name: "normal", concurrencyCap: 4, priorityRank: 1 },
  background: { name: "background", concurrencyCap: 2, priorityRank: 2 },
}

export const LANES_BY_PRIORITY: Lane[] = (["critical", "normal", "background"] as const).slice()

/**
 * Map a trigger priority to a queue lane.
 */
export function triggerPriorityToLane(priority: TriggerPriority): Lane {
  switch (priority) {
    case "critical":
      return "critical"
    case "normal":
      return "normal"
    case "background":
      return "background"
  }
}

/**
 * Check if a lane has capacity given current in-flight count.
 */
export function laneHasCapacity(lane: Lane, currentInFlight: number): boolean {
  return currentInFlight < LANE_CONFIGS[lane].concurrencyCap
}

/**
 * Total concurrency cap across all lanes.
 */
export function totalConcurrencyCap(): number {
  return Object.values(LANE_CONFIGS).reduce((sum, config) => sum + config.concurrencyCap, 0)
}
