import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { useSDK } from "@/context/sdk"
import type { AutonomousHealthSummary } from "./helpers"

const ACTIVE_FALLBACK_MS = 15_000
const IDLE_FALLBACK_MS = 90_000
const MIN_REFRESH_MS = 4_000
const EVENT_DEBOUNCE_MS = 500

const activeStatuses = new Set(["busy", "working", "retry", "compacting", "pending"])

export function useAutonomousHealthSync(input: {
  enabled: () => boolean
  sessionID: () => string | undefined
  sdk: ReturnType<typeof useSDK>
  status: () => { type?: string } | undefined
}) {
  const [state, setState] = createStore({
    data: undefined as AutonomousHealthSummary | undefined,
    loading: false,
    initialized: false,
    error: undefined as string | undefined,
  })
  let refreshNow: ((force: boolean) => Promise<void>) | undefined

  createEffect(() => {
    if (!input.enabled()) return
    const sessionID = input.sessionID()
    if (!sessionID) {
      setState({ data: undefined, loading: false, initialized: false, error: undefined })
      return
    }

    let cancelled = false
    let inFlight = false
    let lastFetchedAt = 0
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setTimeout> | undefined

    const isBusy = () => activeStatuses.has(input.status()?.type ?? "idle")
    const clearTimers = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      if (pollTimer) clearTimeout(pollTimer)
      refreshTimer = undefined
      pollTimer = undefined
    }
    const scheduleFallback = () => {
      if (cancelled) return
      if (!input.enabled() || input.sessionID() !== sessionID) return
      if (document.hidden) return
      if (pollTimer) clearTimeout(pollTimer)
      pollTimer = setTimeout(() => void refresh(false), isBusy() ? ACTIVE_FALLBACK_MS : IDLE_FALLBACK_MS)
    }

    const refresh = async (force: boolean) => {
      if (cancelled || inFlight) return
      if (!input.enabled() || input.sessionID() !== sessionID) return
      if (document.hidden) return
      const now = Date.now()
      if (!force && now - lastFetchedAt < MIN_REFRESH_MS) {
        scheduleFallback()
        return
      }

      inFlight = true
      if (!state.initialized) setState("loading", true)
      try {
        const response = await input.sdk.fetch(`${input.sdk.url}/api/v2/session/${sessionID}/autonomous/health`, {
          method: "GET",
          headers: { "content-type": "application/json", "x-opencode-directory": input.sdk.directory },
        })
        if (!response.ok) throw new Error(`Failed to load autonomous health (${response.status})`)
        const result = (await response.json()) as AutonomousHealthSummary
        if (cancelled) return
        setState({ data: result, loading: false, initialized: true, error: undefined })
        lastFetchedAt = Date.now()
      } catch (error) {
        if (cancelled) return
        setState({
          data: state.data,
          loading: false,
          initialized: true,
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        inFlight = false
        scheduleFallback()
      }
    }
    refreshNow = refresh

    const requestRefresh = (delay: number, force = false) => {
      if (cancelled) return
      if (!input.enabled() || input.sessionID() !== sessionID) return
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refresh(force), delay)
    }

    const stop = input.sdk.event.listen((e) => {
      const event = e.details as { type: string; properties?: any }
      if (cancelled) return
      if (!input.enabled() || input.sessionID() !== sessionID) return
      if (event.type === "session.status" && event.properties?.sessionID === sessionID) {
        requestRefresh(event.properties?.status?.type === "idle" ? 0 : EVENT_DEBOUNCE_MS, true)
        return
      }
      if (event.type === "session.updated" && event.properties?.info?.id === sessionID) {
        requestRefresh(EVENT_DEBOUNCE_MS, true)
        return
      }
      if (event.type === "todo.updated" && event.properties?.sessionID === sessionID) {
        requestRefresh(EVENT_DEBOUNCE_MS, true)
      }
    })

    const onVisibility = () => {
      if (document.hidden) {
        if (pollTimer) clearTimeout(pollTimer)
        return
      }
      requestRefresh(0, true)
    }
    document.addEventListener("visibilitychange", onVisibility)
    void refresh(true)

    onCleanup(() => {
      cancelled = true
      clearTimers()
      document.removeEventListener("visibilitychange", onVisibility)
      stop()
    })
  })

  const forceRefresh = async () => {
    const runner = refreshNow
    if (!runner) return
    await runner(true)
  }

  return {
    ...state,
    forceRefresh,
  }
}
