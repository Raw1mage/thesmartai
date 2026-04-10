import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import net from "node:net"
import { Log } from "../../util/log"
import { lazy } from "../../util/lazy"

const log = Log.create({ service: "web-route" })

const CTL_SOCK_PATH = "/run/opencode-gateway/ctl.sock"

const WebRouteSchema = z.object({
  prefix: z.string(),
  host: z.string(),
  port: z.number(),
  uid: z.number(),
})

type WebRoute = z.infer<typeof WebRouteSchema>

/**
 * Send a JSON command to the gateway ctl.sock and read the response.
 */
function ctlRequest(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(CTL_SOCK_PATH)
    let data = ""

    sock.setTimeout(3000)
    sock.on("connect", () => {
      sock.write(JSON.stringify(payload) + "\n")
    })
    sock.on("data", (chunk) => {
      data += chunk.toString()
      // Protocol is newline-delimited JSON; one response per request
      if (data.includes("\n")) {
        try {
          resolve(JSON.parse(data.trim()))
        } catch {
          resolve({ ok: false, error: "invalid JSON from gateway" })
        }
        sock.destroy()
      }
    })
    sock.on("end", () => {
      if (data) {
        try {
          resolve(JSON.parse(data.trim()))
        } catch {
          resolve({ ok: false, error: "invalid JSON from gateway" })
        }
      } else {
        resolve({ ok: false, error: "empty response from gateway" })
      }
    })
    sock.on("error", (err) => {
      log.warn("ctl.sock connection failed", { error: err.message })
      reject(new Error(`gateway unreachable: ${err.message}`))
    })
    sock.on("timeout", () => {
      sock.destroy()
      reject(new Error("gateway ctl.sock timeout"))
    })
  })
}

export const WebRouteRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List web routes",
        description: "List all published web routes for the current user.",
        operationId: "webRoute.list",
        responses: {
          200: {
            description: "List of web routes",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), routes: z.array(WebRouteSchema) })),
              },
            },
          },
        },
      }),
      async (c) => {
        try {
          const result = await ctlRequest({ action: "list" })
          const routes = Array.isArray(result.routes) ? result.routes as WebRoute[] : []
          // Filter by current process UID (the per-user daemon runs as that user)
          const myUid = process.getuid?.() ?? -1
          const filtered = routes.filter((r) => r.uid === myUid)
          return c.json({ ok: true, routes: filtered })
        } catch (err) {
          log.warn("failed to list web routes", { error: err instanceof Error ? err.message : String(err) })
          return c.json({ ok: false, routes: [], error: err instanceof Error ? err.message : "unknown" }, 502)
        }
      },
    )
    .post(
      "/publish",
      describeRoute({
        summary: "Publish a web route",
        description: "Register a new public web route via the gateway.",
        operationId: "webRoute.publish",
        responses: {
          200: {
            description: "Publish result",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), error: z.string().optional() })),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          prefix: z.string().min(1),
          host: z.string().default("127.0.0.1"),
          port: z.number().int().min(1).max(65535),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json" as never) as { prefix: string; host: string; port: number }
        try {
          const result = await ctlRequest({
            action: "publish",
            prefix: body.prefix,
            host: body.host,
            port: body.port,
          })
          return c.json(result)
        } catch (err) {
          return c.json({ ok: false, error: err instanceof Error ? err.message : "unknown" }, 502)
        }
      },
    )
    .post(
      "/remove",
      describeRoute({
        summary: "Remove a web route",
        description: "Unregister a published web route.",
        operationId: "webRoute.remove",
        responses: {
          200: {
            description: "Remove result",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), error: z.string().optional() })),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          prefix: z.string().min(1),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json" as never) as { prefix: string }
        try {
          const result = await ctlRequest({
            action: "remove",
            prefix: body.prefix,
          })
          return c.json(result)
        } catch (err) {
          return c.json({ ok: false, error: err instanceof Error ? err.message : "unknown" }, 502)
        }
      },
    ),
)
