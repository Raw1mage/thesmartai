/**
 * Per-user daemon discovery and lifecycle management.
 *
 * Discovery file: $XDG_RUNTIME_DIR/opencode/daemon.json
 * PID file:       $XDG_RUNTIME_DIR/opencode/daemon.pid
 * Unix socket:    $XDG_RUNTIME_DIR/opencode/daemon.sock
 *
 * @event_20260319_daemonization Phase β
 */
import fs from "fs/promises"
import path from "path"
import os from "os"

export namespace Daemon {
  export type Info = {
    socketPath: string
    pid: number
    startedAt: number
    version: string
  }

  function runtimeDir(): string {
    // XDG_RUNTIME_DIR is typically /run/user/<uid> on systemd systems
    const xdg = process.env.XDG_RUNTIME_DIR
    if (xdg) return path.join(xdg, "opencode")
    // Fallback: /tmp/opencode-<uid>
    const uid = process.getuid?.() ?? "user"
    return path.join(os.tmpdir(), `opencode-${uid}`)
  }

  export function daemonDir(): string {
    return runtimeDir()
  }

  export function discoveryPath(): string {
    return path.join(runtimeDir(), "daemon.json")
  }

  export function pidPath(): string {
    return path.join(runtimeDir(), "daemon.pid")
  }

  export function socketPath(): string {
    return path.join(runtimeDir(), "daemon.sock")
  }

  export async function ensureDir(): Promise<void> {
    await fs.mkdir(runtimeDir(), { recursive: true })
  }

  /** Write discovery file and PID file atomically after daemon is ready. */
  export async function writeDiscovery(info: Info): Promise<void> {
    await ensureDir()
    await Bun.write(discoveryPath(), JSON.stringify(info, null, 2))
    await Bun.write(pidPath(), String(info.pid))
  }

  /** Remove discovery and PID files on clean shutdown. */
  export async function removeDiscovery(): Promise<void> {
    await fs.rm(discoveryPath(), { force: true })
    await fs.rm(pidPath(), { force: true })
    await fs.rm(socketPath(), { force: true })
  }

  /** Read and validate discovery file. Returns null if missing or stale. */
  export async function readDiscovery(): Promise<Info | null> {
    const file = Bun.file(discoveryPath())
    if (!(await file.exists())) return null
    let info: Info
    try {
      info = JSON.parse(await file.text())
    } catch {
      return null
    }
    // Validate PID is still alive
    if (!isPidAlive(info.pid)) {
      // Stale file — clean up so next invocation starts fresh
      await removeDiscovery().catch(() => {})
      return null
    }
    return info
  }

  /** Check if a PID is still alive using kill -0 semantics. */
  export function isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  /**
   * Prevent duplicate daemon for the same user.
   * Returns existing PID if already running, null otherwise.
   */
  export async function checkSingleInstance(): Promise<number | null> {
    const file = Bun.file(pidPath())
    if (!(await file.exists())) return null
    let pid: number
    try {
      pid = parseInt(await file.text(), 10)
    } catch {
      return null
    }
    if (isNaN(pid)) return null
    if (isPidAlive(pid)) return pid
    // Stale PID file
    await fs.rm(pidPath(), { force: true })
    return null
  }
}
