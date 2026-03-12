export type VariantOption = {
  value: string
  title: string
  description: string
}

const OPENAI_PREFERRED_ORDER = ["low", "medium", "high", "extra", "xhigh"]

function formatVariantLabel(value: string, providerKey?: string) {
  const normalized = value.toLowerCase()
  if (providerKey === "openai" && (normalized === "xhigh" || normalized === "extra")) return "Extra"
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ")
}

export function buildVariantOptions(values: string[], providerKey?: string): VariantOption[] {
  let normalized = [...values]

  if (providerKey === "openai") {
    const set = new Set(normalized)
    const narrowed = OPENAI_PREFERRED_ORDER.filter((value) => set.has(value))
    if (narrowed.length > 0) normalized = narrowed
    normalized = normalized.filter((value) => value !== "none" && value !== "minimal")
  }

  const usedTitles = new Set<string>()
  const result: VariantOption[] = []
  for (const value of normalized) {
    const title = formatVariantLabel(value, providerKey)
    if (usedTitles.has(title)) continue
    usedTitles.add(title)
    result.push({ value, title, description: `Raw: ${value}` })
  }
  return result
}

export function getEffectiveVariantValue(input: {
  providerKey?: string
  current?: string
  options: VariantOption[]
}): string | undefined {
  if (input.current) return input.current
  if (input.providerKey === "openai") {
    return input.options.find((item) => item.value === "medium")?.value ?? input.options[0]?.value
  }
  return undefined
}

export function shouldShowVariantControl(input: {
  providerKey?: string
  current?: string
  options: VariantOption[]
}): boolean {
  if (input.options.length === 0) return false
  if (input.providerKey === "openai") return true
  return !!input.current
}
