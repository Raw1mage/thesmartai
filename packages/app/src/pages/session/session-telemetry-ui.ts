import { createEffect } from "solid-js"
import { providerKeyOf } from "@/components/model-selector-state"
import type { useGlobalSync } from "@/context/global-sync"
import type { useSync } from "@/context/sync"
import type { EnrichedMonitorEntry } from "./monitor-helper"

export function resolveTelemetryAccountLabel(
  globalSync: ReturnType<typeof useGlobalSync>,
  accountId?: string,
  providerId?: string,
) {
  if (!accountId) return undefined
  const familyKey = providerId ? providerKeyOf(providerId) : undefined
  if (familyKey) {
    const info = globalSync.data.account_families?.[familyKey]?.accounts?.[accountId] as { name?: string } | undefined
    if (info?.name) return info.name
  }
  return accountId
}

export function useSessionTelemetryHydration(input: {
  sessionID: () => string | undefined
  sync: ReturnType<typeof useSync>
  deps: () => unknown
  monitorEntries?: () => EnrichedMonitorEntry[] | undefined
  loading?: () => boolean
  error?: () => string | undefined
}) {
  createEffect(() => {
    const sessionID = input.sessionID()
    if (!sessionID) return
    input.deps()
    const current = input.sync.data.session_telemetry[sessionID]
    if (current) return
    void input.sync.session.telemetry(sessionID, {
      force: true,
      monitor: input.monitorEntries?.(),
      loading: input.loading?.(),
      error: input.error?.(),
    })
  })
}
