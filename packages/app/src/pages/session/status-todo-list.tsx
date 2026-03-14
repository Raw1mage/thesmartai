import type { Todo } from "@opencode-ai/sdk/v2/client"
import { For, Show } from "solid-js"
import { formatTodoActionLabel, formatTodoWaitingLabel } from "./helpers"

const todoMeaningfulMeta = (todo: Todo) => {
  const action = (todo as any).action
  const labels: string[] = []
  const actionLabel = formatTodoActionLabel(action)
  const waitingLabel = formatTodoWaitingLabel(action)

  if (actionLabel && actionLabel !== "implement") labels.push(actionLabel)
  if (waitingLabel) labels.push(waitingLabel)
  if (action?.needsApproval) labels.push("needs approval")

  return labels
}

const markerForStatus = (status: string) => {
  if (status === "completed") return "✓"
  if (status === "cancelled") return "✗"
  if (status === "in_progress") return "•"
  return ""
}

export function StatusTodoList(props: { todos: Todo[]; currentTodoID?: string }) {
  return (
    <div class="flex flex-col gap-1">
      <For each={props.todos}>
        {(todo) => (
          <div
            class="flex items-start gap-2 px-1 py-1 rounded-sm"
            classList={{
              "bg-warning/8": todo.id === props.currentTodoID,
            }}
          >
            <span
              class="shrink-0 size-4 mt-0.5 rounded-sm border flex items-center justify-center text-[11px] font-medium leading-none"
              classList={{
                "border-text-warning text-text-warning": todo.status === "in_progress",
                "border-text-danger text-text-danger": todo.status === "cancelled",
                "border-text-weak text-text-weak": todo.status !== "in_progress" && todo.status !== "cancelled",
              }}
              aria-hidden="true"
            >
              {markerForStatus(todo.status)}
            </span>
            <div class="min-w-0 flex-1 pt-px">
              <span
                class="min-w-0 text-12-regular leading-5 break-words"
                classList={{
                  "text-text-warning": todo.status === "in_progress",
                  "text-text-danger": todo.status === "cancelled",
                  "text-text-weak": todo.status !== "in_progress" && todo.status !== "cancelled",
                }}
              >
                {todo.content}
                <Show when={todoMeaningfulMeta(todo).length > 0}>
                  <span class="text-11-regular text-text-muted">{` · ${todoMeaningfulMeta(todo).join(" · ")}`}</span>
                </Show>
              </span>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
