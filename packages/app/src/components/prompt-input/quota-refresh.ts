export function isPromptQuotaProviderFamily(providerFamily?: string) {
  return providerFamily === "openai" || providerFamily === "google-api" || providerFamily === "gemini-cli"
}

export function shouldRefreshProviderQuota(input: {
  providerFamily?: string
  lastRefreshAt: number
  now?: number
  minIntervalMs?: number
}) {
  if (!isPromptQuotaProviderFamily(input.providerFamily)) return false
  const now = input.now ?? Date.now()
  const minIntervalMs = input.minIntervalMs ?? 60_000
  return now - input.lastRefreshAt >= minIntervalMs
}
