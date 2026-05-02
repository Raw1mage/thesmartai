/**
 * history.test.ts — Phase 1 of /specs/repo-incoming-attachments/.
 *
 * Covers R2 (per-file jsonl), R5/DD-7 (currentSha follows live state),
 * R7/DD-6 (drift detection on stat mismatch), DD-13 (rotation at 1000 lines),
 * and forward-compat reading of older entries.
 *
 * Uses a temp dir as `root` to avoid touching the daemon's real
 * Instance.project. All tests pass `{ root: tmpdir, emitBus: false }` to
 * the history APIs.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { IncomingHistory } from "../../src/incoming/history"
import { IncomingPaths } from "../../src/incoming/paths"

let tmpdir: string

function makeIncomingDir() {
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "incoming-history-test-"))
  fs.mkdirSync(path.join(tmpdir, IncomingPaths.INCOMING_DIR), { recursive: true })
}

function writeIncomingFile(filename: string, content: string): void {
  fs.writeFileSync(path.join(tmpdir, IncomingPaths.INCOMING_DIR, filename), content)
}

beforeEach(makeIncomingDir)
afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }))

describe("IncomingHistory.makeEntry + appendEntry + readTail", () => {
  test("appends an entry and reads it back", async () => {
    const entry = IncomingHistory.makeEntry({
      source: "upload",
      sha256: "a".repeat(64),
      sizeBytes: 100,
      mtime: 1000,
      sessionId: "s-1",
    })
    const { historyVersion } = await IncomingHistory.appendEntry("foo.txt", entry, {
      root: tmpdir,
      emitBus: false,
    })
    expect(historyVersion).toBe(1)
    const tail = await IncomingHistory.readTail("foo.txt", tmpdir)
    expect(tail).not.toBeNull()
    expect(tail!.sha256).toBe("a".repeat(64))
    expect(tail!.source).toBe("upload")
  })

  test("readTail returns null when no history", async () => {
    expect(await IncomingHistory.readTail("none.txt", tmpdir)).toBeNull()
  })

  test("appends multiple entries, tail returns the last", async () => {
    for (let i = 0; i < 3; i++) {
      await IncomingHistory.appendEntry(
        "foo.txt",
        IncomingHistory.makeEntry({
          source: "upload",
          sha256: String(i).padStart(64, "0"),
        }),
        { root: tmpdir, emitBus: false },
      )
    }
    const tail = await IncomingHistory.readTail("foo.txt", tmpdir)
    expect(tail!.sha256).toBe("2".padStart(64, "0"))
    const file = path.join(tmpdir, IncomingPaths.INCOMING_DIR, IncomingPaths.HISTORY_DIR, "foo.txt.jsonl")
    expect(fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length).toBe(3)
  })
})

describe("IncomingHistory forward-compat (R2-S2)", () => {
  test("readTail accepts a v1 line missing optional fields", async () => {
    const dir = path.join(tmpdir, IncomingPaths.INCOMING_DIR, IncomingPaths.HISTORY_DIR)
    fs.mkdirSync(dir, { recursive: true })
    const oldLine = JSON.stringify({
      version: 1,
      ts: "2026-04-01T00:00:00Z",
      source: "upload",
      sha256: "c".repeat(64),
      sizeBytes: 100,
    })
    fs.writeFileSync(path.join(dir, "old.docx.jsonl"), oldLine + "\n")
    const tail = await IncomingHistory.readTail("old.docx", tmpdir)
    expect(tail).not.toBeNull()
    expect(tail!.sha256).toBe("c".repeat(64))
    expect(tail!.mime ?? null).toBeNull()
  })
})

describe("IncomingHistory.lookupCurrentSha drift detection (R7/DD-6)", () => {
  test("no drift: stat matches → returns history sha without recompute", async () => {
    const filename = "stable.txt"
    writeIncomingFile(filename, "hello world")
    const live = path.join(tmpdir, IncomingPaths.INCOMING_DIR, filename)
    const stat = fs.statSync(live)
    const realSha = await IncomingHistory.computeSha256(live)
    await IncomingHistory.appendEntry(
      filename,
      IncomingHistory.makeEntry({
        source: "upload",
        sha256: realSha,
        sizeBytes: stat.size,
        mtime: Math.floor(stat.mtimeMs),
      }),
      { root: tmpdir, emitBus: false },
    )
    const sha = await IncomingHistory.lookupCurrentSha(filename, tmpdir)
    expect(sha).toBe(realSha)
    // Should be no drift entry appended
    const lines = fs
      .readFileSync(path.join(tmpdir, "incoming/.history/stable.txt.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
    expect(lines.length).toBe(1)
  })

  test("drift detected: external write changes mtime+size → recomputes + appends drift entry", async () => {
    const filename = "drifty.txt"
    writeIncomingFile(filename, "v1")
    const live = path.join(tmpdir, IncomingPaths.INCOMING_DIR, filename)
    let stat = fs.statSync(live)
    const sha1 = await IncomingHistory.computeSha256(live)
    await IncomingHistory.appendEntry(
      filename,
      IncomingHistory.makeEntry({
        source: "upload",
        sha256: sha1,
        sizeBytes: stat.size,
        mtime: Math.floor(stat.mtimeMs),
      }),
      { root: tmpdir, emitBus: false },
    )
    // Force mtime tick and content change
    await new Promise((r) => setTimeout(r, 20))
    fs.writeFileSync(live, "v2-different-content")
    stat = fs.statSync(live)

    const sha = await IncomingHistory.lookupCurrentSha(filename, tmpdir)
    const expected = await IncomingHistory.computeSha256(live)
    expect(sha).toBe(expected)
    expect(sha).not.toBe(sha1)

    const lines = fs
      .readFileSync(path.join(tmpdir, "incoming/.history/drifty.txt.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
    expect(lines.length).toBe(2)
    const last = JSON.parse(lines[1]!)
    expect(last.source).toBe("drift-detected")
    expect(last.sha256).toBe(expected)
    expect(last.sessionId).toBeNull()
  })
})

describe("IncomingHistory rotation (DD-13)", () => {
  test("rotates at 1000 lines: old file renamed with timestamp, new file resets", async () => {
    const filename = "heavy.txt"
    // Pre-fill to exactly 1000 lines so the next append triggers rotation.
    const dir = path.join(tmpdir, IncomingPaths.INCOMING_DIR, IncomingPaths.HISTORY_DIR)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, "heavy.txt.jsonl")
    const lines: string[] = []
    for (let i = 0; i < 1000; i++) {
      lines.push(
        JSON.stringify(
          IncomingHistory.makeEntry({ source: "upload", sha256: String(i).padStart(64, "0") }),
        ),
      )
    }
    fs.writeFileSync(file, lines.join("\n") + "\n")
    expect(fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length).toBe(1000)

    await IncomingHistory.appendEntry(
      filename,
      IncomingHistory.makeEntry({ source: "upload", sha256: "f".repeat(64) }),
      { root: tmpdir, emitBus: false },
    )

    // After rotate: heavy.txt.jsonl should have only the new entry,
    // and a heavy.txt.<ts>.jsonl should exist with the old 1000.
    const newLines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean)
    expect(newLines.length).toBe(1)
    expect(JSON.parse(newLines[0]!).sha256).toBe("f".repeat(64))

    const rotated = fs
      .readdirSync(dir)
      .filter((n) => /^heavy\.txt\.\d+\.jsonl$/.test(n))
    expect(rotated.length).toBe(1)
    const rotatedLines = fs.readFileSync(path.join(dir, rotated[0]!), "utf8").split("\n").filter(Boolean)
    expect(rotatedLines.length).toBe(1000)
  })
})
