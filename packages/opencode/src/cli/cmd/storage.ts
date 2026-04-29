import type { Argv } from "yargs"

import { bootstrap } from "../bootstrap"
import { cmd } from "./cmd"
import { DreamingWorker } from "../../session/storage/dreaming"
import { SessionStorageMetrics } from "../../session/storage/metrics"
import { detectFormat } from "../../session/storage/router"

interface StorageResult {
  stdout: string
  exitCode: number
}

export namespace StorageAdmin {
  export async function status(): Promise<StorageResult> {
    const pending = await DreamingWorker.scanLegacySessions()
    SessionStorageMetrics.gauge("legacy_sessions_pending_count", pending.length)
    const retirement = pending.length === 0 ? "open" : "blocked"
    return {
      stdout:
        [
          `legacy_sessions_pending_count ${pending.length}`,
          `LegacyStore retirement gate: ${retirement}`,
          "Milestone: legacy_sessions_pending_count == 0 for >= 7 days before scheduling LegacyStore retirement.",
        ].join("\n") + "\n",
      exitCode: 0,
    }
  }

  export async function migrateNow(sessionID: string): Promise<StorageResult> {
    const format = detectFormat(sessionID)
    if (format.format === "sqlite") {
      return { stdout: `session ${sessionID} already sqlite; no migration needed\n`, exitCode: 0 }
    }
    if (format.hasMigrationTmp) {
      return {
        stdout: `session ${sessionID} has an in-flight migration tmp; run daemon startup cleanup before forcing migration\n`,
        exitCode: 1,
      }
    }

    await DreamingWorker.migrateSession(sessionID)
    const pending = await DreamingWorker.scanLegacySessions()
    SessionStorageMetrics.gauge("legacy_sessions_pending_count", pending.length)
    return { stdout: `session ${sessionID} migrated\nlegacy_sessions_pending_count ${pending.length}\n`, exitCode: 0 }
  }
}

async function run(action: string | undefined, sessionID?: string): Promise<void> {
  let result: StorageResult
  if (!action || action === "status") result = await StorageAdmin.status()
  else if (action === "migrate-now") {
    if (!sessionID) throw new Error("storage migrate-now requires <sessionID>")
    result = await StorageAdmin.migrateNow(sessionID)
  } else throw new Error(`unknown storage action: ${action}`)

  process.stdout.write(result.stdout)
  if (result.exitCode !== 0) process.exitCode = result.exitCode
}

export const StorageCommand = cmd({
  command: "storage [action] [sessionID]",
  describe: "inspect and operate session storage migration gates",
  builder: (yargs: Argv) =>
    yargs
      .positional("action", {
        describe: "subcommand to run",
        type: "string",
        choices: ["status", "migrate-now"] as const,
        default: "status",
      })
      .positional("sessionID", {
        describe: "session ID for migrate-now",
        type: "string",
      })
      .example("opencode storage status", "show legacy pending count and retirement gate")
      .example("opencode storage migrate-now ses_abc", "force-migrate one legacy session"),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      await run(args.action as string | undefined, args.sessionID as string | undefined)
    })
  },
})
