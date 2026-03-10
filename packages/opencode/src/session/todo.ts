import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Storage } from "../storage/storage"

export namespace Todo {
  export const Action = z
    .object({
      kind: z.enum([
        "implement",
        "delegate",
        "wait",
        "approval",
        "decision",
        "push",
        "destructive",
        "architecture_change",
      ]),
      risk: z.enum(["low", "medium", "high"]).optional(),
      needsApproval: z.boolean().optional(),
      canDelegate: z.boolean().optional(),
      waitingOn: z.enum(["subagent", "approval", "decision", "external"]).optional(),
      dependsOn: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Structured planner metadata for autonomous session execution")
  export type Action = z.infer<typeof Action>

  export const Info = z
    .object({
      content: z.string().describe("Brief description of the task"),
      status: z.string().describe("Current status of the task: pending, in_progress, completed, cancelled"),
      priority: z.string().describe("Priority level of the task: high, medium, low"),
      id: z.string().describe("Unique identifier for the todo item"),
      action: Action,
    })
    .meta({ ref: "Todo" })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define(
      "todo.updated",
      z.object({
        sessionID: z.string(),
        todos: z.array(Info),
      }),
    ),
  }

  export function inferActionFromContent(todo: Pick<Info, "content" | "status">): Action {
    const text = todo.content.toLowerCase()
    if (text.includes("push") || text.includes("deploy") || text.includes("release") || text.includes("publish")) {
      return { kind: "push", risk: "high", needsApproval: true }
    }
    if (
      text.includes("delete") ||
      text.includes("remove") ||
      text.includes("drop ") ||
      text.includes("reset") ||
      text.includes("destroy")
    ) {
      return { kind: "destructive", risk: "high", needsApproval: true }
    }
    if (
      text.includes("architecture") ||
      text.includes("refactor") ||
      text.includes("schema") ||
      text.includes("migration") ||
      text.includes("breaking change")
    ) {
      return { kind: "architecture_change", risk: "high", needsApproval: true }
    }
    if (text.includes("wait for") || text.includes("blocked by") || text.includes("waiting on")) {
      if (text.includes("subagent") || text.includes("worker")) return { kind: "wait", waitingOn: "subagent" }
      if (text.includes("approval")) return { kind: "approval", waitingOn: "approval", needsApproval: true }
      if (text.includes("decision")) return { kind: "decision", waitingOn: "decision" }
      return { kind: "wait", waitingOn: "external" }
    }
    if (text.includes("delegate") || text.includes("subagent") || text.includes("hand off")) {
      return { kind: "delegate", canDelegate: true }
    }
    return { kind: "implement", canDelegate: todo.status === "pending" ? true : undefined }
  }

  export function enrich(input: Info): Info {
    return {
      ...input,
      action: input.action ?? inferActionFromContent(input),
    }
  }

  export function enrichAll(todos: Info[]) {
    return todos.map(enrich)
  }

  export function isDependencyReady(todo: Info, todos: Info[]) {
    const deps = todo.action?.dependsOn
    if (!deps?.length) return true
    return deps.every((id) => todos.find((candidate) => candidate.id === id)?.status === "completed")
  }

  export function nextActionableTodo(todos: Info[]) {
    return (
      todos.find((todo) => todo.status === "in_progress") ??
      todos.find((todo) => todo.status === "pending" && isDependencyReady(todo, todos))
    )
  }

  export function applyHostAdoptedReplan(
    todos: Info[],
    proposal?: {
      targetTodoID?: string
      proposedAction?: string
      policy?: {
        adoptionMode?: string
        requiresUserConfirm?: boolean
        requiresHostReview?: boolean
      }
    },
  ) {
    if (!proposal?.targetTodoID) return { adopted: false as const, reason: "missing_target" as const, todos }
    if (proposal.proposedAction !== "replan_todos")
      return { adopted: false as const, reason: "unsupported_action" as const, todos }
    if (proposal.policy?.adoptionMode !== "host_adoptable")
      return { adopted: false as const, reason: "policy_not_host_adoptable" as const, todos }
    if (proposal.policy?.requiresUserConfirm)
      return { adopted: false as const, reason: "user_confirm_required" as const, todos }
    if (proposal.policy?.requiresHostReview === false)
      return { adopted: false as const, reason: "host_review_missing" as const, todos }
    if (todos.some((todo) => todo.status === "in_progress"))
      return { adopted: false as const, reason: "active_todo_in_progress" as const, todos }

    const enriched = enrichAll(todos)
    const target = enriched.find((todo) => todo.id === proposal.targetTodoID)
    if (!target || target.status !== "pending")
      return { adopted: false as const, reason: "target_not_pending" as const, todos: enriched }
    if (!isDependencyReady(target, enriched))
      return { adopted: false as const, reason: "dependencies_not_ready" as const, todos: enriched }
    if (target.action?.needsApproval)
      return { adopted: false as const, reason: "approval_gate" as const, todos: enriched }
    if (target.action?.waitingOn) return { adopted: false as const, reason: "waiting_gate" as const, todos: enriched }
    if (target.action?.kind && target.action.kind !== "implement")
      return { adopted: false as const, reason: "unsupported_todo_kind" as const, todos: enriched }

    return {
      adopted: true as const,
      adoptedTodoID: target.id,
      reason: "adopted" as const,
      todos: enriched.map((todo) => (todo.id === target.id ? { ...todo, status: "in_progress" } : todo)),
    }
  }

  export function applyHostAdoptedCompletion(
    todos: Info[],
    proposal?: {
      targetTodoID?: string
      proposedAction?: string
      policy?: {
        adoptionMode?: string
        requiresUserConfirm?: boolean
        requiresHostReview?: boolean
      }
    },
  ) {
    if (!proposal?.targetTodoID) return { adopted: false as const, reason: "missing_target" as const, todos }
    if (proposal.proposedAction !== "mark_todo_complete")
      return { adopted: false as const, reason: "unsupported_action" as const, todos }
    if (proposal.policy?.adoptionMode !== "host_adoptable")
      return { adopted: false as const, reason: "policy_not_host_adoptable" as const, todos }
    if (proposal.policy?.requiresUserConfirm)
      return { adopted: false as const, reason: "user_confirm_required" as const, todos }
    if (proposal.policy?.requiresHostReview === false)
      return { adopted: false as const, reason: "host_review_missing" as const, todos }

    const enriched = enrichAll(todos)
    const target = enriched.find((todo) => todo.id === proposal.targetTodoID)
    if (!target) return { adopted: false as const, reason: "missing_target" as const, todos: enriched }
    if (target.status === "completed" || target.status === "cancelled")
      return { adopted: false as const, reason: "target_not_active" as const, todos: enriched }
    if (target.action?.needsApproval)
      return { adopted: false as const, reason: "approval_gate" as const, todos: enriched }
    if (target.action?.waitingOn) return { adopted: false as const, reason: "waiting_gate" as const, todos: enriched }

    const current = nextActionableTodo(enriched)
    if (!current || current.id !== target.id)
      return { adopted: false as const, reason: "target_not_active" as const, todos: enriched }

    return {
      adopted: true as const,
      adoptedTodoID: target.id,
      reason: "adopted" as const,
      todos: enriched.map((todo) => (todo.id === target.id ? { ...todo, status: "completed" } : todo)),
    }
  }

  export async function reconcileProgress(input: {
    sessionID: string
    linkedTodoID?: string
    taskStatus: "completed" | "error"
  }) {
    const current = await get(input.sessionID)
    if (!current.length) return current
    const todos = enrichAll(
      current.map((todo) => {
        if (input.linkedTodoID && todo.id === input.linkedTodoID) {
          if (input.taskStatus === "completed") {
            return {
              ...todo,
              status: "completed",
              action: todo.action?.waitingOn === "subagent" ? { ...todo.action, waitingOn: undefined } : todo.action,
            }
          }
          return {
            ...todo,
            status: todo.status === "pending" ? "in_progress" : todo.status,
            action:
              todo.action && todo.action.waitingOn !== "subagent"
                ? { ...todo.action, waitingOn: "subagent" }
                : (todo.action ?? { kind: "wait", waitingOn: "subagent" }),
          }
        }
        return todo
      }),
    )

    if (input.taskStatus === "completed" && !todos.some((todo) => todo.status === "in_progress")) {
      const next = nextActionableTodo(todos)
      if (next && next.status === "pending") {
        const index = todos.findIndex((todo) => todo.id === next.id)
        if (index >= 0) todos[index] = { ...todos[index], status: "in_progress" }
      }
    }

    await update({ sessionID: input.sessionID, todos })
    return todos
  }

  export async function update(input: { sessionID: string; todos: Info[] }) {
    const todos = enrichAll(input.todos)
    await Storage.write(["todo", input.sessionID], todos)
    Bus.publish(Event.Updated, {
      sessionID: input.sessionID,
      todos,
    })
  }

  export async function get(sessionID: string) {
    return Storage.read<Info[]>(["todo", sessionID])
      .then((x) => x || [])
      .catch(() => [])
  }
}
