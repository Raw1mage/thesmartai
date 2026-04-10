import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { useGlobalSDK } from "@/context/global-sdk"
import { createWebRouteApi, type WebRoute } from "./api"

/**
 * Resolve the public URL for a web route prefix.
 * In production behind the gateway, the route is on the same origin.
 * In dev, fall back to `host:port` directly.
 */
function routeUrl(route: WebRoute): string {
  // If we're on a gateway domain, the prefix is a path on the same host
  const origin = window.location.origin
  return `${origin}${route.prefix}${route.prefix.endsWith("/") ? "" : "/"}`
}

/** Group routes by prefix stem (strip /api suffix) to avoid duplicate entries */
function groupRoutes(routes: WebRoute[]): WebRoute[] {
  // Show the shortest prefix per stem (e.g. /cecelearn, not /cecelearn/api)
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

export function WebRouteSidebar() {
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

  createEffect(
    on(
      () => globalSDK.url,
      () => {
        void refresh()
      },
    ),
  )

  async function handleRemove(route: WebRoute) {
    if (!confirm(`Remove published route "${route.prefix}"?`)) return
    try {
      await api().remove(route.prefix)
      // Also try removing /api sub-route if it exists
      const apiPrefix = route.prefix.replace(/\/$/, "") + "/api"
      const hasApiRoute = routes().some((r) => r.prefix === apiPrefix)
      if (hasApiRoute) {
        await api().remove(apiPrefix)
      }
      await refresh()
    } catch {
      // ignore
    }
  }

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border-base">
        <div class="flex items-center gap-1.5">
          <Icon name="globe" size="small" class="text-icon-base" />
          <span class="text-13-semibold text-color-primary">Published Web</span>
        </div>
        <button
          class="text-11-medium px-1.5 py-0.5 rounded text-color-dimmed hover:text-color-secondary transition-colors cursor-pointer"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      {/* Route list */}
      <div class="flex-1 overflow-y-auto">
        <Show when={loading()}>
          <div class="px-3 py-6 text-center text-12-medium text-color-dimmed">Loading...</div>
        </Show>

        <Show when={!loading() && grouped().length === 0}>
          <div class="px-3 py-8 text-center">
            <Icon name="globe" size="medium" class="text-color-dimmed mx-auto mb-2" />
            <p class="text-12-medium text-color-dimmed">No published routes</p>
            <p class="text-11-medium text-color-dimmed mt-1">
              Use webctl.sh publish-route to register a web app
            </p>
          </div>
        </Show>

        <Show when={!loading() && grouped().length > 0}>
          <div class="py-1">
            <For each={grouped()}>
              {(route) => (
                <WebRouteItem
                  route={route}
                  onRemove={() => void handleRemove(route)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

function WebRouteItem(props: {
  route: WebRoute
  onRemove: () => void
}) {
  const url = createMemo(() => routeUrl(props.route))
  const label = createMemo(() => {
    // "/cecelearn/" → "cecelearn"
    return props.route.prefix.replace(/^\/|\/$/g, "") || "/"
  })

  return (
    <div class="group/route w-full flex items-center gap-1 pr-1 hover:bg-background-hover transition-colors">
      {/* Main clickable area — opens in new tab */}
      <a
        href={url()}
        target="_blank"
        rel="noopener noreferrer"
        class="flex-1 min-w-0 px-3 py-2 flex items-start gap-2.5 text-left cursor-pointer no-underline"
      >
        <div class="shrink-0 mt-0.5">
          <Icon name="globe" size="small" class="text-icon-base" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-13-medium text-color-primary truncate">{label()}</div>
          <div class="text-11-medium text-color-dimmed truncate">
            {props.route.host}:{props.route.port}
          </div>
        </div>
        <div class="shrink-0 mt-0.5 opacity-0 group-hover/route:opacity-100 transition-opacity">
          <Icon name="share" size="small" class="text-icon-dimmed" />
        </div>
      </a>

      {/* Kebab menu */}
      <DropdownMenu placement="bottom-end">
        <DropdownMenu.Trigger class="shrink-0 flex items-center justify-center size-6 rounded-md opacity-0 group-hover/route:opacity-100 text-icon-base hover:bg-surface-raised-base-hover cursor-pointer transition-opacity">
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
          <DropdownMenu.Item onSelect={props.onRemove}>
            <DropdownMenu.ItemLabel>Remove route</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  )
}
