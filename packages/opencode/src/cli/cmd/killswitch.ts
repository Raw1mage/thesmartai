import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Server } from "../../server/server"
import { Flag } from "../../flag/flag"

type AttachArgs = {
  attach?: string
}

type StatusResponse = {
  ok: boolean
  active: boolean
  initiator: string | null
  initiated_at: number | null
  mode: string | null
  scope: string | null
  ttl: number | null
  snapshot_url: string | null
  request_id?: string | null
  state?: string | null
}

type TriggerResponse = {
  ok: boolean
  request_id?: string
  snapshot_url?: string | null
  mfa_required?: boolean
  dev_code?: string
}

type CancelResponse = {
  ok: boolean
  request_id?: string | null
}

type RequestExecutor = (path: string, init?: RequestInit) => Promise<Response>

function withAttachOption<T>(yargs: Argv<T>) {
  return yargs.option("attach", {
    describe: "target a running opencode server URL",
    type: "string",
  })
}

function baseHeaders(): Headers {
  const headers = new Headers()
  headers.set("content-type", "application/json")

  const username = process.env.OPENCODE_EFFECTIVE_USER || process.env.USER || process.env.LOGNAME
  if (username) headers.set("x-opencode-user", username)

  const cliToken = process.env.OPENCODE_CLI_TOKEN
  if (cliToken) {
    headers.set("Authorization", `Bearer ${cliToken}`)
    return headers
  }

  if (Flag.OPENCODE_SERVER_PASSWORD) {
    const authUser = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
    headers.set("Authorization", `Basic ${btoa(`${authUser}:${Flag.OPENCODE_SERVER_PASSWORD}`)}`)
  }

  return headers
}

function normalizeAttachUrl(url: string) {
  return url.replace(/\/+$/, "")
}

async function withRequestExecutor(args: AttachArgs, fn: (request: RequestExecutor) => Promise<void>) {
  if (args.attach) {
    const baseUrl = normalizeAttachUrl(args.attach)
    const request: RequestExecutor = (path, init) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: mergeHeaders(baseHeaders(), init?.headers),
      })
    await fn(request)
    return
  }

  await bootstrap(process.cwd(), async () => {
    const request: RequestExecutor = async (path, init) => {
      const req = new Request(`http://opencode.internal${path}`, {
        ...init,
        headers: mergeHeaders(baseHeaders(), init?.headers),
      })
      return Server.App().fetch(req)
    }
    await fn(request)
  })
}

function mergeHeaders(base: Headers, extra?: HeadersInit) {
  const merged = new Headers(base)
  if (!extra) return merged
  const incoming = new Headers(extra)
  for (const [key, value] of incoming.entries()) {
    merged.set(key, value)
  }
  return merged
}

function parseJsonSafe(text: string): unknown {
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function formatHttpError(status: number, statusText: string, body: unknown): string {
  if (body && typeof body === "object") {
    const anyBody = body as Record<string, unknown>
    const bits = [anyBody.error, anyBody.reason, anyBody.message].filter((x): x is string => typeof x === "string")
    if (bits.length > 0) {
      return `kill-switch request failed (${status} ${statusText}): ${bits.join(" / ")}`
    }
    return `kill-switch request failed (${status} ${statusText}): ${JSON.stringify(body)}`
  }

  if (typeof body === "string" && body.trim()) {
    return `kill-switch request failed (${status} ${statusText}): ${body}`
  }

  return `kill-switch request failed (${status} ${statusText})`
}

async function requestJson<T>(request: RequestExecutor, path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init)
  const raw = await response.text()
  const body = parseJsonSafe(raw)

  if (!response.ok) {
    throw new Error(formatHttpError(response.status, response.statusText, body))
  }

  return body as T
}

export function formatTriggerResponse(body: TriggerResponse): string[] {
  if (body.mfa_required) {
    return [
      "Kill-switch MFA challenge required.",
      `mfa_required: true`,
      `request_id: ${body.request_id ?? ""}`,
      ...(body.dev_code ? [`dev_code: ${body.dev_code}`] : []),
    ]
  }

  return [`ok: ${body.ok}`, `request_id: ${body.request_id ?? ""}`, `snapshot_url: ${body.snapshot_url ?? ""}`]
}

export const KillSwitchCommand = cmd({
  command: "killswitch",
  aliases: ["kill-switch"],
  describe: "operator kill-switch controls",
  builder: (yargs) =>
    yargs
      .command(KillSwitchStatusCommand)
      .command(KillSwitchTriggerCommand)
      .command(KillSwitchCancelCommand)
      .demandCommand(),
  async handler() {},
})

const KillSwitchStatusCommand = cmd({
  command: "status",
  describe: "get kill-switch status",
  builder: (yargs) => withAttachOption(yargs),
  handler: async (args) => {
    await withRequestExecutor(args, async (request) => {
      const result = await requestJson<StatusResponse>(request, "/api/v2/admin/kill-switch/status", {
        method: "GET",
      })
      console.log(JSON.stringify(result, null, 2))
    })
  },
})

const KillSwitchTriggerCommand = cmd({
  command: "trigger",
  describe: "trigger kill-switch",
  builder: (yargs) =>
    withAttachOption(yargs)
      .option("reason", {
        describe: "required kill-switch reason",
        type: "string",
        demandOption: true,
      })
      .option("initiator", {
        describe: "override initiator",
        type: "string",
      })
      .option("mode", {
        describe: "switch mode",
        type: "string",
      })
      .option("scope", {
        describe: "switch scope",
        type: "string",
      })
      .option("ttl", {
        describe: "optional TTL in ms",
        type: "number",
      })
      .option("mfa-code", {
        describe: "MFA code to complete challenge",
        type: "string",
      })
      .option("request-id", {
        describe: "reuse request id for idempotent challenge completion",
        type: "string",
      }),
  handler: async (args) => {
    const body = {
      reason: args.reason,
      initiator: args.initiator,
      mode: args.mode,
      scope: args.scope,
      ttl: args.ttl,
      mfaCode: args["mfa-code"] ?? args.mfaCode,
      requestID: args["request-id"] ?? args.requestID,
    }

    await withRequestExecutor(args, async (request) => {
      const result = await requestJson<TriggerResponse>(request, "/api/v2/admin/kill-switch/trigger", {
        method: "POST",
        body: JSON.stringify(body),
      })

      for (const line of formatTriggerResponse(result)) {
        console.log(line)
      }
    })
  },
})

const KillSwitchCancelCommand = cmd({
  command: "cancel",
  describe: "cancel kill-switch",
  builder: (yargs) =>
    withAttachOption(yargs)
      .option("request-id", {
        describe: "associated request id",
        type: "string",
      })
      .option("initiator", {
        describe: "override initiator",
        type: "string",
      }),
  handler: async (args) => {
    const body = {
      requestID: args["request-id"] ?? args.requestID,
      initiator: args.initiator,
    }

    await withRequestExecutor(args, async (request) => {
      const result = await requestJson<CancelResponse>(request, "/api/v2/admin/kill-switch/cancel", {
        method: "POST",
        body: JSON.stringify(body),
      })
      console.log(`ok: ${result.ok}`)
      console.log(`request_id: ${result.request_id ?? ""}`)
    })
  },
})
