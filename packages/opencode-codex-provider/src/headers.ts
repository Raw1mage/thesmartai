/**
 * Codex request header builder.
 *
 * Constructs the complete header set for Codex API requests,
 * including identity, auth, and context-window lineage headers.
 */
import { ORIGINATOR, WS_BETA_HEADER } from "./protocol.js"
import type { WindowState } from "./types.js"

export interface BuildHeadersOptions {
  accessToken: string
  accountId?: string
  /** Sticky routing token from previous response */
  turnState?: string
  /** Context-window lineage */
  window?: WindowState
  /** Installation UUID for analytics */
  installationId?: string
  /** Session ID for correlation */
  sessionId?: string
  /** User-Agent string */
  userAgent?: string
  /** Whether this is a WebSocket upgrade request */
  isWebSocket?: boolean
}

export function buildHeaders(options: BuildHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "authorization": `Bearer ${options.accessToken}`,
    "content-type": "application/json",
    "originator": ORIGINATOR,
  }

  if (options.accountId) {
    headers["ChatGPT-Account-Id"] = options.accountId
  }

  if (options.turnState) {
    headers["x-codex-turn-state"] = options.turnState
  }

  // Context-window lineage (§6 of whitepaper)
  if (options.window) {
    headers["x-codex-window-id"] = `${options.window.conversationId}:${options.window.generation}`
  }

  if (options.sessionId) {
    headers["session_id"] = options.sessionId
  }

  if (options.userAgent) {
    headers["User-Agent"] = options.userAgent
  }

  if (options.isWebSocket) {
    headers["OpenAI-Beta"] = WS_BETA_HEADER
  }

  return headers
}

/**
 * Build client_metadata for the request body.
 * Includes installation_id and window lineage.
 */
export function buildClientMetadata(options: {
  installationId?: string
  window?: WindowState
}): Record<string, string> | undefined {
  const metadata: Record<string, string> = {}
  let hasEntries = false

  if (options.installationId) {
    metadata["x-codex-installation-id"] = options.installationId
    hasEntries = true
  }

  if (options.window) {
    metadata["x-codex-window-id"] = `${options.window.conversationId}:${options.window.generation}`
    hasEntries = true
  }

  return hasEntries ? metadata : undefined
}
