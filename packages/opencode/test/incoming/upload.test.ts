/**
 * upload.test.ts — Phase 2 of /specs/repo-incoming-attachments/.
 *
 * Covers DD-17 main path through tryLandInIncoming:
 *   - fresh upload → file lands, history records `upload`, returns repoPath + sha256
 *   - identical re-upload → no fs rewrite, history records `upload-dedupe` (R5-S2)
 *   - same name different content → conflict-rename to "(2)", original slot
 *     records `upload-conflict-rename` with redirectedTo (R5-S1, DD-8)
 *   - missing filename → returns null (caller falls back to legacy storage)
 *   - sanitizable filename with control chars → cleaned and lands
 *
 * Project context is provided via Instance.provide(). All test artifacts
 * live in a per-test temp dir.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "node:fs"
import fsAsync from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"

import { tryLandInIncoming } from "../../src/session/user-message-parts"
import { IncomingPaths } from "../../src/incoming/paths"
import { IncomingHistory } from "../../src/incoming/history"
import { Instance } from "../../src/project/instance"

let tmpdir: string

function asBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}

function readJsonl(filename: string): Array<Record<string, unknown>> {
  const full = path.join(tmpdir, IncomingPaths.INCOMING_DIR, IncomingPaths.HISTORY_DIR, `${filename}.jsonl`)
  if (!fs.existsSync(full)) return []
  return fs
    .readFileSync(full, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

async function inProject<R>(fn: () => Promise<R>): Promise<R> {
  return Instance.provide({
    directory: tmpdir,
    fn,
  })
}

beforeEach(() => {
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "incoming-upload-test-"))
  // Make tmpdir a "real" project: init a git repo so Instance.fromDirectory
  // doesn't degrade to project.id === "global".
  fs.mkdirSync(path.join(tmpdir, ".git"), { recursive: true })
  fs.writeFileSync(path.join(tmpdir, ".git", "HEAD"), "ref: refs/heads/main\n")
  fs.writeFileSync(path.join(tmpdir, ".git", "config"), "[core]\n\trepositoryformatversion = 0\n")
  fs.mkdirSync(path.join(tmpdir, ".git", "objects"), { recursive: true })
  fs.mkdirSync(path.join(tmpdir, ".git", "refs", "heads"), { recursive: true })
  // Skip the `git rev-list --max-parents=0 --all` lookup by pre-writing the
  // cached project id. Project.fromDirectory honours this and avoids
  // invoking the git binary.
  fs.writeFileSync(path.join(tmpdir, ".git", "opencode"), "incoming-upload-test-fixture-id")
})

afterEach(() => {
  fs.rmSync(tmpdir, { recursive: true, force: true })
})

describe("tryLandInIncoming — fresh upload", () => {
  test("writes file to incoming/, appends history, returns repoPath+sha256", async () => {
    const bytes = asBytes("hello world")
    const expectedSha = sha256Hex("hello world")

    const result = await inProject(() =>
      tryLandInIncoming({ filename: "合約.docx", bytes, sessionID: "s-1" }),
    )

    expect(result).not.toBeNull()
    expect(result!.repoPath).toBe("incoming/合約.docx")
    expect(result!.sha256).toBe(expectedSha)

    const fileBytes = await fsAsync.readFile(path.join(tmpdir, "incoming/合約.docx"))
    expect(fileBytes.toString()).toBe("hello world")

    const lines = readJsonl("合約.docx")
    expect(lines.length).toBe(1)
    expect(lines[0]!.source).toBe("upload")
    expect(lines[0]!.sha256).toBe(expectedSha)
    expect(lines[0]!.sessionId).toBe("s-1")
  })

  test("returns null when filename is missing (caller falls back to legacy)", async () => {
    const result = await inProject(() =>
      tryLandInIncoming({ filename: undefined, bytes: asBytes("x"), sessionID: "s-1" }),
    )
    expect(result).toBeNull()
  })
})

describe("tryLandInIncoming — dedupe (R5-S2)", () => {
  test("identical content + name → no fs rewrite, dedupe history entry", async () => {
    const bytes = asBytes("same")
    const expectedSha = sha256Hex("same")

    await inProject(async () => {
      await tryLandInIncoming({ filename: "f.txt", bytes, sessionID: "s-1" })
    })
    const firstStat = fs.statSync(path.join(tmpdir, "incoming/f.txt"))

    // wait so any rewrite would shift mtime
    await new Promise((r) => setTimeout(r, 25))

    const result = await inProject(() =>
      tryLandInIncoming({ filename: "f.txt", bytes, sessionID: "s-2" }),
    )
    expect(result).not.toBeNull()
    expect(result!.sha256).toBe(expectedSha)

    const stat2 = fs.statSync(path.join(tmpdir, "incoming/f.txt"))
    expect(stat2.mtimeMs).toBe(firstStat.mtimeMs)

    const lines = readJsonl("f.txt")
    expect(lines.length).toBe(2)
    expect(lines[1]!.source).toBe("upload-dedupe")
    expect(lines[1]!.sha256).toBe(expectedSha)
  })
})

describe("tryLandInIncoming — conflict-rename (R5-S1, DD-8)", () => {
  test("same name different content → suffix '(2)', original slot redirect entry", async () => {
    await inProject(async () => {
      await tryLandInIncoming({ filename: "doc.txt", bytes: asBytes("v1"), sessionID: "s-1" })
    })
    const result = await inProject(() =>
      tryLandInIncoming({ filename: "doc.txt", bytes: asBytes("v2-different"), sessionID: "s-1" }),
    )
    expect(result).not.toBeNull()
    expect(result!.repoPath).toBe("incoming/doc (2).txt")

    expect(fs.readFileSync(path.join(tmpdir, "incoming/doc.txt"), "utf8")).toBe("v1")
    expect(fs.readFileSync(path.join(tmpdir, "incoming/doc (2).txt"), "utf8")).toBe("v2-different")

    const orig = readJsonl("doc.txt")
    expect(orig.length).toBeGreaterThanOrEqual(2)
    const last = orig[orig.length - 1]!
    expect(last.source).toBe("upload-conflict-rename")
    expect(last.redirectedTo).toBe("doc (2).txt")

    const renamed = readJsonl("doc (2).txt")
    expect(renamed.length).toBe(1)
    expect(renamed[0]!.source).toBe("upload")
    expect(renamed[0]!.sha256).toBe(sha256Hex("v2-different"))
  })
})

describe("tryLandInIncoming — DD-12 sanitize integration", () => {
  test("filename containing control chars is sanitized, lands cleanly", async () => {
    const dirty = "abcd.txt"
    const result = await inProject(() =>
      tryLandInIncoming({ filename: dirty, bytes: asBytes("body"), sessionID: "s-1" }),
    )
    expect(result).not.toBeNull()
    expect(result!.repoPath).toBe("incoming/abcd.txt")
    expect(fs.existsSync(path.join(tmpdir, "incoming/abcd.txt"))).toBe(true)
  })
})

describe("tryLandInIncoming — drift-tolerant lookupCurrentSha", () => {
  test("after fresh upload, lookupCurrentSha returns the same sha without recompute", async () => {
    const bytes = asBytes("foo")
    const expectedSha = sha256Hex("foo")
    await inProject(() =>
      tryLandInIncoming({ filename: "foo.txt", bytes, sessionID: "s-1" }),
    )
    const sha = await IncomingHistory.lookupCurrentSha("foo.txt", tmpdir)
    expect(sha).toBe(expectedSha)
    // No drift entry should appear: history still has just the upload entry.
    const lines = readJsonl("foo.txt")
    expect(lines.length).toBe(1)
    expect(lines[0]!.source).toBe("upload")
  })
})
