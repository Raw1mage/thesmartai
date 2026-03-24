import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"

// We test the ManagedAppRegistry domain logic by importing and exercising
// the public API against a temp directory. Since the registry reads/writes
// managed-apps.json via Global.Path.user, we mock the filepath indirectly
// by testing the exported pure functions and state machine transitions.

import { ManagedAppRegistry } from "../../src/mcp/app-registry"

describe("ManagedAppRegistry schemas", () => {
  test("CatalogEntry validates google-calendar built-in", () => {
    const catalog = ManagedAppRegistry.catalog()
    expect(catalog.length).toBeGreaterThanOrEqual(1)
    const gc = catalog.find((e) => e.id === "google-calendar")
    expect(gc).toBeDefined()
    expect(gc!.name).toBe("Google Calendar")
    expect(gc!.version).toBe("0.1.0")
    expect(gc!.source.type).toBe("builtin")
    expect(gc!.source.owner).toBe("opencode")
  })

  test("google-calendar has correct capabilities", () => {
    const gc = ManagedAppRegistry.catalog().find((e) => e.id === "google-calendar")!
    const capIds = gc.capabilities.map((c) => c.id)
    expect(capIds).toContain("google-calendar.oauth")
    expect(capIds).toContain("google-calendar.calendars.read")
    expect(capIds).toContain("google-calendar.events.read")
    expect(capIds).toContain("google-calendar.events.write")
    expect(capIds).toContain("google-calendar.availability.read")
  })

  test("google-calendar tool contract has 7 tools", () => {
    const gc = ManagedAppRegistry.catalog().find((e) => e.id === "google-calendar")!
    expect(gc.toolContract.namespace).toBe("google-calendar")
    expect(gc.toolContract.tools.length).toBe(7)
    const toolIds = gc.toolContract.tools.map((t) => t.id)
    expect(toolIds).toContain("list-calendars")
    expect(toolIds).toContain("list-events")
    expect(toolIds).toContain("get-event")
    expect(toolIds).toContain("create-event")
    expect(toolIds).toContain("update-event")
    expect(toolIds).toContain("delete-event")
    expect(toolIds).toContain("freebusy")
  })

  test("auth contract requires canonical-account ownership", () => {
    const gc = ManagedAppRegistry.catalog().find((e) => e.id === "google-calendar")!
    expect(gc.auth.ownership).toBe("canonical-account")
    expect(gc.auth.type).toBe("oauth")
    expect(gc.auth.required).toBe(true)
    expect(gc.auth.allowImplicitActiveAccount).toBe(false)
    expect(gc.auth.scopes.length).toBe(2)
  })

  test("delete-event requires confirmation", () => {
    const gc = ManagedAppRegistry.catalog().find((e) => e.id === "google-calendar")!
    const del = gc.toolContract.tools.find((t) => t.id === "delete-event")!
    expect(del.requiresConfirmation).toBe(true)
    expect(del.mutates).toBe(true)
  })

  test("read tools do not require confirmation", () => {
    const gc = ManagedAppRegistry.catalog().find((e) => e.id === "google-calendar")!
    const readTools = gc.toolContract.tools.filter((t) => !t.mutates)
    for (const tool of readTools) {
      expect(tool.requiresConfirmation).toBe(false)
    }
  })
})

describe("ManagedAppRegistry Zod schemas", () => {
  test("AppState validates correctly", () => {
    const valid = ManagedAppRegistry.AppState.safeParse({
      appId: "test",
      source: { type: "builtin", owner: "opencode", package: "test", entrypoint: "test", localOnly: true },
      installState: "installed",
      enableState: "enabled",
      configStatus: "configured",
      updatedAt: Date.now(),
    })
    expect(valid.success).toBe(true)
  })

  test("InstallState rejects invalid values", () => {
    const result = ManagedAppRegistry.InstallState.safeParse("running")
    expect(result.success).toBe(false)
  })

  test("RuntimeStatus has all expected values", () => {
    const values = ["ready", "disabled", "error", "pending_config", "pending_install", "pending_auth"]
    for (const v of values) {
      expect(ManagedAppRegistry.RuntimeStatus.safeParse(v).success).toBe(true)
    }
  })

  test("UsageError validates with all required fields", () => {
    const result = ManagedAppRegistry.UsageError.safeParse({
      appId: "google-calendar",
      status: "pending_auth",
      reason: "unauthenticated",
      code: "MANAGED_APP_AUTH_REQUIRED",
      message: "Auth required",
    })
    expect(result.success).toBe(true)
  })
})

describe("ManagedAppRegistry error types", () => {
  test("AppNotFoundError throws for unknown app", async () => {
    try {
      await ManagedAppRegistry.get("nonexistent-app")
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(ManagedAppRegistry.AppNotFoundError)
    }
  })
})

describe("ManagedAppRegistry operator state derivation", () => {
  test("OperatorState schema validates all fields", () => {
    const result = ManagedAppRegistry.OperatorState.safeParse({
      install: "available",
      auth: "required",
      config: "not_required",
      runtime: "inactive",
      error: "auth_required",
    })
    expect(result.success).toBe(true)
  })

  test("OperatorErrorState covers all error categories", () => {
    const values = ["none", "auth_required", "invalid_auth", "invalid_config", "runtime_error"]
    for (const v of values) {
      expect(ManagedAppRegistry.OperatorErrorState.safeParse(v).success).toBe(true)
    }
  })
})
