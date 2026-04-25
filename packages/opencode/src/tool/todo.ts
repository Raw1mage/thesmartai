import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"

export const TodoWriteTool = Tool.define("todowrite", {
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    mode: z
      .enum(["status_update", "plan_materialization", "replan_adoption"])
      .optional()
      .describe(
        "Why this update is happening. status_update = progress/status only (no structure drift). plan_materialization/replan_adoption allow explicit structure changes from planner artifacts. The runtime auto-promotes status_update to working_ledger when structure changes are detected, so you may omit this field.",
      ),
    todos: z
      .array(z.object(Todo.Info.shape))
      .describe(
        "The updated todo list. Prefer supplying structured action metadata (kind/risk/needsApproval/canDelegate/waitingOn) when known.",
      ),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "todowrite",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const current = await Todo.get(ctx.sessionID)

    const signature = (todos: Todo.Info[]) =>
      todos
        .map((todo) => `${todo.id}::${todo.content.trim().toLowerCase().replace(/\s+/g, " ")}`)
        .sort()
        .join("||")

    const structureChanged = signature(current) !== signature(params.todos)

    // Harness control (plan-builder skill, agent prompts) decides when structure
    // edits are appropriate; the runtime just honors what the LLM passes. The
    // one universal rule: if status_update was passed but the structure actually
    // changed, promote to working_ledger so the new structure isn't silently
    // dropped by applyStatusOnlyUpdate.
    let mode: Todo.UpdateMode = params.mode ?? "status_update"
    if (mode === "status_update" && structureChanged) {
      mode = "working_ledger"
    }

    await Todo.update({
      sessionID: ctx.sessionID,
      todos: params.todos,
      mode,
    })
    const todos = await Todo.get(ctx.sessionID)
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      output: JSON.stringify(todos, null, 2),
      metadata: {
        todos,
      },
    }
  },
})

export const TodoReadTool = Tool.define("todoread", {
  description: "Use this tool to read your todo list",
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "todoread",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const todos = await Todo.get(ctx.sessionID)
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
