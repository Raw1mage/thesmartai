import type { OpenAIQuota } from "./openai"

export type QuotaDisplayFormat = "admin" | "footer"

export type RequestMonitorStatsLike = {
  rpd: number
}

export type RequestMonitorLimitsLike = {
  rpd: number
}

export function formatOpenAIQuotaDisplay(
  quota: OpenAIQuota | null | undefined,
  format: QuotaDisplayFormat = "admin",
): string {
  const fiveHour = quota ? (quota.hasHourlyWindow ? `${quota.hourlyRemaining}%` : "--") : "--"
  const week = quota ? `${quota.weeklyRemaining}%` : "--"

  if (format === "footer") {
    return `(5hrs:${fiveHour} | week:${week})`
  }

  return `5H:${fiveHour} WK:${week}`
}

export function formatRequestMonitorQuotaDisplay(
  stats: RequestMonitorStatsLike,
  limits: RequestMonitorLimitsLike,
): string | undefined {
  if (limits.rpd <= 0) return undefined
  const remaining = Math.max(0, limits.rpd - stats.rpd)
  const pct = Math.max(0, Math.min(100, Math.round((remaining / limits.rpd) * 100)))
  return `${pct}% (${stats.rpd}/${limits.rpd})`
}
