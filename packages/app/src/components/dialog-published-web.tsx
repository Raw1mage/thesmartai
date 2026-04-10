import { createEffect, createMemo, createSignal, For, on, Show, type Component } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { useGlobalSDK } from "@/context/global-sdk"
import { createWebRouteApi, type WebRoute } from "@/pages/web-routes/api"

function routeUrl(route: WebRoute): string {
  return `${window.location.origin}${route.prefix}${route.prefix.endsWith("/") ? "" : "/"}`
}

function groupRoutes(routes: WebRoute[]): WebRoute[] {
  const stems = new Map<string, WebRoute>()
  for (const r of routes) {
    const stem = r.prefix.replace(/\/api$/, "")
    const existing = stems.get(stem)
    if (!existing || r.prefix.length < existing.prefix.length) {
      stems.set(stem, r)
    }
  }
  return Array.from(stems.values()).sort((a, b) => a.prefix.localeCompare(b.prefix))
}

export const DialogPublishedWeb: Component = () => {
  const globalSDK = useGlobalSDK()
  const api = createMemo(() => createWebRouteApi(globalSDK.url, globalSDK.fetch))

  const [routes, setRoutes] = createSignal<WebRoute[]>([])
  const [loading, setLoading] = createSignal(true)
  const grouped = createMemo(() => groupRoutes(routes()))

  async function refresh() {
    try {
      const data = await api().list()
      setRoutes(data)
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }

  createEffect(on(() => globalSDK.url, () => void refresh()))

  async function handleRemove(route: WebRoute) {
    if (!confirm(`Remove published route "${route.prefix}"?`)) return
    try {
      await api().remove(route.prefix)
      const apiPrefix = route.prefix.replace(/\/$/, "") + "/api"
      if (routes().some((r) => r.prefix === apiPrefix)) {
        await api().remove(apiPrefix)
      }
      await refresh()
    } catch {
      // ignore
    }
  }

  return (
    <Dialog
      title={
        <div class="flex min-w-0 flex-1 items-center gap-4">
          <span>Published Web</span>
          <span class="text-13-regular text-text-weak">{grouped().length} route(s)</span>
          <button
            onClick={() => void refresh()}
            class="ml-auto mr-8 shrink-0 px-2.5 py-1 rounded-sm border border-border-base bg-background-input text-12-regular text-text-base hover:bg-white/5 transition-colors cursor-pointer"
          >
            Refresh
          </button>
        </div>
      }
      size="large"
    >
      <Show when={loading()}>
        <div class="flex items-center justify-center py-12 px-4 text-text-weak text-13-regular">
          Loading...
        </div>
      </Show>

      <Show when={!loading() && grouped().length === 0}>
        <div class="flex flex-col items-center justify-center py-12 px-4 gap-2">
          <Icon name="globe" size="medium" class="text-icon-dimmed" />
          <p class="text-13-regular text-text-weak">No published routes</p>
          <p class="text-12-regular text-text-weaker">Use webctl.sh publish-route to register a web app</p>
        </div>
      </Show>

      <Show when={!loading() && grouped().length > 0}>
        <div class="flex flex-col gap-1 py-1">
          <For each={grouped()}>
            {(route) => {
              const url = () => routeUrl(route)
              const label = () => route.prefix.replace(/^\/|\/$/g, "") || "/"

              return (
                <div class="group/route flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div class="shrink-0">
                    <Icon name="globe" size="small" class="text-icon-base" />
                  </div>
                  <a
                    href={url()}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex-1 min-w-0 no-underline cursor-pointer"
                  >
                    <div class="text-14-medium text-text-strong truncate">{label()}</div>
                    <div class="text-12-regular text-text-weak truncate">{route.host}:{route.port}</div>
                  </a>
                  <div class="shrink-0 opacity-0 group-hover/route:opacity-100 transition-opacity">
                    <Icon name="share" size="small" class="text-icon-dimmed" />
                  </div>
                  <DropdownMenu placement="bottom-end">
                    <DropdownMenu.Trigger class="shrink-0 flex items-center justify-center size-6 rounded-md opacity-0 group-hover/route:opacity-100 text-icon-base hover:bg-white/10 cursor-pointer transition-opacity">
                      <Icon name="dot-grid" size="small" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item onSelect={() => window.open(url(), "_blank")}>
                        <DropdownMenu.ItemLabel>Open in new tab</DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onSelect={() => void navigator.clipboard.writeText(url())}>
                        <DropdownMenu.ItemLabel>Copy URL</DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onSelect={() => void handleRemove(route)}>
                        <DropdownMenu.ItemLabel>Remove route</DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </Dialog>
  )
}
