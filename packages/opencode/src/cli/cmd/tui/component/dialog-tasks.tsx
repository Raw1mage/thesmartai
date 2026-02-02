import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { createMemo, onMount, Show } from "solid-js"
import { Locale } from "@/util/locale"
import { Keybind } from "@/util/keybind"
import { useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import "opentui-spinner/solid"

export function DialogTasks() {
  const dialog = useDialog()
  const route = useRoute()
  const sync = useSync()
  const { theme } = useTheme()
  const kv = useKV()

  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

  // Filter for all subagent tasks
  const tasks = createMemo(() =>
    sync.data.session.filter((x) => !!x.parentID)
  )

  // Get provider/model info from the last assistant message
  const getModelInfo = (sessionID: string) => {
    const messages = sync.data.message[sessionID] ?? []
    const lastAssistant = messages.findLast((m) => m.role === "assistant") as AssistantMessage | undefined
    if (!lastAssistant) return null

    // Find provider name from provider list
    const provider = sync.data.provider.find((p) => p.id === lastAssistant.providerID)
    const providerName = provider?.name || lastAssistant.providerID
    const modelName = provider?.models[lastAssistant.modelID]?.name || lastAssistant.modelID

    return { providerName, modelName, modelID: lastAssistant.modelID }
  }

  const options = createMemo(() => {
    return tasks()
      .toSorted((a, b) => b.time.created - a.time.created) // Newest first
      .map((x) => {
        const modelInfo = getModelInfo(x.id)
        const modelDisplay = modelInfo ? `${modelInfo.modelID}` : "..."
        const status = sync.data.session_status?.[x.id]
        const isBusy = status?.type === "busy"

        return {
          title: x.title || "Untitled Task",
          value: x.id,
          category: "",
          footer: Locale.time(x.time.created),
          gutter: (
            <Show when={isBusy && kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>{isBusy ? "[⋯]" : "[✓]"}</text>}>
              <spinner frames={spinnerFrames} interval={80} color={theme.success} />
            </Show>
          ),
          description: modelDisplay,
        }
      })
  })

  onMount(() => {
    dialog.setSize("medium")
  })

  const title = createMemo(() => {
    const count = tasks().filter(x => {
      const status = sync.data.session_status?.[x.id]
      return status?.type === "busy"
    }).length
    return count > 0 ? `Tasks (${count} running)` : "Tasks"
  })

  return (
    <DialogSelect
      title={title()}
      placeholder="No running tasks"
      options={options()}
      hideInput={true}
      current={route.data.type === "session" ? route.data.sessionID : undefined}
      onSelect={(option) => {
        route.navigate({
          type: "session",
          sessionID: option.value,
        })
        dialog.clear()
      }}
      keybind={[
        {
          keybind: Keybind.parse("left")[0],
          title: "(←)Back",
          label: "",
          hidden: true,
          onTrigger: () => {
            dialog.clear()
          },
        },
        {
          keybind: Keybind.parse("backspace")[0],
          title: "",
          label: "",
          hidden: true,
          onTrigger: () => {
            dialog.clear()
          },
        },
      ]}
    />
  )
}
