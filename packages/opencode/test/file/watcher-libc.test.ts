import { describe, expect, test } from "bun:test"
import { resolveWatcherLinuxLibc } from "../../src/file/watcher"

describe("resolveWatcherLinuxLibc", () => {
  test("falls back to glibc when no injected or env value exists", () => {
    const prev = process.env.OPENCODE_LIBC
    try {
      delete process.env.OPENCODE_LIBC
      expect(resolveWatcherLinuxLibc()).toBe("glibc")
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_LIBC
      else process.env.OPENCODE_LIBC = prev
    }
  })

  test("uses env value when injected value is absent", () => {
    const prev = process.env.OPENCODE_LIBC
    try {
      process.env.OPENCODE_LIBC = "musl"
      expect(resolveWatcherLinuxLibc()).toBe("musl")
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_LIBC
      else process.env.OPENCODE_LIBC = prev
    }
  })
})
