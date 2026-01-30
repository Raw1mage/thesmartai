import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { Installation } from "../installation"
import { Identifier } from "../id/id"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"
import { MCP } from "../mcp"
import { Account } from "../account"
import { renderModelCheckReport } from "../cli/cmd/model-check-report"

import { Bus } from "@/bus"
import { TuiEvent } from "../cli/cmd/tui/event"

export namespace Command {
  export const Event = {
    Executed: BusEvent.define(
      "command.executed",
      z.object({
        name: z.string(),
        sessionID: Identifier.schema("session"),
        arguments: z.string(),
        messageID: Identifier.schema("message"),
      }),
    ),
  }

  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      agent: z.string().optional(),
      model: z.string().optional(),
      mcp: z.boolean().optional(),
      // workaround for zod not supporting async functions natively so we use getters
      // https://zod.dev/v4/changelog?id=zfunction
      template: z.promise(z.string()).or(z.string()),
      subtask: z.boolean().optional(),
      hints: z.array(z.string()),
      handler: z.function().optional(),
    })
    .meta({
      ref: "Command",
    })

  // for some reason zod is inferring `string` for z.promise(z.string()).or(z.string()) so we have to manually override it
  export type Info = Omit<z.infer<typeof Info>, "template" | "handler"> & {
    template: Promise<string> | string
    handler?: () => Promise<{ output: string; title?: string }>
  }

  export function hints(template: string): string[] {
    const result: string[] = []
    const numbered = template.match(/\$\d+/g)
    if (numbered) {
      for (const match of [...new Set(numbered)].sort()) result.push(match)
    }
    if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
    return result
  }


  export const Default = {
    INIT: "init",
    REVIEW: "review",
    MODEL_CHECK: "model-check",
    DASHBOARD: "dashboard",
    ACCOUNTS: "accounts",
  } as const

  const state = Instance.state(async () => {
    const cfg = await Config.get()

    const result: Record<string, Info> = {
      [Default.INIT]: {
        name: Default.INIT,
        description: "create/update AGENTS.md",
        get template() {
          return PROMPT_INITIALIZE.replace("${path}", Instance.worktree)
        },
        hints: hints(PROMPT_INITIALIZE),
      },
      [Default.REVIEW]: {
        name: Default.REVIEW,
        description: "review changes [commit|branch|pr], defaults to uncommitted",
        get template() {
          return PROMPT_REVIEW.replace("${path}", Instance.worktree)
        },
        subtask: true,
        hints: hints(PROMPT_REVIEW),
      },
      [Default.DASHBOARD]: {
        name: Default.DASHBOARD,
        description: "Real-time rate limit status dashboard",
        get template() {
          return `Checking rate limits...`
        },
        subtask: false,
        hints: [],
        async handler() {
          const { globalAccountManager } = await import("../plugin/antigravity/index");

          if (!globalAccountManager) {
            return { output: "⚠️ Antigravity AccountManager not available. Please ensure the plugin is loaded.", title: "Rate Limit Dashboard" };
          }

          // @ts-ignore
          const accounts = globalAccountManager.getAccountsSnapshot();
          const lines = ["# 📊 Rate Limit Dashboard", ""];

          if (accounts.length === 0) {
            lines.push("No Antigravity accounts found.");
            return { output: lines.join("\n"), title: "Rate Limit Dashboard" };
          }

          const now = Date.now();
          const formatTime = (ts: number | undefined) => {
            if (!ts || ts <= now) return "✅ Ready";
            const waitSec = Math.ceil((ts - now) / 1000);
            if (waitSec > 3600) return `🛑 ${(waitSec / 3600).toFixed(1)}h`;
            if (waitSec > 60) return `🛑 ${(waitSec / 60).toFixed(1)}m`;
            return `⏳ ${waitSec}s`;
          };

          lines.push("| ID | Email | Claude | Gemini (AG) | Gemini (CLI) |");
          lines.push("|----|-------|--------|-------------|--------------|");

          for (const acc of accounts) {
            // @ts-ignore
            const email = acc.email || `Account ${acc.index}`;
            // @ts-ignore
            const claude = formatTime(acc.rateLimitResetTimes?.["claude"]);
            // @ts-ignore
            const geminiAG = formatTime(acc.rateLimitResetTimes?.["gemini-antigravity"]);
            // @ts-ignore
            const geminiCLI = formatTime(acc.rateLimitResetTimes?.["gemini-cli"]);

            // Check if actively cooling down
            // @ts-ignore
            const coolingDown = acc.coolingDownUntil && acc.coolingDownUntil > now;

            let statusPrefix = "";
            if (coolingDown) statusPrefix = "❄️ ";

            // @ts-ignore
            lines.push(`| ${acc.index} | ${statusPrefix}${email} | ${claude} | ${geminiAG} | ${geminiCLI} |`);
          }

          lines.push("");
          lines.push(`*Total Accounts: ${accounts.length}*`);
          lines.push(`*Time: ${new Date().toLocaleTimeString()}*`);

          return {
            output: lines.join("\n"),
            title: "Rate Limit Dashboard",
          }
        },
      },
      [Default.ACCOUNTS]: {
        name: Default.ACCOUNTS,
        description: "Manage accounts",
        get template() {
          return `Opening account manager...`
        },
        subtask: false,
        hints: [],
        async handler() {
          const families = await Account.listAll();
          const lines: string[] = ["# Account Status", ""];

          const order = ["opencode", "anthropic", "openai", "antigravity", "gemini-cli", "google API-KEY", "copilot", "others"];
          const sortedFamilies = Object.keys(families).sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });

          for (const familyName of sortedFamilies) {
            const familyData = families[familyName];
            const accountsArr = Object.entries(familyData.accounts);
            if (accountsArr.length === 0) continue;

            lines.push(`### 📂 ${familyName.toUpperCase()}`);
            for (const [id, info] of accountsArr) {
              const isActive = familyData.activeAccount === id;
              const status = isActive ? "✅ **active**" : "   ";
              const displayName = Account.getDisplayName(id, info, familyName);
              lines.push(`- ${status} \`${displayName}\`  *(id: ${id})*`);
            }
            lines.push("");
          }

          await Bus.publish(TuiEvent.CommandExecute, { command: "account.manage" })
          return {
            output: lines.join("\n"),
            title: "Account Status"
          }
        },
      },
    }

    for (const [name, command] of Object.entries(cfg.command ?? {})) {
      if (result[name] && result[name].handler) continue
      result[name] = {
        name,
        agent: command.agent,
        model: command.model,
        description: command.description,
        get template() {
          return command.template
        },
        subtask: command.subtask,
        hints: hints(command.template),
      }
    }
    for (const [name, prompt] of Object.entries(await MCP.prompts())) {
      if (result[name] && result[name].handler) continue
      result[name] = {
        name,
        mcp: true,
        description: prompt.description,
        get template() {
          // since a getter can't be async we need to manually return a promise here
          return new Promise<string>(async (resolve, reject) => {
            const template = await MCP.getPrompt(
              prompt.client,
              prompt.name,
              prompt.arguments
                ? // substitute each argument with $1, $2, etc.
                Object.fromEntries(prompt.arguments?.map((argument, i) => [argument.name, `$${i + 1}`]))
                : {},
            ).catch(reject)
            resolve(
              template?.messages
                .map((message) => (message.content.type === "text" ? message.content.text : ""))
                .join("\n") || "",
            )
          })
        },
        hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
      }
    }

    return result
  })

  export async function get(name: string) {
    return state().then((x) => x[name])
  }

  export async function list() {
    return state().then((x) => Object.values(x))
  }
}
