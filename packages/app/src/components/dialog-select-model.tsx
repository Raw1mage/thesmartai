import { Popover as Kobalte } from "@kobalte/core/popover"
import {
  Component,
  ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  Show,
  ValidComponent,
} from "solid-js"
import { createStore } from "solid-js/store"
import { useLocal } from "@/context/local"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { popularProviders } from "@/hooks/use-providers"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tag } from "@opencode-ai/ui/tag"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { DialogSelectProvider } from "./dialog-select-provider"
import { DialogManageModels } from "./dialog-manage-models"
import { ModelTooltip } from "./model-tooltip"
import { useLanguage } from "@/context/language"
import { useModels, ModelKey } from "@/context/models"
import { Icon } from "@opencode-ai/ui/icon"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { TextField } from "@opencode-ai/ui/text-field"
import type { IconName } from "@opencode-ai/ui/icons/provider"

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ")
}

const isFree = (provider: string, cost: { input: number } | undefined) =>
  provider === "opencode" && (!cost || cost.input === 0)

const ModelList: Component<{
  provider?: string
  class?: string
  onSelect: () => void
  action?: JSX.Element
}> = (props) => {
  const local = useLocal()
  const language = useLanguage()

  const models = createMemo(() =>
    local.model
      .list()
      .filter((m) => local.model.visible({ modelID: m.id, providerID: m.provider.id }))
      .filter((m) => (props.provider ? m.provider.id === props.provider : true)),
  )

  return (
    <List
      class={`flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0 ${props.class ?? ""}`}
      search={{ placeholder: language.t("dialog.model.search.placeholder"), autofocus: true, action: props.action }}
      emptyMessage={language.t("dialog.model.empty")}
      key={(x) => `${x.provider.id}:${x.id}`}
      items={models}
      current={local.model.current()}
      filterKeys={["provider.name", "name", "id"]}
      sortBy={(a, b) => a.name.localeCompare(b.name)}
      groupBy={(x) => x.provider.name}
      sortGroupsBy={(a, b) => {
        const aProvider = a.items[0].provider.id
        const bProvider = b.items[0].provider.id
        if (popularProviders.includes(aProvider) && !popularProviders.includes(bProvider)) return -1
        if (!popularProviders.includes(aProvider) && popularProviders.includes(bProvider)) return 1
        return popularProviders.indexOf(aProvider) - popularProviders.indexOf(bProvider)
      }}
      itemWrapper={(item, node) => (
        <Tooltip
          class="w-full"
          placement="right-start"
          gutter={12}
          value={<ModelTooltip model={item} latest={item.latest} free={isFree(item.provider.id, item.cost)} />}
        >
          {node}
        </Tooltip>
      )}
      onSelect={(x) => {
        local.model.set(x ? { modelID: x.id, providerID: x.provider.id } : undefined, {
          recent: true,
        })
        props.onSelect()
      }}
    >
      {(i) => (
        <div class="w-full flex items-center gap-x-2 text-13-regular">
          <span class="truncate">{i.name}</span>
          <Show when={isFree(i.provider.id, i.cost)}>
            <Tag>{language.t("model.tag.free")}</Tag>
          </Show>
          <Show when={i.latest}>
            <Tag>{language.t("model.tag.latest")}</Tag>
          </Show>
        </div>
      )}
    </List>
  )
}

type ModelSelectorTriggerProps = Omit<ComponentProps<typeof Kobalte.Trigger>, "as" | "ref">

export function ModelSelectorPopover(props: {
  provider?: string
  children?: JSX.Element
  triggerAs?: ValidComponent
  triggerProps?: ModelSelectorTriggerProps
}) {
  const [store, setStore] = createStore<{
    open: boolean
    dismiss: "escape" | "outside" | null
  }>({
    open: false,
    dismiss: null,
  })
  const dialog = useDialog()

  const handleManage = () => {
    setStore("open", false)
    dialog.show(() => <DialogManageModels />)
  }

  const handleConnectProvider = () => {
    setStore("open", false)
    dialog.show(() => <DialogSelectProvider />)
  }
  const language = useLanguage()

  return (
    <Kobalte
      open={store.open}
      onOpenChange={(next) => {
        if (next) setStore("dismiss", null)
        setStore("open", next)
      }}
      modal={false}
      placement="top-start"
      gutter={8}
    >
      <Kobalte.Trigger as={props.triggerAs ?? "div"} {...props.triggerProps}>
        {props.children}
      </Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content
          class="w-72 h-80 flex flex-col p-2 rounded-md border border-border-base bg-surface-raised-stronger-non-alpha shadow-md z-50 outline-none overflow-hidden"
          onEscapeKeyDown={(event) => {
            setStore("dismiss", "escape")
            setStore("open", false)
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDownOutside={() => {
            setStore("dismiss", "outside")
            setStore("open", false)
          }}
          onFocusOutside={() => {
            setStore("dismiss", "outside")
            setStore("open", false)
          }}
          onCloseAutoFocus={(event) => {
            if (store.dismiss === "outside") event.preventDefault()
            setStore("dismiss", null)
          }}
        >
          <Kobalte.Title class="sr-only">{language.t("dialog.model.select.title")}</Kobalte.Title>
          <ModelList
            provider={props.provider}
            onSelect={() => setStore("open", false)}
            class="p-1"
            action={
              <div class="flex items-center gap-1">
                <Tooltip placement="top" value={language.t("command.provider.connect")}>
                  <IconButton
                    icon="plus-small"
                    variant="ghost"
                    iconSize="normal"
                    class="size-6"
                    aria-label={language.t("command.provider.connect")}
                    onClick={handleConnectProvider}
                  />
                </Tooltip>
                <Tooltip placement="top" value={language.t("dialog.model.manage")}>
                  <IconButton
                    icon="sliders"
                    variant="ghost"
                    iconSize="normal"
                    class="size-6"
                    aria-label={language.t("dialog.model.manage")}
                    onClick={handleManage}
                  />
                </Tooltip>
              </div>
            }
          />
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}

const ProviderItem: Component<{
  id: string
  name: string
  icon?: string
  providerIcon?: string
  selected: boolean
  onClick: () => void
}> = (props) => {
  return (
    <button
      class={cn(
        "flex items-center gap-2 w-full px-3 py-2 text-13-regular rounded-md transition-colors text-left outline-none",
        props.selected ? "bg-surface-raised-pressed text-text-strong" : "text-text-base hover:bg-surface-raised-hover",
      )}
      onClick={props.onClick}
    >
      <Show when={props.providerIcon} fallback={<Icon name={props.icon as any} class="size-4 shrink-0" />}>
        <ProviderIcon id={props.providerIcon as IconName} class="size-4 shrink-0" />
      </Show>
      <span class="truncate flex-1">{props.name}</span>
    </button>
  )
}

const ModelItem: Component<{
  item: ReturnType<ReturnType<typeof useModels>["list"]>[number]
  selected: boolean
  favorite: boolean
  onToggleFavorite: (e: MouseEvent) => void
}> = (props) => {
  const language = useLanguage()

  return (
    <div class="flex items-center gap-2 w-full group">
      <div class="flex-1 min-w-0 flex items-center gap-2">
        <span class={cn("truncate", props.selected && "text-text-strong")}>{props.item.name}</span>
        <Show when={props.item.provider.id === "opencode" && (!props.item.cost || props.item.cost?.input === 0)}>
          <Tag>{language.t("model.tag.free")}</Tag>
        </Show>
        <Show when={props.item.latest}>
          <Tag>{language.t("model.tag.latest")}</Tag>
        </Show>
      </div>
      <IconButton
        icon={props.favorite ? "star-filled" : "star"}
        variant="ghost"
        class={cn(
          "size-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
          props.favorite && "opacity-100 text-yellow-400 hover:text-yellow-500",
          !props.favorite && "text-icon-weak-base hover:text-icon-base",
        )}
        onClick={props.onToggleFavorite}
      />
    </div>
  )
}

export const DialogSelectModel: Component<{ provider?: string }> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const local = useLocal()
  const modelsContext = useModels()

  const [selectedProviderId, setSelectedProviderId] = createSignal<string>(props.provider || "all")
  const [search, setSearch] = createSignal("")

  const providers = createMemo(() => {
    const list = local.model.list()
    const uniqueProviders = new Map<string, { id: string; name: string }>()

    list.forEach((m) => {
      if (!uniqueProviders.has(m.provider.id)) {
        uniqueProviders.set(m.provider.id, { id: m.provider.id, name: m.provider.name })
      }
    })

    return Array.from(uniqueProviders.values()).sort((a, b) => {
      const aIdx = popularProviders.indexOf(a.id)
      const bIdx = popularProviders.indexOf(b.id)

      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  })

  const filteredModels = createMemo(() => {
    const providerId = selectedProviderId()
    const query = search().toLowerCase()

    return local.model
      .list()
      .filter((m) => {
        if (!local.model.visible({ modelID: m.id, providerID: m.provider.id })) return false

        if (providerId === "favorites") {
          return modelsContext.isFavorite({ modelID: m.id, providerID: m.provider.id })
        }
        if (providerId === "all") return true
        return m.provider.id === providerId
      })
      .filter((m) => {
        if (!query) return true
        return m.name.toLowerCase().includes(query) || m.provider.name.toLowerCase().includes(query)
      })
  })

  const handleToggleFavorite = (e: MouseEvent, model: ModelKey) => {
    e.stopPropagation()
    e.preventDefault()
    modelsContext.toggleFavorite(model)
  }

  return (
    <Dialog
      title={language.t("dialog.model.select.title") + " (v2)"}
      class="w-[800px] max-w-[90vw] h-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden"
    >
      <div class="flex flex-1 min-h-0 h-full overflow-hidden">
        <div class="w-64 flex-shrink-0 border-r border-border-base flex flex-col bg-surface-base">
          <div class="p-2 space-y-1 overflow-y-auto flex-1">
            <div class="px-3 py-2 text-11-medium text-text-weak uppercase tracking-wider">
              {language.t("common.favorites")}
            </div>
            <ProviderItem
              id="favorites"
              name={language.t("common.favorites")}
              icon="star"
              selected={selectedProviderId() === "favorites"}
              onClick={() => setSelectedProviderId("favorites")}
            />

            <div class="mt-4 px-3 py-2 text-11-medium text-text-weak uppercase tracking-wider">
              {language.t("common.providers")}
            </div>
            <ProviderItem
              id="all"
              name={language.t("common.all")}
              icon="globe"
              selected={selectedProviderId() === "all"}
              onClick={() => setSelectedProviderId("all")}
            />
            <For each={providers()}>
              {(provider) => (
                <ProviderItem
                  id={provider.id}
                  name={provider.name}
                  providerIcon={provider.id}
                  selected={selectedProviderId() === provider.id}
                  onClick={() => setSelectedProviderId(provider.id)}
                />
              )}
            </For>
          </div>

          <div class="p-2 border-t border-border-base space-y-1">
            <Button
              variant="ghost"
              class="w-full justify-start text-text-weak hover:text-text-base h-8"
              icon="plus-small"
              onClick={() => dialog.show(() => <DialogSelectProvider />)}
            >
              {language.t("command.provider.connect")}
            </Button>
            <Button
              variant="ghost"
              class="w-full justify-start text-text-weak hover:text-text-base h-8"
              icon="sliders"
              onClick={() => dialog.show(() => <DialogManageModels />)}
            >
              {language.t("dialog.model.manage")}
            </Button>
          </div>
        </div>

        <div class="flex-1 flex flex-col min-w-0 bg-surface-raised-base">
          <div class="p-3 border-b border-border-base bg-surface-base">
            <TextField
              class="w-full"
              placeholder={language.t("dialog.model.search.placeholder")}
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              autofocus
              icon="magnifying-glass"
            />
          </div>

          <div class="flex-1 overflow-hidden relative">
            <List
              class="h-full [&_[data-slot=list-scroll]]:h-full [&_[data-slot=list-scroll]]:p-2"
              items={filteredModels()}
              key={(x) => `${x.provider.id}:${x.id}`}
              current={local.model.current()}
              filterKeys={["provider.name", "name", "id"]}
              sortBy={(a, b) => {
                const favA = modelsContext.isFavorite({ modelID: a.id, providerID: a.provider.id })
                const favB = modelsContext.isFavorite({ modelID: b.id, providerID: b.provider.id })
                if (favA && !favB) return -1
                if (!favA && favB) return 1
                return a.name.localeCompare(b.name)
              }}
              itemWrapper={(item, node) => (
                <Tooltip
                  class="w-full"
                  placement="right"
                  gutter={12}
                  value={
                    <ModelTooltip
                      model={item}
                      latest={item.latest}
                      free={item.provider.id === "opencode" && (!item.cost || item.cost.input === 0)}
                    />
                  }
                >
                  {node}
                </Tooltip>
              )}
              onSelect={(x) => {
                if (!x) return
                local.model.set(
                  { modelID: x.id, providerID: x.provider.id },
                  {
                    recent: true,
                  },
                )
                dialog.close()
              }}
            >
              {(item) => (
                <ModelItem
                  item={item}
                  selected={false}
                  favorite={modelsContext.isFavorite({ modelID: item.id, providerID: item.provider.id })}
                  onToggleFavorite={(e) => handleToggleFavorite(e, { modelID: item.id, providerID: item.provider.id })}
                />
              )}
            </List>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
