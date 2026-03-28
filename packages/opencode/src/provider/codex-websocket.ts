/**
 * codex-websocket.ts — WebSocket transport for Codex Responses API
 *
 * Provides incremental delta and prewarm capabilities:
 *   - previous_response_id: only send new input items (not full history)
 *   - generate: false: warm server cache without output token consumption
 *   - Sticky routing via x-codex-turn-state header
 *
 * Falls back to HTTP SSE (Bun.spawn C binary) on connection failure.
 */

import { Log } from "../util/log"
import type { LanguageModelV2StreamPart, LanguageModelV2FinishReason, LanguageModelV2Usage } from "@ai-sdk/provider"

const log = Log.create({ service: "codex-websocket" })

const CODEX_WS_ENDPOINT = "wss://chatgpt.com/backend-api/codex/responses"
const WS_BETA_HEADER = "responses_websockets=2026-02-06"
const CONNECT_TIMEOUT_MS = 15000
const CONNECTION_MAX_AGE_MS = 55 * 60 * 1000 // 55 min (server limit is 60)

export interface CodexWsAuth {
  accessToken: string
  accountId?: string
}

export interface CodexWsRequest {
  type: "response.create"
  model: string
  instructions: string
  input: unknown[]
  tools: unknown[]
  tool_choice: string
  parallel_tool_calls: boolean
  stream: boolean
  include: string[]
  prompt_cache_key?: string
  previous_response_id?: string
  generate?: boolean
}

interface WsEventHandler {
  onPart: (part: LanguageModelV2StreamPart) => void
  onMeta: (meta: { turnState?: string; responseId?: string; reasoningIncluded?: boolean }) => void
  onDone: () => void
  onError: (err: Error) => void
}

/**
 * Manages a WebSocket connection to the Codex Responses API.
 * Reusable across multiple requests within a session.
 */
export class CodexWebSocket {
  private ws: WebSocket | null = null
  private connected = false
  private connectedAt = 0
  private handler: WsEventHandler | null = null
  private lastResponseId: string | undefined
  private disabled = false

  constructor(
    private auth: CodexWsAuth,
    private originator?: string,
    private turnState?: string,
  ) {}

  get isDisabled() { return this.disabled }

  /**
   * Connect to WebSocket endpoint.
   * Returns true if connected, false if should fallback to HTTP.
   */
  async connect(): Promise<boolean> {
    if (this.disabled) return false
    if (this.ws && this.connected && !this.isExpired()) return true

    this.close()

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        log.warn("codex ws connect timeout")
        this.disable("connect timeout")
        resolve(false)
      }, CONNECT_TIMEOUT_MS)

      try {
        // Bun WebSocket client supports headers via second arg
        this.ws = new WebSocket(CODEX_WS_ENDPOINT, {
          headers: {
            "Authorization": `Bearer ${this.auth.accessToken}`,
            "OpenAI-Beta": WS_BETA_HEADER,
            "originator": this.originator ?? "codex_cli_rs/0.1.0",
            ...(this.auth.accountId ? { "chatgpt-account-id": this.auth.accountId } : {}),
            ...(this.turnState ? { "x-codex-turn-state": this.turnState } : {}),
          },
        } as any)

        this.ws.onopen = () => {
          clearTimeout(timeout)
          this.connected = true
          this.connectedAt = Date.now()
          log.info("codex ws connected")
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(typeof event.data === "string" ? event.data : "")
        }

        this.ws.onerror = (event) => {
          clearTimeout(timeout)
          log.warn("codex ws error", { error: String(event) })
          if (!this.connected) {
            this.disable("connect error")
            resolve(false)
          }
        }

        this.ws.onclose = (event) => {
          clearTimeout(timeout)
          this.connected = false
          if (event.code === 426) {
            this.disable("426 Upgrade Required")
            resolve(false)
          }
          // Notify handler if mid-stream
          if (this.handler) {
            this.handler.onDone()
            this.handler = null
          }
        }
      } catch (err) {
        clearTimeout(timeout)
        log.warn("codex ws create failed", { error: String(err) })
        this.disable("create failed")
        resolve(false)
      }
    })
  }

  /**
   * Send a request and stream events.
   * Returns a ReadableStream of LanguageModelV2StreamPart.
   */
  async stream(request: CodexWsRequest): Promise<ReadableStream<LanguageModelV2StreamPart> | null> {
    if (!this.ws || !this.connected) return null

    // Check if we can do incremental delta
    if (this.lastResponseId && request.previous_response_id === undefined) {
      request.previous_response_id = this.lastResponseId
    }

    return new ReadableStream<LanguageModelV2StreamPart>({
      start: (controller) => {
        this.handler = {
          onPart: (part) => controller.enqueue(part),
          onMeta: (meta) => {
            if (meta.turnState) this.turnState = meta.turnState
            if (meta.responseId) this.lastResponseId = meta.responseId
          },
          onDone: () => {
            this.handler = null
            controller.close()
          },
          onError: (err) => {
            this.handler = null
            controller.error(err)
          },
        }

        // Send request as text frame
        try {
          this.ws!.send(JSON.stringify(request))
        } catch (err) {
          this.handler.onError(err instanceof Error ? err : new Error(String(err)))
        }
      },

      cancel: () => {
        this.handler = null
      },
    })
  }

  /**
   * Prewarm: send request with generate=false to warm server cache.
   * Does not consume output tokens.
   */
  async prewarm(request: Omit<CodexWsRequest, "generate">): Promise<boolean> {
    if (!this.ws || !this.connected) return false

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.handler = null
        resolve(false)
      }, 30000)

      this.handler = {
        onPart: () => {}, // ignore parts during prewarm
        onMeta: (meta) => {
          if (meta.turnState) this.turnState = meta.turnState
          if (meta.responseId) this.lastResponseId = meta.responseId
        },
        onDone: () => {
          clearTimeout(timeout)
          this.handler = null
          log.info("codex ws prewarm complete", { responseId: this.lastResponseId })
          resolve(true)
        },
        onError: () => {
          clearTimeout(timeout)
          this.handler = null
          resolve(false)
        },
      }

      try {
        this.ws!.send(JSON.stringify({ ...request, generate: false }))
      } catch {
        clearTimeout(timeout)
        this.handler = null
        resolve(false)
      }
    })
  }

  /**
   * Compute incremental delta input.
   * If only input items were appended (no instruction/tool changes),
   * return only the new items. Otherwise return null (send full request).
   */
  computeDelta(
    currentInput: unknown[],
    previousInputLength: number,
  ): unknown[] | null {
    if (!this.lastResponseId) return null
    if (previousInputLength <= 0) return null
    if (currentInput.length <= previousInputLength) return null

    // Only delta if new items were appended at the end
    return currentInput.slice(previousInputLength)
  }

  get responseId() { return this.lastResponseId }

  close() {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.connected = false
    this.handler = null
  }

  private isExpired(): boolean {
    return Date.now() - this.connectedAt > CONNECTION_MAX_AGE_MS
  }

  private disable(reason: string) {
    log.warn("codex ws disabled, falling back to HTTP", { reason })
    this.disabled = true
    this.close()
  }

  private handleMessage(data: string) {
    if (!this.handler) return

    let event: any
    try {
      event = JSON.parse(data)
    } catch {
      return
    }

    const type = event.type as string
    if (!type) return

    switch (type) {
      case "response.created": {
        const id = event.response?.id
        if (id) this.handler.onMeta({ responseId: id })
        this.handler.onPart({ type: "stream-start", warnings: [] })
        break
      }

      case "response.output_text.delta": {
        if (event.delta) {
          this.handler.onPart({ type: "text-delta", delta: event.delta, id: "text-0" })
        }
        break
      }

      case "response.reasoning_summary_text.delta":
      case "response.reasoning_text.delta": {
        if (event.delta) {
          this.handler.onPart({ type: "reasoning-delta", delta: event.delta, id: "reasoning-0" })
        }
        break
      }

      case "response.output_item.done": {
        const item = event.item
        if (item?.type === "function_call") {
          this.handler.onPart({
            type: "tool-call",
            toolCallType: "function",
            toolCallId: item.call_id ?? `tool-${Date.now()}`,
            toolName: item.name ?? "",
            args: item.arguments ?? "{}",
          })
        }
        break
      }

      case "response.completed": {
        const resp = event.response
        const id = resp?.id
        const usage = resp?.usage
        if (id) this.handler.onMeta({ responseId: id })

        // Capture turn state from headers if present
        // (WebSocket frames don't have HTTP headers, but the completed event may have metadata)
        if (event.headers) {
          const ts = event.headers["x-codex-turn-state"]
          if (ts) this.handler.onMeta({ turnState: ts })
        }

        const u: LanguageModelV2Usage = {
          inputTokens: usage?.input_tokens ?? 0,
          outputTokens: usage?.output_tokens ?? 0,
        }
        this.handler.onPart({
          type: "finish",
          usage: u,
          finishReason: "stop" as LanguageModelV2FinishReason,
        })
        this.handler.onDone()
        break
      }

      case "response.failed": {
        const err = event.response?.error
        this.handler.onPart({
          type: "error",
          error: new Error(err?.message ?? "Request failed"),
        })
        this.handler.onPart({
          type: "finish",
          usage: { inputTokens: 0, outputTokens: 0 },
          finishReason: "error" as LanguageModelV2FinishReason,
        })
        this.handler.onDone()
        break
      }

      case "response.incomplete": {
        this.handler.onPart({
          type: "finish",
          usage: { inputTokens: 0, outputTokens: 0 },
          finishReason: "length" as LanguageModelV2FinishReason,
        })
        this.handler.onDone()
        break
      }
    }
  }
}
