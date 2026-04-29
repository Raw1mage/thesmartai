import { Tweaks } from "../config/tweaks"
import type { Tool } from "./tool"

/**
 * Layer 2 of the context-management subsystem (specs/tool-output-chunking/).
 *
 * Variable-size tools call ToolBudget.resolve(ctx) to get a guaranteed
 * per-invocation token budget. The tool MUST cap its natural output to
 * that many tokens before returning, appending a trailing
 * natural-language hint with the next-slice args (e.g. offset=N).
 *
 * Decision DD-2: outputBudget = min(round(model.contextWindow * ratio),
 * absoluteCap), floored at minimumFloor. `task` and `bash` substitute
 * their per-tool override for absoluteCap.
 *
 * Until the runtime plumbs ctx.outputBudget at every invocation site
 * (later phase), the helper falls back to the static absoluteCap from
 * tweaks.cfg. Tools written today against this helper are forward-
 * compatible with the eventual model-aware plumbing — no rewrite needed.
 */
export namespace ToolBudget {
  export interface Resolved {
    /** Final token budget the tool must respect. */
    tokens: number
    /** Where the value came from — useful for telemetry / debugging. */
    source: "ctx" | "tweaks-default" | "tweaks-task-override" | "tweaks-bash-override"
  }

  /**
   * Resolve a guaranteed budget for a tool's output.
   *
   * @param ctx tool context (Tool.Context). ctx.outputBudget wins if set.
   * @param toolId tool identifier ("read", "bash", "task", ...). Affects
   *               which per-tool override applies.
   */
  export function resolve(ctx: Pick<Tool.Context, "outputBudget">, toolId?: string): Resolved {
    if (typeof ctx.outputBudget === "number" && ctx.outputBudget > 0) {
      return { tokens: ctx.outputBudget, source: "ctx" }
    }
    const cfg = Tweaks.toolOutputBudgetSync()
    const cap =
      toolId === "task"
        ? cfg.taskOverride
        : toolId === "bash"
          ? cfg.bashOverride
          : cfg.absoluteCap
    const floored = Math.max(cap, cfg.minimumFloor)
    const source: Resolved["source"] =
      toolId === "task" ? "tweaks-task-override" : toolId === "bash" ? "tweaks-bash-override" : "tweaks-default"
    return { tokens: floored, source }
  }

  /**
   * Compute outputBudget for a model with a known context window. Used by
   * the runtime when constructing Tool.Context (later phase). Tools
   * themselves should call resolve() instead.
   */
  export function computeForModel(modelContextWindowTokens: number, toolId?: string): number {
    const cfg = Tweaks.toolOutputBudgetSync()
    const cap =
      toolId === "task"
        ? cfg.taskOverride
        : toolId === "bash"
          ? cfg.bashOverride
          : cfg.absoluteCap
    const fromRatio = Math.round(modelContextWindowTokens * cfg.contextRatio)
    return Math.max(cfg.minimumFloor, Math.min(fromRatio, cap))
  }

  /**
   * Approximate token count for a string. Uses the same formula as
   * util/token-estimate.ts elsewhere in the codebase: roughly chars/4.
   * Tools should use this when slicing on token boundaries; it is fast,
   * has no async cost, and is deterministic across providers.
   */
  export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}
