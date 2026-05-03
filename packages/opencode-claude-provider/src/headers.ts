/**
 * HTTP header builder — whitelist mode, built from scratch.
 *
 * Phase 2A: No header inheritance from any upstream layer.
 * Ref: claude-code@2.1.126 official header set.
 */
import {
  VERSION,
  API_VERSION,
  assembleBetas,
  buildBillingHeader,
  type AssembleBetasOptions,
} from "./protocol.js"

// ---------------------------------------------------------------------------
// § 2A.1  buildHeaders — construct all request headers from scratch
// ---------------------------------------------------------------------------

export interface BuildHeadersOptions {
  /** Bearer access token */
  accessToken: string
  /** Model ID for beta flag assembly */
  modelId: string
  /** Whether auth is OAuth/subscription */
  isOAuth: boolean
  /** Organization UUID (optional) */
  orgID?: string
  /** Content for billing header hash (first user message text) */
  billingContent?: string
  /** Entrypoint for billing header */
  entrypoint?: string
  /** Fast mode enabled */
  fastMode?: boolean
  /** Effort parameter used */
  effort?: boolean
  /** Task budget specified */
  taskBudget?: boolean
  /** Extra betas from ANTHROPIC_BETAS env */
  envBetas?: string[]
}

export function buildHeaders(options: BuildHeadersOptions): Headers {
  const headers = new Headers()

  // Required headers — exactly matching official CLI
  headers.set("Authorization", `Bearer ${options.accessToken}`)
  headers.set("anthropic-version", API_VERSION)
  headers.set("Content-Type", "application/json")
  headers.set("User-Agent", `claude-code/${VERSION}`)

  // Beta flags — dynamic per-request assembly
  const betaOptions: AssembleBetasOptions = {
    isOAuth: options.isOAuth,
    modelId: options.modelId,
    fastMode: options.fastMode,
    effort: options.effort,
    taskBudget: options.taskBudget,
    envBetas: options.envBetas,
  }
  const betas = assembleBetas(betaOptions)
  headers.set("anthropic-beta", betas.join(","))

  // Billing header
  if (options.billingContent) {
    headers.set(
      "x-anthropic-billing-header",
      buildBillingHeader(options.billingContent, options.entrypoint),
    )
  }

  // Organization
  if (options.orgID) {
    headers.set("x-organization-uuid", options.orgID)
  }

  return headers
}
