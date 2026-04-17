import { describe, expect, test } from "bun:test"
import type { ConfigInvalidError, ConfigJsonError } from "./server-errors"
import {
  formatReadableConfigInvalidError,
  formatReadableConfigJsonError,
  formatServerError,
} from "./server-errors"

describe("formatReadableConfigInvalidError", () => {
  test("formats issues with file path", () => {
    const error = {
      name: "ConfigInvalidError",
      data: {
        path: "opencode.config.ts",
        issues: [
          { path: ["settings", "host"], message: "Required" },
          { path: ["mode"], message: "Invalid" },
        ],
      },
    } satisfies ConfigInvalidError

    expect(formatReadableConfigInvalidError(error)).toBe(
      ["Invalid configuration", "opencode.config.ts", "settings.host: Required", "mode: Invalid"].join("\n"),
    )
  })

  test("uses trimmed message when issues are missing", () => {
    const error = {
      name: "ConfigInvalidError",
      data: {
        path: "config",
        message: "  Bad value  ",
      },
    } satisfies ConfigInvalidError

    expect(formatReadableConfigInvalidError(error)).toBe(["Invalid configuration", "Bad value"].join("\n"))
  })
})

describe("formatServerError", () => {
  test("formats config invalid errors", () => {
    const error = {
      name: "ConfigInvalidError",
      data: {
        message: "Missing host",
      },
    } satisfies ConfigInvalidError

    expect(formatServerError(error)).toBe(["Invalid configuration", "Missing host"].join("\n"))
  })

  test("returns standard error messages", () => {
    expect(formatServerError(new Error("Request failed with status 503"))).toBe("Request failed with status 503")
  })

  test("returns provided string errors", () => {
    expect(formatServerError("Failed to connect to server")).toBe("Failed to connect to server")
  })

  test("falls back to unknown", () => {
    expect(formatServerError(0)).toBe("Unknown error")
  })

  test("formats config json parse errors with file / line / hint", () => {
    const error = {
      name: "ConfigJsonError",
      data: {
        path: "/home/user/.config/opencode/opencode.json",
        line: 42,
        column: 5,
        code: "UnexpectedEndOfString",
        hint: "UnexpectedEndOfString at line 42, column 5",
        problemLine: '    "model": "openai/gpt-4',
      },
    } satisfies ConfigJsonError

    expect(formatServerError(error)).toBe(
      [
        "Config file is not valid JSON(C)",
        "/home/user/.config/opencode/opencode.json",
        "Line 42, column 5",
        "UnexpectedEndOfString at line 42, column 5",
        '        "model": "openai/gpt-4',
      ].join("\n"),
    )
  })

  test("never returns raw multi-line config text when error shape is unknown string", () => {
    const rawConfigDump = '{\n  "secret_token": "should-not-leak"\n}\n'.repeat(200)
    const formatted = formatServerError(rawConfigDump)
    // truncate guard caps the pass-through at ~500 chars + [truncated] marker
    expect(formatted.length).toBeLessThan(600)
    expect(formatted.endsWith("[truncated]")).toBe(true)
  })
})

describe("formatReadableConfigJsonError", () => {
  test("renders single-line problem excerpt without pulling unrelated lines", () => {
    const error = {
      name: "ConfigJsonError",
      data: {
        path: "opencode.json",
        line: 1,
        column: 10,
        code: "InvalidSymbol",
        problemLine: "{ invalid json }",
        hint: "InvalidSymbol at line 1, column 10",
      },
    } satisfies ConfigJsonError
    const out = formatReadableConfigJsonError(error)
    expect(out).toContain("Config file is not valid JSON(C)")
    expect(out).toContain("opencode.json")
    expect(out).toContain("Line 1, column 10")
    expect(out).toContain("{ invalid json }")
  })
})
