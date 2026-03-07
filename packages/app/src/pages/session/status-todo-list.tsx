import type { Todo } from "@opencode-ai/sdk/v2/client"
import { For } from "solid-js"

const markerForStatus = (status: string) => {
  if (status === "completed") return "✓"
  if (status === "cancelled") return "✗"
  if (status === "in_progress") return "•"
  return ""
}

export function StatusTodoList(props: { todos: Todo[] }) {
  return (
    <div class="flex flex-col gap-1">
      <For each={props.todos}>
        {(todo) => (
          <div class="flex items-start gap-2 px-1 py-0.5">
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
            <span
              class="min-w-0 flex-1 text-12-regular leading-5 break-words pt-px"
              classList={{
                "text-text-warning": todo.status === "in_progress",
                "text-text-danger": todo.status === "cancelled",
                "text-text-weak": todo.status !== "in_progress" && todo.status !== "cancelled",
              }}
            >
              {todo.content}
            </span>
          </div>
        )}
      </For>
    </div>
  )
}
