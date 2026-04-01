export type ModelKey = { providerID: string; modelID: string }

type Visibility = "show" | "hide"
export type UserPreference = ModelKey & { visibility?: Visibility; favorite?: boolean }

const KNOWN_PROVIDER_FAMILIES = [
  "opencode",
  "claude-cli",
  "openai",
  "github-copilot",
  "gemini-cli",
  "google-api",
  "gmicloud",
  "openrouter",
  "vercel",
  "gitlab",
] as const

const EXCLUDED_PROVIDER_FAMILIES = new Set(["google"])

export function normalizePreferenceProviderFamily(id: unknown): string {
  if (typeof id !== "string") return ""
  const raw = id.trim().toLowerCase()
  if (!raw) return ""
  if (raw.includes(":")) return normalizePreferenceProviderFamily(raw.split(":")[0]!)
  if (EXCLUDED_PROVIDER_FAMILIES.has(raw)) return ""

  for (const provider of KNOWN_PROVIDER_FAMILIES) {
    if (raw === provider || raw.startsWith(`${provider}-`)) return provider
  }

  const apiMatch = raw.match(/^(.+)-api-/)
  if (apiMatch) return apiMatch[1]!
  const subscriptionMatch = raw.match(/^(.+)-subscription-/)
  if (subscriptionMatch) return subscriptionMatch[1]!
  return EXCLUDED_PROVIDER_FAMILIES.has(raw) ? "" : raw
}

export function normalizePreferenceModel(model: ModelKey): ModelKey {
  const providerID = normalizePreferenceProviderFamily(model.providerID) || String(model.providerID ?? "")
  return {
    providerID,
    modelID: String(model.modelID ?? ""),
  }
}

export function preferenceModelKey(model: ModelKey) {
  return `${normalizePreferenceProviderFamily(model.providerID)}:${model.modelID ?? ""}`
}

function normalizeUsers(input: UserPreference[]) {
  return input.map((item) => {
    if (item.favorite === true) {
      if (item.visibility === "show") return item
      return { ...item, visibility: "show" as const }
    }
    if (item.visibility === "hide" && item.favorite === false) return item
    if (item.visibility === "show") {
      return { ...item, favorite: true }
    }
    if (item.visibility === "hide") {
      return { ...item, favorite: false }
    }
    return item
  })
}

export function sameUserPreferences(a: UserPreference[], b: UserPreference[]) {
  if (a.length !== b.length) return false
  return a.every((item, index) => {
    const other = b[index]
    return (
      item?.providerID === other?.providerID &&
      item?.modelID === other?.modelID &&
      item?.favorite === other?.favorite &&
      item?.visibility === other?.visibility
    )
  })
}

export function buildUsersFromRemotePreferences(prefs: {
  favorite: Array<{ providerId: string; modelID: string }>
  hidden: Array<{ providerId: string; modelID: string }>
}) {
  const favoriteSet = new Set(
    prefs.favorite.map((item) => `${normalizePreferenceProviderFamily(item.providerId)}:${item.modelID}`),
  )
  const hiddenSet = new Set(
    prefs.hidden.map((item) => `${normalizePreferenceProviderFamily(item.providerId)}:${item.modelID}`),
  )
  const merged = new Map<string, UserPreference>()

  for (const key of hiddenSet) {
    const [providerID, modelID] = key.split(":")
    if (!providerID || !modelID) continue
    merged.set(key, {
      providerID,
      modelID,
      visibility: "hide",
      favorite: false,
    })
  }

  for (const key of favoriteSet) {
    const [providerID, modelID] = key.split(":")
    if (!providerID || !modelID) continue
    merged.set(key, {
      providerID,
      modelID,
      visibility: "show",
      favorite: true,
    })
  }

  return normalizeUsers(Array.from(merged.values()))
}
