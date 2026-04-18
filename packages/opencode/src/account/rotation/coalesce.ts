/**
 * Rotation coalescing — storm prevention for handleRateLimitFallback.
 *
 * Three orthogonal layers:
 *
 * 1. Single-flight (in-flight deduplication)
 *    Concurrent callers for the same coalesceKey share one rotation execution
 *    and receive the same result. Treats the simultaneous burst of 429s when
 *    an account hits quota.
 *
 * 2. Recent-decision cache (3s by default)
 *    Straggler requests (still in-flight on the upstream when rotation decided)
 *    that reach this code within the window reuse the cached result instead of
 *    triggering fresh rotation. Key is per-account.
 *
 * 3. Min-interval anti-cascade guard (5s by default, per provider)
 *    Any rotation action on a given provider waits until MIN_INTERVAL_MS has
 *    passed since the last rotation on that provider. Prevents rapid
 *    A→B→C→D cascades that look like automated credential cycling to the
 *    upstream provider. The wait happens inside the core work path, so all
 *    callers (first-time and retry) are throttled.
 *
 * State is module-level in-memory. All rotation decisions happen in the daemon
 * process (subagents escalate back to daemon for rotation), so intra-process
 * state is sufficient.
 */

import { Log } from "../../util/log"

const log = Log.create({ service: "rotation.coalesce" })

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    log.warn("ignoring invalid env override, using default", { name, raw, fallback })
    return fallback
  }
  return n
}

let COALESCE_WINDOW_MS_INTERNAL = readIntEnv("OPENCODE_ROTATION_COALESCE_MS", 3_000)
let MIN_INTERVAL_MS_INTERNAL = readIntEnv("OPENCODE_ROTATION_MIN_INTERVAL_MS", 5_000)

export const getRotationCoalesceWindowMs = () => COALESCE_WINDOW_MS_INTERNAL
export const getRotationMinIntervalMs = () => MIN_INTERVAL_MS_INTERNAL

const inflight = new Map<string, Promise<unknown>>()
const recentDecisions = new Map<string, { result: unknown; decidedAt: number }>()
const lastRotationByProvider = new Map<string, number>()

function gcRecentDecisions(now: number): void {
  for (const [k, v] of recentDecisions) {
    if (now - v.decidedAt > COALESCE_WINDOW_MS_INTERNAL) recentDecisions.delete(k)
  }
}

export interface CoalesceInput<T> {
  /** `${providerId}:${accountId}:${modelID}` — identity of the rotation origin. */
  coalesceKey: string
  /** Provider for the min-interval guard. */
  providerId: string
  /**
   * Whether this call is eligible for single-flight and cache sharing.
   * Typically `triedVectors.size === 0` — first-time rotation. Retries (with
   * non-empty triedVectors) bypass coalesce but still honor the min-interval
   * guard.
   */
  eligibleForCoalesce: boolean
  /** The actual rotation logic (findFallback + side effects). */
  work: () => Promise<T>
  /** Whether a result should update the recent-decision cache and the
   *  last-rotation timestamp. Usually `r => r !== null`. */
  shouldCache: (result: T) => boolean
}

export async function withRotationCoalesce<T>(input: CoalesceInput<T>): Promise<T> {
  const { coalesceKey, providerId, eligibleForCoalesce, work, shouldCache } = input

  if (eligibleForCoalesce) {
    const now = Date.now()
    gcRecentDecisions(now)
    const cached = recentDecisions.get(coalesceKey)
    if (cached) {
      log.info("rotation coalesced (recent-decision cache hit)", {
        coalesceKey,
        ageMs: now - cached.decidedAt,
      })
      return cached.result as T
    }
    const existing = inflight.get(coalesceKey)
    if (existing) {
      log.info("rotation coalesced (in-flight single-flight hit)", { coalesceKey })
      return existing as Promise<T>
    }
  }

  const runWithGuard = async (): Promise<T> => {
    const lastAt = lastRotationByProvider.get(providerId) ?? 0
    const waitMs = lastAt + MIN_INTERVAL_MS_INTERNAL - Date.now()
    if (waitMs > 0) {
      log.info("rotation min-interval guard: sleeping to avoid rapid cascade", {
        providerId,
        waitMs,
        reason: "anti-abuse — upstream may flag rapid account switching",
      })
      await new Promise((r) => setTimeout(r, waitMs))
    }
    const result = await work()
    if (shouldCache(result)) {
      lastRotationByProvider.set(providerId, Date.now())
    }
    return result
  }

  if (!eligibleForCoalesce) return runWithGuard()

  const promise = runWithGuard()
    .then((result) => {
      if (shouldCache(result)) {
        recentDecisions.set(coalesceKey, { result, decidedAt: Date.now() })
      }
      return result
    })
    .finally(() => {
      inflight.delete(coalesceKey)
    })
  inflight.set(coalesceKey, promise)
  return promise
}

export function __resetRotationCoalesceForTests(): void {
  inflight.clear()
  recentDecisions.clear()
  lastRotationByProvider.clear()
}

export function __setRotationCoalesceTimingForTests(input: {
  coalesceWindowMs?: number
  minIntervalMs?: number
}): void {
  if (input.coalesceWindowMs !== undefined) COALESCE_WINDOW_MS_INTERNAL = input.coalesceWindowMs
  if (input.minIntervalMs !== undefined) MIN_INTERVAL_MS_INTERNAL = input.minIntervalMs
}
