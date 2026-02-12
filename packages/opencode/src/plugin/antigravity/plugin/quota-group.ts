import { getModelFamily } from "./transform/model-resolver"
import type { QuotaGroup } from "./quota"

const GPT_OSS_PATTERN = /gpt[\s_-]?oss/
const GPT_OSS_MODEL_ID_PREFIX = "model_openai_gpt_oss_"

function toLowerSafe(value?: string): string {
  return (value ?? "").trim().toLowerCase()
}

export function isClaudeSharedQuotaModel(modelName: string, displayName?: string): boolean {
  const model = toLowerSafe(modelName)
  const display = toLowerSafe(displayName)
  const combined = `${model} ${display}`

  return (
    combined.includes("claude") ||
    GPT_OSS_PATTERN.test(combined) ||
    model.startsWith(GPT_OSS_MODEL_ID_PREFIX)
  )
}

export function resolveAntigravityQuotaGroup(modelName: string, displayName?: string): QuotaGroup | null {
  if (isClaudeSharedQuotaModel(modelName, displayName)) {
    return "claude"
  }

  const combined = `${toLowerSafe(modelName)} ${toLowerSafe(displayName)}`
  const isGemini3 = combined.includes("gemini-3") || combined.includes("gemini 3")
  if (!isGemini3) {
    return null
  }

  const family = getModelFamily(modelName)
  return family === "gemini-flash" ? "gemini-flash" : "gemini-pro"
}
