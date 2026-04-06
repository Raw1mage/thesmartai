import { Component, createResource, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useGlobalSDK } from "@/context/global-sdk"
import { Icon } from "@opencode-ai/ui/icon"

interface StoreApp {
  id: string
  entry: { path: string; enabled: boolean; installedAt: string; source: { type: string } }
  manifest: { id: string; name: string; description?: string; icon?: string; command: string[] } | null
  tier: "system" | "user"
}

export const SettingsMcp: Component = () => {
  const language = useLanguage()
  const globalSDK = useGlobalSDK()
  const [actionLoading, setActionLoading] = createSignal<string | null>(null)

  async function fetchStoreApps(): Promise<StoreApp[]> {
    const res = await globalSDK.fetch(`${globalSDK.url}/api/v2/mcp/store/apps`)
    if (!res.ok) return []
    return res.json()
  }

  const [apps, { refetch }] = createResource(fetchStoreApps)

  async function toggleApp(id: string, enabled: boolean) {
    setActionLoading(id)
    try {
      await globalSDK.fetch(`${globalSDK.url}/api/v2/mcp/store/apps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      await refetch()
    } finally {
      setActionLoading(null)
    }
  }

  async function removeApp(id: string) {
    setActionLoading(id)
    try {
      await globalSDK.fetch(`${globalSDK.url}/api/v2/mcp/store/apps/${id}`, { method: "DELETE" })
      await refetch()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto">
      <div class="flex flex-col gap-6 p-6 max-w-[600px]">
        <h2 class="text-16-medium text-text-strong">{language.t("settings.mcp.title")}</h2>
        <p class="text-14-regular text-text-weak">{language.t("settings.mcp.description")}</p>

        <Show when={apps.loading}>
          <p class="text-13-regular text-text-weaker">Loading...</p>
        </Show>

        <Show when={!apps.loading && (apps()?.length ?? 0) === 0}>
          <p class="text-13-regular text-text-weaker">No MCP Apps installed from mcp-apps.json.</p>
        </Show>

        <For each={apps()}>
          {(app) => (
            <div class="flex items-center gap-3 p-3 rounded-lg border border-border-base bg-background-subtle">
              <span class="text-lg shrink-0">{app.manifest?.icon ?? "📦"}</span>
              <div class="flex-1 min-w-0">
                <div class="text-14-medium text-text-strong truncate">
                  {app.manifest?.name ?? app.id}
                </div>
                <div class="text-12-regular text-text-weak truncate">
                  {app.manifest?.description ?? app.entry.path}
                </div>
                <div class="text-11-regular text-text-weaker mt-0.5">
                  {app.tier} | {app.entry.source.type}
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleApp(app.id, !app.entry.enabled)}
                  disabled={actionLoading() === app.id}
                  class="p-1.5 rounded text-text-weak hover:text-text-base hover:bg-white/5 transition-colors disabled:opacity-50"
                  title={app.entry.enabled ? "Disable" : "Enable"}
                >
                  <Icon name={app.entry.enabled ? "circle-ban-sign" : "circle-check"} size="small" />
                </button>
                <button
                  onClick={() => removeApp(app.id)}
                  disabled={actionLoading() === app.id}
                  class="p-1.5 rounded text-text-weak hover:text-danger-base hover:bg-white/5 transition-colors disabled:opacity-50"
                  title="Remove"
                >
                  <Icon name="trash" size="small" />
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
