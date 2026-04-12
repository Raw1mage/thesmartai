export function isPromptQuotaProviderKey(providerKey?: string) {
  return providerKey === "openai" || providerKey === "google-api" || providerKey === "gemini-cli"
}

export function shouldRefreshProviderQuota(input: {
  providerKey?: string
  lastRefreshAt: number
  now?: number
  minIntervalMs?: number
}) {
  if (!isPromptQuotaProviderKey(input.providerKey)) return false
  const now = input.now ?? Date.now()
  const minIntervalMs = input.minIntervalMs ?? 60_000
  return now - input.lastRefreshAt >= minIntervalMs
}
