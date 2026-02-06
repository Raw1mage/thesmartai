import { For, Show, type Accessor, type JSX } from "solid-js"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Mark } from "@opencode-ai/ui/logo"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { SessionContextUsage } from "@/components/session-context-usage"
import { DialogSelectFile } from "@/components/dialog-select-file"
import FileTree from "@/components/file-tree"
import { SessionContextTab, SortableTab, FileVisual } from "@/components/session"
import { StickyAddButton } from "./review-tab"
import { ConstrainDragYAxis } from "@/utils/solid-dnd"
import { FileTabContent } from "./file-tabs"

interface SessionSidePanelProps {
  isDesktop: boolean
  language: any
  fileTreeTab: Accessor<string>
  setFileTreeTab: (v: string) => void
  handleDragStart: (e: any) => void
  handleDragEnd: () => void
  handleDragOver: (e: any) => void
  activeTab: Accessor<string>
  openTab: (v: string) => void
  contextOpen: Accessor<boolean>
  tabs: Accessor<any>
  openedTabs: Accessor<string[]>
  command: any
  dialog: any
  showAllFiles: () => void
  messages: Accessor<any[]>
  visibleUserMessages: Accessor<any[]>
  view: Accessor<any>
  info: Accessor<any>
  file: any
  codeComponent: any
  comments: any
  addCommentToContext: (v: any) => void
  activeDraggable: string | undefined
  layout: any
  activeDiff: Accessor<string | undefined>
  focusReviewDiff: (p: string) => void
  reviewCount: Accessor<number>
  diffFiles: Accessor<string[]>
  kinds: Accessor<Map<string, any>>
  reviewPanel: () => JSX.Element
  onCleanup: (fn: () => void) => void
}

export function SessionSidePanel(props: SessionSidePanelProps) {
  return (
    <Show when={props.isDesktop && props.layout.fileTree.opened()}>
      <aside
        id="review-panel"
        aria-label={props.language.t("session.panel.reviewAndFiles")}
        class="relative flex-1 min-w-0 h-full border-l border-border-weak-base flex"
      >
        <div class="flex-1 min-w-0 h-full">
          <Show
            when={props.fileTreeTab() === "changes"}
            fallback={
              <DragDropProvider
                onDragStart={props.handleDragStart}
                onDragEnd={props.handleDragEnd}
                onDragOver={props.handleDragOver}
                collisionDetector={closestCenter}
              >
                <DragDropSensors />
                <ConstrainDragYAxis />
                <Tabs value={props.activeTab()} onChange={props.openTab}>
                  <div class="sticky top-0 shrink-0 flex">
                    <Tabs.List
                      ref={(el: HTMLDivElement) => {
                        let scrollTimeout: number | undefined
                        let prevScrollWidth = el.scrollWidth
                        let prevContextOpen = props.contextOpen()

                        const handler = () => {
                          if (scrollTimeout !== undefined) clearTimeout(scrollTimeout)
                          scrollTimeout = window.setTimeout(() => {
                            const scrollWidth = el.scrollWidth
                            const clientWidth = el.clientWidth
                            const currentContextOpen = props.contextOpen()

                            if (scrollWidth > prevScrollWidth) {
                              if (!prevContextOpen && currentContextOpen) {
                                el.scrollTo({ left: 0, behavior: "smooth" })
                              } else if (scrollWidth > clientWidth) {
                                el.scrollTo({ left: scrollWidth - clientWidth, behavior: "smooth" })
                              }
                            }

                            prevScrollWidth = scrollWidth
                            prevContextOpen = currentContextOpen
                          }, 0)
                        }

                        const wheelHandler = (e: WheelEvent) => {
                          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                            el.scrollLeft += e.deltaY > 0 ? 50 : -50
                            e.preventDefault()
                          }
                        }

                        el.addEventListener("wheel", wheelHandler, { passive: false })
                        const observer = new MutationObserver(handler)
                        observer.observe(el, { childList: true })

                        props.onCleanup(() => {
                          el.removeEventListener("wheel", wheelHandler)
                          observer.disconnect()
                          if (scrollTimeout !== undefined) clearTimeout(scrollTimeout)
                        })
                      }}
                    >
                      <Show when={props.contextOpen()}>
                        <Tabs.Trigger
                          value="context"
                          closeButton={
                            <Tooltip value={props.language.t("common.closeTab")} placement="bottom">
                              <IconButton
                                icon="close-small"
                                variant="ghost"
                                class="h-5 w-5"
                                onClick={() => props.tabs().close("context")}
                                aria-label={props.language.t("common.closeTab")}
                              />
                            </Tooltip>
                          }
                          hideCloseButton
                          onMiddleClick={() => props.tabs().close("context")}
                        >
                          <div class="flex items-center gap-2">
                            <SessionContextUsage variant="indicator" />
                            <div>{props.language.t("session.tab.context")}</div>
                          </div>
                        </Tabs.Trigger>
                      </Show>
                      <SortableProvider ids={props.openedTabs()}>
                        <For each={props.openedTabs()}>
                          {(tab) => <SortableTab tab={tab} onTabClose={props.tabs().close} />}
                        </For>
                      </SortableProvider>
                      <StickyAddButton>
                        <TooltipKeybind
                          title={props.language.t("command.file.open")}
                          keybind={props.command.keybind("file.open")}
                          class="flex items-center"
                        >
                          <IconButton
                            icon="plus-small"
                            variant="ghost"
                            iconSize="large"
                            onClick={() =>
                              props.dialog.show(() => (
                                <DialogSelectFile mode="files" onOpenFile={() => props.showAllFiles()} />
                              ))
                            }
                            aria-label={props.language.t("command.file.open")}
                          />
                        </TooltipKeybind>
                      </StickyAddButton>
                    </Tabs.List>
                  </div>

                  <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                    <Show when={props.activeTab() === "empty"}>
                      <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                        <div class="h-full px-6 pb-42 flex flex-col items-center justify-center text-center gap-6">
                          <Mark class="w-14 opacity-10" />
                          <div class="text-14-regular text-text-weak max-w-56">
                            {props.language.t("session.files.selectToOpen")}
                          </div>
                        </div>
                      </div>
                    </Show>
                  </Tabs.Content>

                  <Show when={props.contextOpen()}>
                    <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                      <Show when={props.activeTab() === "context"}>
                        <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                          <SessionContextTab
                            messages={props.messages}
                            visibleUserMessages={props.visibleUserMessages}
                            view={props.view}
                            info={props.info}
                          />
                        </div>
                      </Show>
                    </Tabs.Content>
                  </Show>

                  <For each={props.openedTabs()}>
                    {(tab) => (
                      <FileTabContent
                        tab={tab}
                        file={props.file}
                        tabs={props.tabs}
                        view={props.view}
                        codeComponent={props.codeComponent}
                        comments={props.comments}
                        language={props.language}
                        activeTab={props.activeTab}
                        addCommentToContext={props.addCommentToContext}
                      />
                    )}
                  </For>
                </Tabs>
                <DragOverlay>
                  <Show when={props.activeDraggable}>
                    {(tab) => {
                      const path = () => props.file.pathFromTab(tab())
                      return (
                        <div class="relative px-6 h-12 flex items-center bg-background-stronger border-x border-border-weak-base border-b border-b-transparent">
                          <Show when={path()}>{(p) => <FileVisual active path={p()} />}</Show>
                        </div>
                      )
                    }}
                  </Show>
                </DragOverlay>
              </DragDropProvider>
            }
          >
            {props.reviewPanel()}
          </Show>
        </div>

        <Show when={props.layout.fileTree.opened()}>
          <div
            id="file-tree-panel"
            class="relative shrink-0 h-full"
            style={{ width: `${props.layout.fileTree.width()}px` }}
          >
            <div class="h-full border-l border-border-weak-base flex flex-col overflow-hidden group/filetree">
              <Tabs
                variant="pill"
                value={props.fileTreeTab()}
                onChange={props.setFileTreeTab}
                class="h-full"
                data-scope="filetree"
              >
                <Tabs.List>
                  <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                    {props.reviewCount()}{" "}
                    {props.language.t(
                      props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other",
                    )}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                    {props.language.t("session.files.all")}
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="changes" class="bg-background-base px-3 py-0">
                  <Show
                    when={props.reviewCount() > 0}
                    fallback={
                      <div class="mt-8 text-center text-12-regular text-text-weak">
                        {props.language.t("session.review.noChanges")}
                      </div>
                    }
                  >
                    <FileTree
                      path=""
                      allowed={props.diffFiles()}
                      kinds={props.kinds()}
                      draggable={false}
                      active={props.activeDiff()}
                      onFileClick={(node: any) => props.focusReviewDiff(node.path)}
                    />
                  </Show>
                </Tabs.Content>
                <Tabs.Content value="all" class="bg-background-base px-3 py-0">
                  <FileTree
                    path=""
                    modified={props.diffFiles()}
                    kinds={props.kinds()}
                    onFileClick={(node: any) => props.openTab(props.file.tab(node.path))}
                  />
                </Tabs.Content>
              </Tabs>
            </div>
            <ResizeHandle
              direction="horizontal"
              edge="start"
              size={props.layout.fileTree.width()}
              min={200}
              max={480}
              collapseThreshold={160}
              onResize={props.layout.fileTree.resize}
              onCollapse={props.layout.fileTree.close}
            />
          </div>
        </Show>
      </aside>
    </Show>
  )
}
