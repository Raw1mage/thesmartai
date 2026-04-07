import { Component, createMemo, Show, Switch, Match, For, createSignal, createEffect, onCleanup } from "solid-js"
import { ToolPart, AssistantMessage, Part as PartType } from "@opencode-ai/sdk/v2"
import { BasicTool } from "@opencode-ai/ui/basic-tool"
import { Icon } from "@opencode-ai/ui/icon"
import { Card } from "@opencode-ai/ui/card"
import { Button } from "@opencode-ai/ui/button"
import { Markdown } from "@opencode-ai/ui/markdown"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { getFilename, getDirectory } from "@opencode-ai/util/path"
import stripAnsi from "strip-ansi"

export interface MessageToolInvocationProps {
  part: ToolPart
  message: AssistantMessage
}

export const MessageToolInvocation: Component<MessageToolInvocationProps> = (props) => {
  const language = useLanguage()
  const sync = useSync()
  const sdk = useSDK()

  const permission = createMemo(() => {
    const next = sync.data.permission[props.message.sessionID]?.[0]
    if (!next || !next.tool) return undefined
    if (next.tool!.callID !== props.part.callID) return undefined
    return next
  })

  const [showPermission, setShowPermission] = createSignal(false)

  createEffect(() => {
    if (permission()) {
      const timeout = setTimeout(() => setShowPermission(true), 50)
      onCleanup(() => clearTimeout(timeout))
    } else {
      setShowPermission(false)
    }
  })

  const respond = (response: "once" | "always" | "reject") => {
    const perm = permission()
    if (!perm) return
    sdk.client.permission.respond({
      sessionID: perm.sessionID,
      permissionID: perm.id,
      response,
    })
  }

  const input = () => props.part.state?.input ?? {}
  const output = () => (props.part.state as any)?.output ?? ""
  const status = () => props.part.state?.status

  return (
    <div data-component="tool-part-wrapper" class="my-2" classList={{ "border-l-2 border-accent-primary pl-4": showPermission() }}>
      <Switch>
        <Match when={status() === "error" && props.part.tool === "task" && (props.part.state as any).error}>
          {(error) => (
            <SubagentActivityCard part={props.part} errorText={String(error()).replace("Error: ", "")} />
          )}
        </Match>
        <Match when={status() === "error" && (props.part.state as any).error}>
          {(error) => (
            <Card variant="error" class="p-3 flex items-start gap-2">
              <Icon name="circle-ban-sign" class="size-4 shrink-0 mt-0.5" />
              <div class="text-12-regular text-text-strong break-words">
                {String(error()).replace("Error: ", "")}
              </div>
            </Card>
          )}
        </Match>
        <Match when={props.part.tool === "bash"}>
          <BasicTool
            icon="console"
            trigger={{
              title: language.t("settings.permissions.tool.bash.title"),
              subtitle: String(input().description || ""),
            }}
          >
            <div class="mt-2 rounded bg-background-strong p-2 overflow-x-auto overflow-y-auto max-h-60" data-scrollable>
              <Markdown
                text={`\`\`\`command\n$ ${input().command ?? ""}${output() ? "\n\n" + stripAnsi(output()) : ""}\n\`\`\``}
              />
            </div>
          </BasicTool>
        </Match>
        <Match when={props.part.tool === "edit" || props.part.tool === "write"}>
           <BasicTool
            icon="code-lines"
            trigger={{
              title: language.t(props.part.tool === "edit" ? "settings.permissions.tool.edit.title" : "settings.permissions.tool.edit.title"),
              subtitle: getFilename(String(input().filePath || "")),
            }}
          >
            <div class="mt-1 text-11-regular text-text-weak px-2">
              {getDirectory(String(input().filePath || ""))}
            </div>
          </BasicTool>
        </Match>
        <Match when={props.part.tool === "task"}>
          <SubagentActivityCard part={props.part} />
        </Match>
        <Match when={true}>
          <DefaultMcpTool part={props.part} input={input} status={status} />
        </Match>
      </Switch>

      <Show when={showPermission() && permission()}>
        <div class="mt-3 flex items-center justify-end gap-2 p-2 bg-surface-base rounded-md border border-border-base">
          <Button variant="ghost" size="small" onClick={() => respond("reject")}>
            {language.t("common.dismiss")}
          </Button>
          <Button variant="secondary" size="small" onClick={() => respond("always")}>
            {language.t("common.save")}
          </Button>
          <Button variant="primary" size="small" onClick={() => respond("once")}>
            {language.t("common.submit")}
          </Button>
        </div>
      </Show>
    </div>
  )
}

// --- Subagent Activity Card ---

interface SubagentActivityCardProps {
  part: ToolPart
  errorText?: string
}

const SubagentActivityCard: Component<SubagentActivityCardProps> = (props) => {
  const sync = useSync()

  const agentType = () => String(props.part.state?.input?.subagent_type ?? "agent")
  const description = () => String(props.part.state?.input?.description ?? "")
  const partStatus = () => props.part.state?.status
  const isRunning = () => partStatus() === "running" || partStatus() === "pending"
  const isCompleted = () => partStatus() === "completed"
  const isError = () => partStatus() === "error"

  const childSessionId = createMemo(() => {
    const state = props.part.state as any
    return state?.metadata?.sessionId as string | undefined
  })

  // Trigger sync for child session messages when we have the sessionId
  createEffect(() => {
    const sid = childSessionId()
    if (!sid) return
    sync.session.sync(sid)
    // Re-sync periodically while running
    if (!isRunning()) return
    const interval = setInterval(() => sync.session.sync(sid, { force: true }), 3000)
    onCleanup(() => clearInterval(interval))
  })

  const childMessages = createMemo(() => {
    const sid = childSessionId()
    if (!sid) return []
    return sync.data.message[sid] ?? []
  })

  // Extract activity items from child session: tool calls and text parts
  const activityItems = createMemo(() => {
    const msgs = childMessages()
    const items: Array<{ type: "tool" | "text"; tool?: string; toolTitle?: string; toolSubtitle?: string; text?: string; status?: string }> = []
    for (const msg of msgs) {
      if (msg.role !== "assistant") continue
      const parts = sync.data.part[msg.id] ?? []
      for (const part of parts) {
        if (part.type === "tool") {
          const tp = part as PartType & { type: "tool"; tool: string; state: any }
          const toolStatus = tp.state?.status ?? "pending"
          const toolTitle = tp.state?.title ?? tp.tool
          const toolSubtitle = tp.state?.input?.description || tp.state?.input?.command || ""
          items.push({
            type: "tool",
            tool: tp.tool,
            toolTitle: String(toolTitle),
            toolSubtitle: String(toolSubtitle),
            status: toolStatus,
          })
        }
        if (part.type === "text") {
          const tp = part as PartType & { type: "text"; text: string }
          if (tp.text?.trim()) {
            items.push({ type: "text", text: tp.text })
          }
        }
      }
    }
    return items
  })

  // For completed state, extract final text output
  const finalOutput = createMemo(() => {
    const state = props.part.state as any
    if (state?.status !== "completed") return ""
    const raw = state?.output ?? ""
    // Strip <task_metadata> block from output
    return raw.replace(/<task_metadata>[\s\S]*?<\/task_metadata>/g, "").trim()
  })

  const elapsed = createMemo(() => {
    const state = props.part.state as any
    if (state?.time?.start && state?.time?.end) {
      return Math.round((state.time.end - state.time.start) / 1000)
    }
    if (state?.time?.start) {
      return Math.round((Date.now() - state.time.start) / 1000)
    }
    return 0
  })

  // Auto-update elapsed time while running
  const [tick, setTick] = createSignal(0)
  createEffect(() => {
    if (!isRunning()) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    onCleanup(() => clearInterval(timer))
  })

  const displayElapsed = () => {
    // Reference tick to re-evaluate
    tick()
    const s = elapsed()
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rs = s % 60
    return `${m}m ${rs}s`
  }

  const triggerAction = () => (
    <span class="text-11-regular text-text-weak tabular-nums">{displayElapsed()}</span>
  )

  return (
    <BasicTool
      icon="task"
      defaultOpen={isRunning()}
      trigger={{
        title: `${agentType()} agent`,
        subtitle: description(),
        action: triggerAction(),
      }}
    >
      <div class="mt-2 flex flex-col gap-1.5 max-h-80 overflow-y-auto" data-scrollable>
        {/* Error banner */}
        <Show when={props.errorText}>
          <Card variant="error" class="p-2 flex items-start gap-2">
            <Icon name="circle-ban-sign" class="size-3.5 shrink-0 mt-0.5" />
            <div class="text-11-regular text-text-strong break-words">{props.errorText}</div>
          </Card>
        </Show>

        {/* Live activity items */}
        <Show when={activityItems().length > 0}>
          <div class="flex flex-col gap-1">
            <For each={activityItems()}>
              {(item) => (
                <Switch>
                  <Match when={item.type === "tool"}>
                    <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-background-strong text-11-regular">
                      <Show when={item.status === "running" || item.status === "pending"} fallback={
                        <Show when={item.status === "completed"} fallback={
                          <Icon name="circle-ban-sign" class="size-3 text-error shrink-0" />
                        }>
                          <Icon name="check" class="size-3 text-accent-primary shrink-0" />
                        </Show>
                      }>
                        <Spinner class="size-3 shrink-0" />
                      </Show>
                      <span class="text-text-weak">{item.tool}</span>
                      <Show when={item.toolSubtitle}>
                        <span class="text-text-dimmed truncate max-w-60">{item.toolSubtitle}</span>
                      </Show>
                    </div>
                  </Match>
                  <Match when={item.type === "text"}>
                    <div class="px-2 py-1 text-11-regular text-text-strong">
                      <Markdown text={item.text!.length > 500 ? item.text!.slice(-500) : item.text!} />
                    </div>
                  </Match>
                </Switch>
              )}
            </For>
          </div>
        </Show>

        {/* Loading indicator when no activity yet */}
        <Show when={isRunning() && activityItems().length === 0 && !childSessionId()}>
          <div class="flex items-center gap-2 px-2 py-1 text-11-regular text-text-weak">
            <Spinner class="size-3" />
            <span>Starting agent...</span>
          </div>
        </Show>

        <Show when={isRunning() && activityItems().length === 0 && childSessionId()}>
          <div class="flex items-center gap-2 px-2 py-1 text-11-regular text-text-weak">
            <Spinner class="size-3" />
            <span>Working...</span>
          </div>
        </Show>

        {/* Completed: show final output */}
        <Show when={isCompleted() && finalOutput()}>
          <div class="px-2 py-1 text-11-regular text-text-strong border-t border-border-base mt-1 pt-1.5">
            <Markdown text={finalOutput().length > 1000 ? finalOutput().slice(-1000) : finalOutput()} />
          </div>
        </Show>
      </div>
    </BasicTool>
  )
}

/** Default MCP tool display — handles open_fileview auto-open + generic fallback */
const DefaultMcpTool: Component<{
  part: ToolPart
  input: () => Record<string, unknown>
  status: () => string | undefined
}> = (props) => {
  const isFileView = () => props.part.tool.endsWith("open_fileview")
  const filePath = () => isFileView() ? String(props.input()?.path ?? "") : ""
  const fileTitle = () => String(props.input()?.title ?? filePath().split("/").pop() ?? "")

  // Auto-open fileview when open_fileview tool completes
  createEffect(() => {
    if (isFileView() && props.status() === "completed" && filePath()) {
      window.dispatchEvent(new CustomEvent("opencode:open-file", { detail: { path: filePath() } }))
    }
  })

  return (
    <Show when={isFileView()} fallback={
      <BasicTool
        icon="mcp"
        trigger={{
          title: props.part.tool,
          subtitle: JSON.stringify(props.input()),
        }}
      />
    }>
      <BasicTool
        icon="file-text"
        trigger={{
          title: "File Viewer",
          subtitle: fileTitle(),
        }}
      >
        <div class="mt-2 px-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("opencode:open-file", { detail: { path: filePath() } }))
            }}
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-base bg-background-strong hover:bg-white/5 transition-colors text-12-regular text-text-base"
          >
            <Icon name="file-text" size="small" />
            <span class="truncate max-w-[300px]">{fileTitle()}</span>
          </button>
        </div>
      </BasicTool>
    </Show>
  )
}
