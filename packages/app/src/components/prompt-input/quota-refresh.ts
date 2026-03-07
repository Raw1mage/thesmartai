export function isOpenAIProviderFamily(providerFamily?: string) {
  return providerFamily === "openai"
}

export function shouldRefreshOpenAIQuota(input: {
  providerFamily?: string
  lastRefreshAt: number
  now?: number
  minIntervalMs?: number
}) {
  if (!isOpenAIProviderFamily(input.providerFamily)) return false
  const now = input.now ?? Date.now()
  const minIntervalMs = input.minIntervalMs ?? 60_000
  return now - input.lastRefreshAt >= minIntervalMs
}
