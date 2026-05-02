/**
 * paths.test.ts — Phase 1 of /specs/repo-incoming-attachments/.
 *
 * Covers DD-1 fail-fast (NoProjectPathError), DD-8 conflict-rename,
 * DD-12 sanitize (NFC, control strip, length cap, traversal reject),
 * and the path resolver helpers.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { IncomingPaths } from "../../src/incoming/paths"

describe("IncomingPaths.sanitize", () => {
  test("preserves CJK + emoji + spaces + punctuation", () => {
    expect(IncomingPaths.sanitize("合約 v2.docx")).toBe("合約 v2.docx")
    expect(IncomingPaths.sanitize("📄 hello.md")).toBe("📄 hello.md")
    expect(IncomingPaths.sanitize("file (final, v2).pdf")).toBe("file (final, v2).pdf")
  })

  test("NFC normalize", () => {
    // U+00E9 vs U+0065 + U+0301 — both render as 'é'
    const composed = "café.txt"
    const decomposed = "café.txt"
    expect(IncomingPaths.sanitize(decomposed)).toBe(composed)
  })

  test("strips C0 and C1 control chars", () => {
    expect(IncomingPaths.sanitize("abcd.txt")).toBe("abcd.txt")
    expect(IncomingPaths.sanitize("xy.docx")).toBe("xy.docx")
  })

  test("rejects empty input", () => {
    expect(() => IncomingPaths.sanitize("")).toThrow(IncomingPaths.FilenameRejectedError)
  })

  test("rejects when only-control-chars become empty after strip", () => {
    expect(() => IncomingPaths.sanitize("")).toThrow(/empty after control-char strip/)
  })

  test("rejects path separators", () => {
    expect(() => IncomingPaths.sanitize("a/b.txt")).toThrow(/path separator/)
    expect(() => IncomingPaths.sanitize("a\\b.txt")).toThrow(/path separator/)
  })

  test("rejects . and .. segments", () => {
    expect(() => IncomingPaths.sanitize(".")).toThrow(/reserved segment/)
    expect(() => IncomingPaths.sanitize("..")).toThrow(/reserved segment/)
  })

  test("rejects NUL byte", () => {
    expect(() => IncomingPaths.sanitize("a\0b.txt")).toThrow(/NUL byte/)
  })

  test("rejects > 256 bytes (UTF-8)", () => {
    // each '中' is 3 bytes in UTF-8, so 100 chars = 300 bytes > 256
    const big = "中".repeat(100) + ".txt"
    expect(() => IncomingPaths.sanitize(big)).toThrow(/exceeds 256 bytes/)
  })

  test("accepts up to 256 bytes inclusive", () => {
    // 252 ASCII chars + .txt (4) = 256 bytes
    const ok = "a".repeat(252) + ".txt"
    expect(IncomingPaths.sanitize(ok)).toBe(ok)
  })
})

describe("IncomingPaths.stem", () => {
  test("strips last extension", () => {
    expect(IncomingPaths.stem("合約.docx")).toBe("合約")
    expect(IncomingPaths.stem("a.b.docx")).toBe("a.b")
    expect(IncomingPaths.stem("noext")).toBe("noext")
  })
})

describe("IncomingPaths.nextConflictName", () => {
  let tmpdir: string

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "incoming-paths-test-"))
  })

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true })
  })

  test("returns ' (2)' suffix when original exists", () => {
    fs.writeFileSync(path.join(tmpdir, "合約.docx"), "")
    expect(IncomingPaths.nextConflictName(tmpdir, "合約.docx")).toBe("合約 (2).docx")
  })

  test("increments past existing suffixes", () => {
    fs.writeFileSync(path.join(tmpdir, "合約.docx"), "")
    fs.writeFileSync(path.join(tmpdir, "合約 (2).docx"), "")
    fs.writeFileSync(path.join(tmpdir, "合約 (3).docx"), "")
    expect(IncomingPaths.nextConflictName(tmpdir, "合約.docx")).toBe("合約 (4).docx")
  })

  test("works for ext-less names", () => {
    fs.writeFileSync(path.join(tmpdir, "README"), "")
    expect(IncomingPaths.nextConflictName(tmpdir, "README")).toBe("README (2)")
  })
})

describe("IncomingPaths.projectRoot (DD-1)", () => {
  test("throws NoProjectPathError when no Instance context (global fallback)", () => {
    // Outside of Instance.provide(), Instance.project returns the "global"
    // fallback which has id === "global". DD-1 says treat that as no project.
    expect(() => IncomingPaths.projectRoot()).toThrow(IncomingPaths.NoProjectPathError)
  })
})
