import fs from "node:fs/promises"
import fssync from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"
import { IncomingPaths } from "./paths"
import { Log } from "../util/log"
import { Bus } from "@/bus"
import { BusEvent } from "../bus/bus-event"
import z from "zod"

/**
 * Per-file append-only history journal under incoming/.history/<filename>.jsonl.
 *
 * Implements R2 (per-file history), R5/DD-7 (currentSha is the live record,
 * not historical), R7/DD-6 (lookup-time stat-based drift detection),
 * DD-13 (1000-line rotation).
 */
export namespace IncomingHistory {
  const log = Log.create({ service: "incoming.history" })
  const ROTATE_THRESHOLD_LINES = 1000
  const SCHEMA_VERSION = 1

  export const SourceKind = z.enum([
    "upload",
    "upload-dedupe",
    "upload-conflict-rename",
    "tool:Write",
    "tool:Edit",
    "tool:Bash",
    "tool:mcp",
    "drift-detected",
    "bundle-published",
  ])
  export type SourceKind = z.infer<typeof SourceKind>

  export const Entry = z
    .object({
      version: z.number().int().min(1),
      ts: z.string(),
      source: SourceKind,
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      sizeBytes: z.number().int().min(0).optional(),
      mtime: z.number().int().min(0).optional(),
      mime: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
      annotation: z.string().nullable().optional(),
      redirectedTo: z.string().nullable().optional(),
    })
    .passthrough()
  export type Entry = z.infer<typeof Entry>

  export const Appended = BusEvent.define(
    "incoming.history.appended",
    z.object({
      repoPath: z.string(),
      source: SourceKind,
      sha256: z.string(),
      historyVersion: z.number(),
      sessionId: z.string().nullable(),
    }),
  )

  /**
   * Build a fresh entry with version + ts auto-populated. Caller fills the
   * rest. Use this rather than hand-rolling { version: 1, ts: ... } to
   * keep schema_version drift in one place.
   */
  export function makeEntry(partial: Omit<Entry, "version" | "ts"> & { ts?: string }): Entry {
    return Entry.parse({
      version: SCHEMA_VERSION,
      ts: partial.ts ?? new Date().toISOString(),
      ...partial,
    })
  }

  async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
  }

  async function lineCount(filepath: string): Promise<number> {
    try {
      const buf = await fs.readFile(filepath)
      if (buf.length === 0) return 0
      let n = 0
      for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) n++
      // count last line if file does not end in newline
      if (buf[buf.length - 1] !== 0x0a) n++
      return n
    } catch (err: any) {
      if (err?.code === "ENOENT") return 0
      throw err
    }
  }

  /**
   * Atomic rotation: rename the current file to <filename>.<ts>.jsonl.
   * The next append() call will create a fresh empty file.
   */
  async function rotateIfNeeded(filename: string, root?: string): Promise<void> {
    const filepath = IncomingPaths.historyFile(filename, root)
    const count = await lineCount(filepath)
    if (count < ROTATE_THRESHOLD_LINES) return
    const rotated = IncomingPaths.rotatedHistoryFile(filename, Math.floor(Date.now() / 1000), root)
    try {
      await fs.rename(filepath, rotated)
      log.info("history rotated", { filename, lineCount: count, rotated: path.basename(rotated) })
    } catch (err: any) {
      if (err?.code === "ENOENT") return
      throw err
    }
  }

  /**
   * Append a single line to <filename>.jsonl. Creates the file (and
   * incoming/.history/) if missing. Rotates first if at threshold.
   *
   * Concurrency: relies on POSIX O_APPEND atomicity for line-sized writes.
   * Multiple daemon processes appending concurrently will not interleave
   * mid-line (jsonl entries here are < PIPE_BUF = 4096 bytes for normal
   * use). Cross-process locking is the caller's responsibility if entries
   * are larger.
   */
  export async function appendEntry(
    filename: string,
    entry: Entry,
    options?: { root?: string; emitBus?: boolean },
  ): Promise<{ historyVersion: number }> {
    const safeName = IncomingPaths.sanitize(filename)
    const root = options?.root
    const dir = IncomingPaths.historyDir(root)
    await ensureDir(dir)
    await rotateIfNeeded(safeName, root)
    const filepath = IncomingPaths.historyFile(safeName, root)
    const line = JSON.stringify(entry) + "\n"
    // Use sync FD with O_APPEND for atomicity on line-sized writes.
    const fd = fssync.openSync(filepath, fssync.constants.O_WRONLY | fssync.constants.O_APPEND | fssync.constants.O_CREAT, 0o644)
    try {
      fssync.writeSync(fd, line)
    } finally {
      fssync.closeSync(fd)
    }
    const historyVersion = await lineCount(filepath)
    if (options?.emitBus !== false) {
      await Bus.publish(Appended, {
        repoPath: path.join(IncomingPaths.INCOMING_DIR, safeName),
        source: entry.source,
        sha256: entry.sha256,
        historyVersion,
        sessionId: entry.sessionId ?? null,
      }).catch(() => {})
    }
    return { historyVersion }
  }

  /**
   * Read the last entry of <filename>.jsonl. Returns null if no history
   * exists (no journal file or empty).
   */
  export async function readTail(filename: string, root?: string): Promise<Entry | null> {
    const safeName = IncomingPaths.sanitize(filename)
    const filepath = IncomingPaths.historyFile(safeName, root)
    let buf: Buffer
    try {
      buf = await fs.readFile(filepath)
    } catch (err: any) {
      if (err?.code === "ENOENT") return null
      throw err
    }
    if (buf.length === 0) return null
    // Trim trailing newline, find last \n boundary
    let end = buf.length
    while (end > 0 && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d)) end--
    let start = end - 1
    while (start > 0 && buf[start - 1] !== 0x0a) start--
    const lastLine = buf.subarray(start, end).toString("utf8").trim()
    if (!lastLine) return null
    try {
      return Entry.parse(JSON.parse(lastLine))
    } catch (err) {
      log.warn("history readTail: malformed last line", { filename: safeName, error: String(err) })
      return null
    }
  }

  /**
   * R7/DD-6: cheap-stat drift detection. Compares the live file's mtime
   * and sizeBytes against the most recent history entry. On mismatch,
   * recompute sha256 and append a `drift-detected` entry. Returns the
   * authoritative sha for the slot.
   *
   * Returns null if the slot has no history AND no live file.
   */
  export async function lookupCurrentSha(filename: string, root?: string): Promise<string | null> {
    const safeName = IncomingPaths.sanitize(filename)
    const targetPath = IncomingPaths.targetFile(safeName, root)
    let stat: fssync.Stats
    try {
      stat = await fs.stat(targetPath)
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        // No live file. Return last known sha from history if any.
        const tail = await readTail(safeName, root)
        return tail?.sha256 ?? null
      }
      throw err
    }
    const tail = await readTail(safeName, root)
    if (tail) {
      const tailMtime = tail.mtime ?? 0
      const tailSize = tail.sizeBytes ?? -1
      const liveMtime = Math.floor(stat.mtimeMs)
      const liveSize = stat.size
      if (tailMtime === liveMtime && tailSize === liveSize) {
        // No drift; trust history's sha.
        return tail.sha256
      }
    }
    // Drift detected (or no history): recompute and append.
    const sha = await computeSha256(targetPath)
    await appendEntry(safeName, makeEntry({
      source: "drift-detected",
      sha256: sha,
      sizeBytes: stat.size,
      mtime: Math.floor(stat.mtimeMs),
      sessionId: null,
    }), { root })
    return sha
  }

  /**
   * Compute sha256 of a file via streaming read. Used at upload time and
   * by drift detection.
   */
  export async function computeSha256(filepath: string): Promise<string> {
    const stream = fssync.createReadStream(filepath)
    const hash = createHash("sha256")
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk))
      stream.on("end", () => resolve(hash.digest("hex")))
      stream.on("error", reject)
    })
  }

  /**
   * Convenience: append a `tool:<name>` entry after a tool wrote to an
   * incoming/ path. Hash is recomputed from the live file.
   */
  export async function touchAfterToolWrite(
    filename: string,
    toolName: string,
    sessionId: string | null,
    options?: { root?: string },
  ): Promise<string> {
    const safeName = IncomingPaths.sanitize(filename)
    const targetPath = IncomingPaths.targetFile(safeName, options?.root)
    const stat = await fs.stat(targetPath)
    const sha = await computeSha256(targetPath)
    await appendEntry(safeName, makeEntry({
      source: toolName.startsWith("tool:") ? toolName as SourceKind : (`tool:${toolName}` as SourceKind),
      sha256: sha,
      sizeBytes: stat.size,
      mtime: Math.floor(stat.mtimeMs),
      sessionId,
    }), { root: options?.root })
    return sha
  }
}
