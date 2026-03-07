import { createEffect, onCleanup } from "solid-js"
import type { useSDK } from "@/context/sdk"
import type { useSync } from "@/context/sync"

export function useStatusTodoSync(input: {
  enabled: () => boolean
  sessionID: () => string | undefined
  sdk: ReturnType<typeof useSDK>
  sync: ReturnType<typeof useSync>
}) {
  createEffect(() => {
    if (!input.enabled()) return
    const sessionID = input.sessionID()
    if (!sessionID) return

    let cancelled = false
    let lastFetchAt = 0
    let refreshTimer: ReturnType<typeof setTimeout> | undefined

    const refresh = async (force = false) => {
      if (cancelled) return
      if (!input.enabled() || input.sessionID() !== sessionID) return
      const now = Date.now()
      if (!force && now - lastFetchAt < 1500) return
      await input.sync.session.todo(sessionID, { force })
      lastFetchAt = Date.now()
    }

    if (input.sync.data.todo[sessionID] === undefined) void refresh(true)

    const stop = input.sdk.event.listen((e) => {
      const event = e.details as { type: string; properties?: any }
      if (cancelled) return
      if (!input.enabled() || input.sessionID() !== sessionID) return

      if (event.type === "todo.updated" && event.properties?.sessionID === sessionID) {
        lastFetchAt = Date.now()
        return
      }

      if (event.type === "session.status" && event.properties?.sessionID === sessionID) {
        if (refreshTimer) clearTimeout(refreshTimer)
        const idle = event.properties?.status?.type === "idle"
        refreshTimer = setTimeout(
          () => {
            void refresh(idle)
          },
          idle ? 0 : 300,
        )
      }
    })

    const onVisibility = () => {
      if (document.hidden) return
      void refresh(true)
    }
    document.addEventListener("visibilitychange", onVisibility)

    onCleanup(() => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      document.removeEventListener("visibilitychange", onVisibility)
      stop()
    })
  })
}
