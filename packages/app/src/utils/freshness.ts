// session-ui-freshness — single source of truth for fidelity classification.
// Every freshness-aware UI memo imports classifyFidelity; no duplicate logic
// elsewhere. Keep this pure: input is a snapshot of state, output is the
// classification. Tick-driven reactivity lives in use-freshness-clock.

export type Fidelity = "fresh" | "stale" | "hard-stale"

export interface FreshnessThresholds {
  /** Soft threshold in seconds; entries older than this render a stale hint. */
  softSec: number
  /** Hard timeout in seconds; entries older than this are collapsed / frozen. */
  hardSec: number
}

/**
 * Classify an entry's fidelity from its client-stamped receivedAt and the
 * current freshness clock.
 *
 * DD-4: receivedAt that is undefined / null / NaN / Infinity / negative is
 * treated as 0 — forcing hard-stale. This is intentional: we never silently
 * pretend missing data is fresh (AGENTS.md rule 1). The caller may optionally
 * pass a warn-once sink via options.onInvalid to surface the anomaly.
 *
 * DD-5: when `enabled` is false (feature flag ui_session_freshness_enabled=0),
 * classification is bypassed and every entry reports "fresh" so the UI renders
 * byte-equivalent to the pre-plan baseline.
 *
 * The soft / hard thresholds are seconds; internally converted to ms to match
 * receivedAt and now (both wall-clock ms).
 */
export function classifyFidelity(
  receivedAt: number | null | undefined,
  now: number,
  thresholds: FreshnessThresholds,
  enabled: boolean,
  options?: {
    onInvalid?: (rawValue: unknown) => void
  },
): Fidelity {
  if (!enabled) return "fresh"

  const valid =
    typeof receivedAt === "number" && Number.isFinite(receivedAt) && receivedAt > 0
  if (!valid) {
    options?.onInvalid?.(receivedAt)
    return "hard-stale"
  }

  const deltaMs = now - receivedAt
  const softMs = thresholds.softSec * 1000
  const hardMs = thresholds.hardSec * 1000

  if (deltaMs >= hardMs) return "hard-stale"
  if (deltaMs >= softMs) return "stale"
  return "fresh"
}

/**
 * Convenience: rate-limit a warn callback to at most once per entry id per
 * window. Consumers pass the returned function to classifyFidelity's
 * onInvalid option to satisfy errors.md FRESHNESS_INVALID_TIMESTAMP's
 * ≤1/min/entry rule without everyone reinventing it.
 */
export function createRateLimitedWarn(
  warn: (msg: string, detail: unknown) => void,
  windowMs = 60_000,
): (entryId: string, rawValue: unknown) => void {
  const lastWarnedAt = new Map<string, number>()
  return (entryId, rawValue) => {
    const now = Date.now()
    const previous = lastWarnedAt.get(entryId)
    if (previous !== undefined && now - previous < windowMs) return
    lastWarnedAt.set(entryId, now)
    warn(`[freshness] invalid receivedAt on entry ${entryId}`, { rawValue })
  }
}
