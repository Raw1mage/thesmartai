import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { MCP } from "../../mcp"
import { ManagedAppRegistry } from "../../mcp"
import { Config } from "../../config/config"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

function managedAppUsageHttpStatus(reason: ManagedAppRegistry.UsageErrorReason): 401 | 409 | 503 {
  switch (reason) {
    case "unauthenticated":
      return 401
    case "misconfigured":
      return 409
    case "runtime_error":
      return 503
  }
}

export const McpRoutes = lazy(() =>
  new Hono()
    .get(
      "/apps",
      describeRoute({
        summary: "List managed MCP apps",
        description:
          "Get built-in managed app catalog entries with persisted and runtime state for Web/TUI management.",
        operationId: "mcp.apps.list",
        responses: {
          200: {
            description: "Managed app snapshots",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.AppSnapshot.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await ManagedAppRegistry.list())
      },
    )
    .get(
      "/apps/:appId",
      describeRoute({
        summary: "Get managed MCP app",
        description:
          "Get a managed app snapshot including operator-visible install, config, runtime, and error states.",
        operationId: "mcp.apps.get",
        responses: {
          200: {
            description: "Managed app snapshot",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.AppSnapshot),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        return c.json(await ManagedAppRegistry.get(appId))
      },
    )
    .post(
      "/apps/:appId/install",
      describeRoute({
        summary: "Install managed MCP app",
        description: "Mark a built-in managed app as installed and available for later configuration and enablement.",
        operationId: "mcp.apps.install",
        responses: {
          200: {
            description: "Managed app snapshot",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.AppSnapshot),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        return c.json(await ManagedAppRegistry.install(appId))
      },
    )
    .post(
      "/apps/:appId/uninstall",
      describeRoute({
        summary: "Uninstall managed MCP app",
        description: "Reset a managed app to available state and detach any runtime attachment.",
        operationId: "mcp.apps.uninstall",
        responses: {
          200: {
            description: "Managed app snapshot",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.AppSnapshot),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        return c.json(await ManagedAppRegistry.uninstall(appId))
      },
    )
    .post(
      "/apps/:appId/config",
      describeRoute({
        summary: "Update managed MCP app config keys",
        description: "Persist operator-visible configuration completion keys for a managed app.",
        operationId: "mcp.apps.config",
        responses: {
          200: {
            description: "Managed app snapshot with runtime attachment state",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.ManagedAppSnapshot),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      validator(
        "json",
        z.object({
          keys: z.array(z.string()),
        }),
      ),
      async (c) => {
        const { appId } = c.req.valid("param")
        const { keys } = c.req.valid("json")
        return c.json(await ManagedAppRegistry.setConfigKeys(appId, keys))
      },
    )
    .post(
      "/apps/:appId/enable",
      describeRoute({
        summary: "Enable managed MCP app",
        description: "Enable a managed app after install and configuration complete.",
        operationId: "mcp.apps.enable",
        responses: {
          200: {
            description: "Managed app snapshot",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.AppSnapshot),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        try {
          return c.json(await ManagedAppRegistry.enable(appId))
        } catch (error) {
          if (error instanceof ManagedAppRegistry.UsageStateError) {
            return c.json(error.toObject().data, managedAppUsageHttpStatus(error.reason))
          }
          throw error
        }
      },
    )
    .post(
      "/apps/:appId/disable",
      describeRoute({
        summary: "Disable managed MCP app",
        description: "Disable a managed app and detach any active runtime attachment.",
        operationId: "mcp.apps.disable",
        responses: {
          200: {
            description: "Managed app snapshot",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.AppSnapshot),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        return c.json(await ManagedAppRegistry.disable(appId))
      },
    )
    .get(
      "/apps/:appId/runtime",
      describeRoute({
        summary: "Get managed MCP app runtime state",
        description: "Get runtime attachment and status for a managed app without exposing full MCP tool flows.",
        operationId: "mcp.apps.runtime",
        responses: {
          200: {
            description: "Managed app runtime snapshot",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.RuntimeSnapshot),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        return c.json(await ManagedAppRegistry.runtime(appId))
      },
    )
    .get(
      "/apps/:appId/usage",
      describeRoute({
        summary: "Get managed MCP app usage state",
        description:
          "Expose fail-fast unauthenticated, misconfigured, and runtime-error states for managed app usage without implicit fallback.",
        operationId: "mcp.apps.usage",
        responses: {
          200: {
            description: "Managed app usage is ready",
            content: {
              "application/json": {
                schema: resolver(z.null()),
              },
            },
          },
          401: {
            description: "Managed app requires explicit authentication binding",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.UsageError),
              },
            },
          },
          409: {
            description: "Managed app is misconfigured",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.UsageError),
              },
            },
          },
          503: {
            description: "Managed app hit a runtime error",
            content: {
              "application/json": {
                schema: resolver(ManagedAppRegistry.UsageError),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ appId: z.string() })),
      async (c) => {
        const { appId } = c.req.valid("param")
        const usage = await ManagedAppRegistry.usage(appId)
        if (!usage) return c.json(null)
        return c.json(usage, managedAppUsageHttpStatus(usage.reason))
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "Get MCP status",
        description: "Get the status of all Model Context Protocol (MCP) servers.",
        operationId: "mcp.status",
        responses: {
          200: {
            description: "MCP server status",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), MCP.Status)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await MCP.status())
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Add MCP server",
        description: "Dynamically add a new Model Context Protocol (MCP) server to the system.",
        operationId: "mcp.add",
        responses: {
          200: {
            description: "MCP server added successfully",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), MCP.Status)),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string(),
          config: Config.Mcp,
        }),
      ),
      async (c) => {
        const { name, config } = c.req.valid("json")
        const result = await MCP.add(name, config)
        return c.json(result.status)
      },
    )
    .post(
      "/:name/auth",
      describeRoute({
        summary: "Start MCP OAuth",
        description: "Start OAuth authentication flow for a Model Context Protocol (MCP) server.",
        operationId: "mcp.auth.start",
        responses: {
          200: {
            description: "OAuth flow started",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    authorizationUrl: z.string().describe("URL to open in browser for authorization"),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      async (c) => {
        const name = c.req.param("name")
        const supportsOAuth = await MCP.supportsOAuth(name)
        if (!supportsOAuth) {
          return c.json({ error: `MCP server ${name} does not support OAuth` }, 400)
        }
        const result = await MCP.startAuth(name)
        return c.json(result)
      },
    )
    .post(
      "/:name/auth/callback",
      describeRoute({
        summary: "Complete MCP OAuth",
        description:
          "Complete OAuth authentication for a Model Context Protocol (MCP) server using the authorization code.",
        operationId: "mcp.auth.callback",
        responses: {
          200: {
            description: "OAuth authentication completed",
            content: {
              "application/json": {
                schema: resolver(MCP.Status),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "json",
        z.object({
          code: z.string().describe("Authorization code from OAuth callback"),
        }),
      ),
      async (c) => {
        const name = c.req.param("name")
        const { code } = c.req.valid("json")
        const status = await MCP.finishAuth(name, code)
        return c.json(status)
      },
    )
    .post(
      "/:name/auth/authenticate",
      describeRoute({
        summary: "Authenticate MCP OAuth",
        description: "Start OAuth flow and wait for callback (opens browser)",
        operationId: "mcp.auth.authenticate",
        responses: {
          200: {
            description: "OAuth authentication completed",
            content: {
              "application/json": {
                schema: resolver(MCP.Status),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      async (c) => {
        const name = c.req.param("name")
        const supportsOAuth = await MCP.supportsOAuth(name)
        if (!supportsOAuth) {
          return c.json({ error: `MCP server ${name} does not support OAuth` }, 400)
        }
        const status = await MCP.authenticate(name)
        return c.json(status)
      },
    )
    .delete(
      "/:name/auth",
      describeRoute({
        summary: "Remove MCP OAuth",
        description: "Remove OAuth credentials for an MCP server",
        operationId: "mcp.auth.remove",
        responses: {
          200: {
            description: "OAuth credentials removed",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.literal(true) })),
              },
            },
          },
          ...errors(404),
        },
      }),
      async (c) => {
        const name = c.req.param("name")
        await MCP.removeAuth(name)
        return c.json({ success: true as const })
      },
    )
    .post(
      "/:name/connect",
      describeRoute({
        description: "Connect an MCP server",
        operationId: "mcp.connect",
        responses: {
          200: {
            description: "MCP server connected successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator("param", z.object({ name: z.string() })),
      async (c) => {
        const { name } = c.req.valid("param")
        await MCP.connect(name)
        return c.json(true)
      },
    )
    .post(
      "/:name/disconnect",
      describeRoute({
        description: "Disconnect an MCP server",
        operationId: "mcp.disconnect",
        responses: {
          200: {
            description: "MCP server disconnected successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator("param", z.object({ name: z.string() })),
      async (c) => {
        const { name } = c.req.valid("param")
        await MCP.disconnect(name)
        return c.json(true)
      },
    ),
)
