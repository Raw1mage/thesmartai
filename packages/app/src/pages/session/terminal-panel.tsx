import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import { Tabs } from "@opencode-ai/ui/tabs"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { ConstrainDragYAxis } from "@/utils/solid-dnd"
import { SortableTerminalTab } from "@/components/session"
import { Terminal } from "@/components/terminal"
import { useTerminal } from "@/context/terminal"
import { useLanguage } from "@/context/language"
import { useCommand } from "@/context/command"
import { terminalTabLabel } from "@/pages/session/terminal-label"

export function TerminalPanel(props: {
  open: boolean
  height: number
  resize: (value: number) => void
  close: () => void
  terminal: ReturnType<typeof useTerminal>
  language: ReturnType<typeof useLanguage>
  command: ReturnType<typeof useCommand>
  handoff: () => string[]
  activeTerminalDraggable: () => string | undefined
  handleTerminalDragStart: (event: unknown) => void
  handleTerminalDragOver: (event: DragEvent) => void
  handleTerminalDragEnd: () => void
  onCloseTab: () => void
}) {
  const all = createMemo(() => props.terminal.all())
  const ids = createMemo(() => all().map((pty) => pty.id))
  const byId = createMemo(() => new Map(all().map((pty) => [pty.id, pty])))
  const [popoutRoot, setPopoutRoot] = createSignal<HTMLElement | undefined>()
  const [popoutWindow, setPopoutWindow] = createSignal<Window | undefined>()
  const [skipNextInlineRestore, setSkipNextInlineRestore] = createSignal(false)

  const sessionTitle = () => {
    if (typeof document === "undefined") return "Session"
    return (document.title || "Session").trim()
  }

  const popoutTitle = () => `${sessionTitle()} · ${props.language.t("terminal.title")}`

  const closePopout = () => {
    const win = popoutWindow()
    setSkipNextInlineRestore(true)
    if (win && !win.closed) win.close()
    setPopoutWindow(undefined)
    setPopoutRoot(undefined)
  }

  const togglePopout = () => {
    const current = popoutWindow()
    if (current && !current.closed) {
      closePopout()
      return
    }

    const width = Math.max(900, Math.floor(window.innerWidth * 0.55))
    const height = Math.max(520, Math.floor(window.innerHeight * 0.55))
    const left = Math.max(20, Math.floor(window.screenX + (window.outerWidth - width) / 2))
    const top = Math.max(20, Math.floor(window.screenY + (window.outerHeight - height) / 2))
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    const win = window.open("", "opencode-terminal-popout", features)
    if (!win) return

    const syncTheme = () => {
      const srcHtml = document.documentElement
      const dstHtml = win.document.documentElement
      dstHtml.className = srcHtml.className
      dstHtml.setAttribute("data-theme", srcHtml.getAttribute("data-theme") ?? "")
      dstHtml.setAttribute("style", srcHtml.getAttribute("style") ?? "")

      const srcBody = document.body
      const dstBody = win.document.body
      dstBody.className = srcBody.className
      dstBody.setAttribute("style", srcBody.getAttribute("style") ?? "")
    }

    win.document.title = popoutTitle()
    win.document.body.innerHTML = ""
    syncTheme()
    win.document.body.style.margin = "0"
    win.document.body.style.background = "var(--background-base)"

    for (const styleTag of Array.from(document.querySelectorAll("style"))) {
      win.document.head.appendChild(styleTag.cloneNode(true))
    }
    for (const linkTag of Array.from(document.querySelectorAll("link[rel='stylesheet']"))) {
      win.document.head.appendChild(linkTag.cloneNode(true))
    }

    const antiSelectStyle = win.document.createElement("style")
    antiSelectStyle.textContent = `
      #terminal-popout-root,
      #terminal-popout-root * {
        -webkit-user-select: none !important;
        user-select: none !important;
      }
    `
    win.document.head.appendChild(antiSelectStyle)

    const root = win.document.createElement("div")
    root.id = "terminal-popout-root"
    root.style.width = "100vw"
    root.style.height = "100vh"
    root.style.overflow = "hidden"
    root.style.position = "fixed"
    root.style.inset = "0"
    win.document.body.appendChild(root)

    const onClosed = () => {
      setPopoutWindow(undefined)
      setPopoutRoot(undefined)
    }
    win.addEventListener("beforeunload", onClosed)

    const observer = new MutationObserver(() => syncTheme())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] })
    win.addEventListener("beforeunload", () => observer.disconnect(), { once: true })

    setPopoutWindow(win)
    setPopoutRoot(root)
    win.focus()
  }

  createEffect(() => {
    const win = popoutWindow()
    if (!win) return
    if (win.closed) {
      setPopoutWindow(undefined)
      setPopoutRoot(undefined)
    }
  })

  createEffect(() => {
    const win = popoutWindow()
    if (!win || win.closed) return
    win.document.title = popoutTitle()
  })

  createEffect(() => {
    if (popoutWindow()) return
    if (!skipNextInlineRestore()) return
    queueMicrotask(() => setSkipNextInlineRestore(false))
  })

  onCleanup(() => {
    closePopout()
  })

  return (
    <Show when={props.open}>
      <div
        id="terminal-panel"
        role="region"
        aria-label={props.language.t("terminal.title")}
        class="relative w-full flex flex-col shrink-0 border-t border-border-weak-base"
        style={{ height: `${props.height}px` }}
      >
        <ResizeHandle
          direction="vertical"
          size={props.height}
          min={100}
          max={typeof window === "undefined" ? 1000 : window.innerHeight * 0.6}
          collapseThreshold={50}
          onResize={props.resize}
          onCollapse={props.close}
        />
        <Show
          when={props.terminal.ready()}
          fallback={
            <div class="flex flex-col h-full pointer-events-none">
              <div class="h-10 flex items-center gap-2 px-2 border-b border-border-weak-base bg-background-stronger overflow-hidden">
                <For each={props.handoff()}>
                  {(title) => (
                    <div class="px-2 py-1 rounded-md bg-surface-base text-14-regular text-text-weak truncate max-w-40">
                      {title}
                    </div>
                  )}
                </For>
                <div class="flex-1" />
                <div class="text-text-weak pr-2">
                  {props.language.t("common.loading")}
                  {props.language.t("common.loading.ellipsis")}
                </div>
              </div>
              <div class="flex-1 flex items-center justify-center text-text-weak">
                {props.language.t("terminal.loading")}
              </div>
            </div>
          }
        >
          <DragDropProvider
            onDragStart={props.handleTerminalDragStart}
            onDragEnd={props.handleTerminalDragEnd}
            onDragOver={props.handleTerminalDragOver}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <ConstrainDragYAxis />
            <div class="flex flex-col h-full">
              <Tabs
                variant="alt"
                value={props.terminal.active()}
                onChange={(id) => props.terminal.open(id)}
                class="!h-auto !flex-none"
              >
                <Tabs.List class="h-10">
                  <SortableProvider ids={ids()}>
                    <For each={all()}>
                      {(pty) => (
                        <SortableTerminalTab
                          terminal={pty}
                          onClose={() => {
                            props.close()
                            props.onCloseTab()
                          }}
                        />
                      )}
                    </For>
                  </SortableProvider>
                  <div class="h-full flex items-center justify-center">
                    <TooltipKeybind title="Pop out terminal" keybind="" class="flex items-center">
                      <IconButton
                        icon={popoutWindow() ? "layout-bottom-full" : "square-arrow-top-right"}
                        variant="ghost"
                        iconSize="large"
                        onClick={togglePopout}
                        aria-label="Pop out terminal"
                      />
                    </TooltipKeybind>
                    <TooltipKeybind
                      title={props.language.t("command.terminal.new")}
                      keybind={props.command.keybind("terminal.new")}
                      class="flex items-center"
                    >
                      <IconButton
                        icon="plus-small"
                        variant="ghost"
                        iconSize="large"
                        onClick={props.terminal.new}
                        aria-label={props.language.t("command.terminal.new")}
                      />
                    </TooltipKeybind>
                  </div>
                </Tabs.List>
              </Tabs>
              <div class="flex-1 min-h-0 relative">
                <Show
                  when={!popoutWindow()}
                  fallback={
                    <div class="h-full flex items-center justify-center text-text-weak">Terminal popped out</div>
                  }
                >
                  <Show when={props.terminal.active()} keyed>
                    {(id) => (
                      <Show when={byId().get(id)}>
                        {(pty) => (
                          <div id={`terminal-wrapper-${id}`} class="absolute inset-0">
                            <Terminal
                              pty={pty()}
                              skipRestore={skipNextInlineRestore()}
                              disableMouseSelection={false}
                              onCleanup={props.terminal.update}
                              onConnectError={() => props.terminal.clone(id)}
                            />
                          </div>
                        )}
                      </Show>
                    )}
                  </Show>
                </Show>
              </div>
            </div>
            <Show when={popoutRoot()} keyed>
              {(mount) => (
                <Portal mount={mount}>
                  <Show when={props.terminal.active()} keyed>
                    {(id) => (
                      <Show when={byId().get(id)}>
                        {(pty) => (
                          <div class="absolute inset-0">
                            <Terminal
                              pty={pty()}
                              skipRestore
                              disableMouseSelection
                              onCleanup={props.terminal.update}
                              onConnectError={() => props.terminal.clone(id)}
                            />
                          </div>
                        )}
                      </Show>
                    )}
                  </Show>
                </Portal>
              )}
            </Show>
            <DragOverlay>
              <Show when={props.activeTerminalDraggable()}>
                {(draggedId) => {
                  return (
                    <Show when={byId().get(draggedId())}>
                      {(t) => (
                        <div class="relative p-1 h-10 flex items-center bg-background-stronger text-14-regular">
                          {terminalTabLabel({
                            title: t().title,
                            titleNumber: t().titleNumber,
                            t: props.language.t as (
                              key: string,
                              vars?: Record<string, string | number | boolean>,
                            ) => string,
                          })}
                        </div>
                      )}
                    </Show>
                  )
                }}
              </Show>
            </DragOverlay>
          </DragDropProvider>
        </Show>
      </div>
    </Show>
  )
}
