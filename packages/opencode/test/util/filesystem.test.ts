import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { Filesystem } from "../../src/util/filesystem"

describe("util.filesystem", () => {
  test("exists() is true for files and directories", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "opencode-filesystem-"))
    const dir = path.join(tmp, "dir")
    const file = path.join(tmp, "file.txt")
    const missing = path.join(tmp, "missing")

    await mkdir(dir, { recursive: true })
    await Bun.write(file, "hello")

    const cases = await Promise.all([Filesystem.exists(dir), Filesystem.exists(file), Filesystem.exists(missing)])

    expect(cases).toEqual([true, true, false])

    await rm(tmp, { recursive: true, force: true })
  })

  test("isDir() is true only for directories", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "opencode-filesystem-"))
    const dir = path.join(tmp, "dir")
    const file = path.join(tmp, "file.txt")
    const missing = path.join(tmp, "missing")

    await mkdir(dir, { recursive: true })
    await Bun.write(file, "hello")

    const cases = await Promise.all([Filesystem.isDir(dir), Filesystem.isDir(file), Filesystem.isDir(missing)])

    expect(cases).toEqual([true, false, false])

    await rm(tmp, { recursive: true, force: true })
  })

  describe("windowsPath()", () => {
    test("converts Git Bash paths", () => {
      if (process.platform === "win32") {
        expect(Filesystem.windowsPath("/c/Users/test")).toBe("C:/Users/test")
        expect(Filesystem.windowsPath("/d/dev/project")).toBe("D:/dev/project")
      } else {
        expect(Filesystem.windowsPath("/c/Users/test")).toBe("/c/Users/test")
      }
    })

    test("converts Cygwin paths", () => {
      if (process.platform === "win32") {
        expect(Filesystem.windowsPath("/cygdrive/c/Users/test")).toBe("C:/Users/test")
        expect(Filesystem.windowsPath("/cygdrive/x/dev/project")).toBe("X:/dev/project")
      } else {
        expect(Filesystem.windowsPath("/cygdrive/c/Users/test")).toBe("/cygdrive/c/Users/test")
      }
    })

    test("converts WSL paths", () => {
      if (process.platform === "win32") {
        expect(Filesystem.windowsPath("/mnt/c/Users/test")).toBe("C:/Users/test")
        expect(Filesystem.windowsPath("/mnt/z/dev/project")).toBe("Z:/dev/project")
      } else {
        expect(Filesystem.windowsPath("/mnt/c/Users/test")).toBe("/mnt/c/Users/test")
      }
    })

    test("ignores normal Windows paths", () => {
      expect(Filesystem.windowsPath("C:/Users/test")).toBe("C:/Users/test")
      expect(Filesystem.windowsPath("D:\\dev\\project")).toBe("D:\\dev\\project")
    })
  })
})
