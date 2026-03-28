/**
 * codex-compaction.ts — Server-side compaction via Codex Responses API
 *
 * Sends conversation history to /responses/compact endpoint for server-side
 * summarization. Falls back to client-side compaction on failure.
 */

import { Auth } from "../auth"
import { Log } from "../util/log"

const log = Log.create({ service: "codex-compaction" })

const CODEX_COMPACT_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses/compact"
const COMPACT_TIMEOUT_MS = 60000

export interface CompactRequest {
  model: string
  input: unknown[]
  instructions?: string
}

export interface CompactResult {
  success: boolean
  input?: unknown[]
  tokensBefore?: number
  tokensAfter?: number
}

/**
 * Call the server-side /responses/compact endpoint.
 * Returns compacted input items on success, null on failure.
 */
export async function codexServerCompact(request: CompactRequest): Promise<CompactResult> {
  try {
    const liveAuth = await Auth.get("codex")
    const accessToken = (liveAuth as any)?.access
    const accountId = (liveAuth as any)?.accountId

    if (!accessToken) {
      log.warn("codex compact: no auth token")
      return { success: false }
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "responses=v1",
    }
    if (accountId) headers["chatgpt-account-id"] = accountId

    const body = JSON.stringify({
      model: request.model,
      input: request.input,
      ...(request.instructions ? { instructions: request.instructions } : {}),
    })

    log.info("codex compact request", {
      model: request.model,
      inputItems: request.input.length,
      bodyBytes: body.length,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), COMPACT_TIMEOUT_MS)

    const response = await fetch(CODEX_COMPACT_ENDPOINT, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      log.warn("codex compact failed", {
        status: response.status,
        statusText: response.statusText,
      })
      return { success: false }
    }

    const result = await response.json() as any

    // Server returns compacted input items
    const compactedInput = result.input ?? result.items ?? result.messages
    if (!compactedInput || !Array.isArray(compactedInput)) {
      log.warn("codex compact: unexpected response shape", { keys: Object.keys(result) })
      return { success: false }
    }

    const tokensBefore = result.usage?.input_tokens_before ?? request.input.length
    const tokensAfter = result.usage?.input_tokens_after ?? compactedInput.length

    log.info("codex compact success", {
      inputItemsBefore: request.input.length,
      inputItemsAfter: compactedInput.length,
      tokensBefore,
      tokensAfter,
    })

    return {
      success: true,
      input: compactedInput,
      tokensBefore,
      tokensAfter,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      log.warn("codex compact timeout")
    } else {
      log.warn("codex compact error", { error: String(err) })
    }
    return { success: false }
  }
}
