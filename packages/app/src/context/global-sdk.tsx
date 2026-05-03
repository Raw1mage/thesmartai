import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { batch, createEffect, createSignal, onCleanup } from "solid-js"
import { usePlatform } from "./platform"
import { useServer } from "./server"
import { useWebAuth } from "./web-auth"

function normalizeDirectoryKey(value: string) {
  if (!value || value === "global") return "global"
  const normalized = value.replaceAll("\\", "/")
  if (normalized === "/") return normalized
  return normalized.replace(/\/+$/, "")
}

export const { use: useGlobalSDK, provider: GlobalSDKProvider } = createSimpleContext({
  name: "GlobalSDK",
  init: () => {
    const server = useServer()
    const platform = usePlatform()
    const webAuth = useWebAuth()
    const abort = new AbortController()

    const fetchWithAuth = Object.assign(
      (input: RequestInfo | URL, init?: RequestInit) => webAuth.authorizedFetch(input, init),
      {
        preconnect: (globalThis.fetch as unknown as { preconnect?: (...args: unknown[]) => unknown }).preconnect,
      },
    ) as typeof fetch

    // Removed 2026-05-03: this effect used to auto-open the server's
    // canonical worktree as a sidebar tab on every page load. Two
    // problems with that: (a) when the server's CWD is a parent dir
    // like `~/projects`, it pollutes the sidebar with a non-project
    // tab on every reload; (b) opening tabs is a user gesture, not
    // something the runtime should do unilaterally. If a tab needs to
    // be there, the user (or a deliberate flow) opens it.

    const eventFetch = (() => {
      if (!platform.fetch) return
      try {
        const url = new URL(server.url)
        const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
        if (url.protocol === "http:" && !loopback) return platform.fetch
      } catch {
        return
      }
    })()

    const streamFetch = eventFetch ?? fetchWithAuth

    const emitter = createGlobalEmitter<{
      [key: string]: Event
    }>()
    const [reconnectVersion, setReconnectVersion] = createSignal(0)

    type Queued = { directory: string; payload: Event }
    const FLUSH_FRAME_MS = 16
    const STREAM_YIELD_MS = 8
    const RECONNECT_DELAY_MS = 250

    let queue: Queued[] = []
    let buffer: Queued[] = []
    const coalesced = new Map<string, number>()
    const recentlySeen = new Map<string, number>()
    const staleDeltas = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = 0

    const deltaKey = (directory: string, messageID: string, partID: string) => `${directory}:${messageID}:${partID}`

    const key = (directory: string, payload: Event) => {
      if (payload.type === "session.status") return `session.status:${directory}:${payload.properties.sessionID}`
      if (payload.type === "lsp.updated") return `lsp.updated:${directory}`
      if (payload.type === "message.part.updated") {
        // Delta-aware: when the event carries a delta (text stripped), each event
        // is append-only and must NOT be coalesced — dropping intermediate deltas
        // loses text. Only coalesce full-part updates (no delta field).
        if ((payload.properties as any).delta) return undefined
        const part = payload.properties.part
        return `message.part.updated:${directory}:${part.messageID}:${part.id}`
      }
    }

    const flush = () => {
      if (timer) clearTimeout(timer)
      timer = undefined

      if (queue.length === 0) return

      const events = queue
      const skip = staleDeltas.size > 0 ? new Set(staleDeltas) : undefined
      queue = buffer
      buffer = events
      queue.length = 0
      coalesced.clear()
      const now = Date.now()
      for (const [eventKey, seenAt] of recentlySeen) {
        if (now - seenAt > 2_000) recentlySeen.delete(eventKey)
      }
      staleDeltas.clear()

      last = Date.now()
      batch(() => {
        for (const event of events) {
          const payload = event.payload as { type?: string; properties?: { messageID?: string; partID?: string } }
          const eventKey = key(event.directory, event.payload)
          if (eventKey) recentlySeen.set(eventKey, now)
          if (skip && payload.type === "message.part.delta") {
            const props = payload.properties
            if (!props?.messageID || !props?.partID) continue
            if (skip.has(deltaKey(event.directory, props.messageID, props.partID))) continue
          }
          emitter.emit(event.directory, event.payload)
        }
      })

      buffer.length = 0
    }

    const schedule = () => {
      if (timer) return
      const elapsed = Date.now() - last
      timer = setTimeout(flush, Math.max(0, FLUSH_FRAME_MS - elapsed))
    }

    let streamErrorLogged = false
    // Timestamp of the last received SSE event (wall-clock ms). 0 = never yet.
    // Used by submit.ts to detect silently-dead SSE before sending a prompt:
    // if the stream is stale (no heartbeat or event within N seconds), force
    // a reconnect before the POST so the reply's inbound path is alive.
    // Server writes `server.heartbeat` every 30s, so a gap > ~30s with nothing
    // means the downstream proxy has dropped the stream (NAT/idle timeout).
    let lastEventAt = 0
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
    const shouldConnectEventStream = () => {
      if (!webAuth.enabled()) return true
      return webAuth.authenticated()
    }
    const isUnauthorized = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      return message.includes("401") || message.toLowerCase().includes("unauthorized")
    }

    const reconnect = (reason: string) => {
      if (abort.signal.aborted) return
      streamErrorLogged = false
      console.info("[global-sdk] reconnecting event stream", { reason, url: server.url })
      setReconnectVersion((value) => value + 1)
    }

    // Counts successful SSE stream opens for this provider instance. The
    // FIRST open is the initial load; subsequent opens mean the stream had
    // dropped (daemon restart, network hiccup, Cloudflare keepalive) and
    // auto-reconnected. On every non-first open we broadcast a window event
    // so useSessionResumeSync / other listeners can force-refetch their data.
    // Without this signal, clients miss events fired while the stream was
    // disconnected and the UI silently goes stale until the next
    // visibilitychange / pageshow / online.
    let streamOpenCount = 0

    createEffect(() => {
      reconnectVersion()
      const streamAbort = new AbortController()
      const signal = AbortSignal.any([abort.signal, streamAbort.signal])
      const loopSdk = createOpencodeClient({
        baseUrl: server.url,
        signal,
        fetch: streamFetch,
      })

      void (async () => {
        let backoff = RECONNECT_DELAY_MS

        while (!signal.aborted) {
          if (!shouldConnectEventStream()) {
            streamErrorLogged = false
            await wait(RECONNECT_DELAY_MS)
            continue
          }

          try {
            const events = await loopSdk.global.event({
              onSseError: (error) => {
                if (signal.aborted) return
                if (error instanceof Error && error.name === "AbortError") return
                if ((error as DOMException)?.name === "AbortError") return
                if (isUnauthorized(error) && webAuth.enabled() && !webAuth.authenticated()) return
                if (streamErrorLogged) return
                streamErrorLogged = true
                console.error("[global-sdk] event stream error", {
                  url: server.url,
                  fetch: eventFetch ? "platform" : "webview",
                  error,
                })
              },
            })
            const previousEventAt = lastEventAt
            streamOpenCount += 1
            lastEventAt = Date.now()
            if (streamOpenCount > 1 && typeof window !== "undefined") {
              // Only treat this reconnect as "missed events — full resync needed"
              // if the stream was truly down for a while. Short flaps (nginx
              // keepalive / cellular NAT bounce / HTTP/2 ping miss) reconnect
              // within seconds; racing a force-refetch against an in-flight
              // streaming reply can wipe partial message parts from the store
              // because the GET /message response is a point-in-time snapshot
              // that may predate the current streaming assistant message. Rely
              // on SSE's natural event delivery for short gaps.
              const SSE_LONG_OUTAGE_THRESHOLD_MS = 30_000
              const gapMs = previousEventAt === 0 ? 0 : Date.now() - previousEventAt
              if (gapMs > SSE_LONG_OUTAGE_THRESHOLD_MS) {
                console.info("[global-sdk] event stream reconnected after long outage — dispatching resync", {
                  url: server.url,
                  openCount: streamOpenCount,
                  gapMs,
                  thresholdMs: SSE_LONG_OUTAGE_THRESHOLD_MS,
                })
                window.dispatchEvent(new CustomEvent("opencode:sse_reconnect"))
              } else {
                console.info("[global-sdk] event stream reconnected — short flap, skipping resync", {
                  url: server.url,
                  openCount: streamOpenCount,
                  gapMs,
                })
              }
            }
            let yielded = Date.now()
            for await (const event of events.stream) {
              lastEventAt = Date.now()
              backoff = RECONNECT_DELAY_MS
              streamErrorLogged = false
              const directory = normalizeDirectoryKey(event.directory ?? "global")
              const payload = event.payload
              const k = key(directory, payload)
              if (k) {
                const i = coalesced.get(k)
                if (i !== undefined) {
                  queue[i] = { directory, payload }
                  if (payload.type === "message.part.updated") {
                    const part = payload.properties.part
                    staleDeltas.add(deltaKey(directory, part.messageID, part.id))
                  }
                  continue
                }
                const seenAt = recentlySeen.get(k)
                if (seenAt !== undefined && Date.now() - seenAt < 2_000) continue
                coalesced.set(k, queue.length)
              }
              queue.push({ directory, payload })
              schedule()

              if (Date.now() - yielded < STREAM_YIELD_MS) continue
              yielded = Date.now()
              await wait(0)
            }
          } catch (error) {
            if (signal.aborted) return
            if (error instanceof Error && error.name === "AbortError") return
            if ((error as DOMException)?.name === "AbortError") return

            if (isUnauthorized(error) && webAuth.enabled() && !webAuth.authenticated()) {
              await wait(RECONNECT_DELAY_MS)
              continue
            }
            if (!streamErrorLogged) {
              streamErrorLogged = true
              console.error("[global-sdk] event stream failed", {
                url: server.url,
                fetch: eventFetch ? "platform" : "webview",
                error,
              })
            }
          }

          if (signal.aborted) return
          await wait(backoff)
          backoff = Math.min(backoff * 2, 10000)
        }
      })().finally(flush)

      onCleanup(() => {
        streamAbort.abort()
      })
    })

    const onVisibility = () => {
      if (document.hidden) return
      reconnect("visibilitychange")
    }
    // pageshow fires on every show including initial page load. We only need
    // to force-reconnect when it's a bfcache restore (event.persisted = true);
    // a normal initial load already opened a fresh stream and reconnecting
    // immediately just produces a noisy 65ms-gap "short flap" in the log.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reconnect("pageshow-bfcache")
    }
    const onOnline = () => reconnect("online")

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    window.addEventListener("online", onOnline)

    onCleanup(() => {
      abort.abort()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
      window.removeEventListener("online", onOnline)
      flush()
    })

    const sdk = createOpencodeClient({
      baseUrl: server.url,
      fetch: fetchWithAuth,
      throwOnError: true,
    })

    return {
      url: server.url,
      client: sdk,
      event: emitter,
      fetch: fetchWithAuth,
      // SSE liveness probe for callers (e.g. prompt submit) that want to
      // verify the inbound channel is fresh before doing something that
      // expects a server reply. Returns 0 if the stream has never produced
      // an event for this session; otherwise the wall-clock ms of the last
      // one.
      lastEventAt: () => lastEventAt,
      // Trigger a fresh SSE connection. Safe to call at any time — the
      // existing stream is aborted, a new HTTP GET /global/event is made.
      // Same mechanism as the auto-reconnect loop, just user-initiated.
      forceSseReconnect: (reason: string) => reconnect(reason),
    }
  },
})
