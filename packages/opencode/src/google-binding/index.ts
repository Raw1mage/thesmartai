import path from "path"
import fs from "fs/promises"
import z from "zod"
import { Log } from "../util/log"
import { debugCheckpoint } from "../util/debug"

const log = Log.create({ service: "google-binding" })

const GOOGLE_BINDINGS_PATH_DEFAULT = "/etc/opencode/google-bindings.json"
const GOOGLE_BINDINGS_PATH_ENV = "OPENCODE_GOOGLE_BINDINGS_PATH"

/**
 * Google Binding Registry — manages Linux user ↔ Google identity bindings.
 *
 * Storage format: simple JSON record { "google_email": "linux_username" }
 * Location: /etc/opencode/google-bindings.json (or OPENCODE_GOOGLE_BINDINGS_PATH override)
 *
 * The C gateway reads this file for Google login routing.
 * Per-user daemons write to it via group-writable permissions.
 *
 * Cardinality: 1:1 — one Google email maps to exactly one Linux user, and vice versa.
 */
export namespace GoogleBinding {
  // Schema: record of google_email → linux_username
  const Registry = z.record(z.string(), z.string())
  type Registry = z.infer<typeof Registry>

  // --- File path ---

  function registryPath(): string {
    return process.env[GOOGLE_BINDINGS_PATH_ENV] || GOOGLE_BINDINGS_PATH_DEFAULT
  }

  // --- Mtime-based cache ---

  let _registry: Registry | undefined
  let _mtime: number | undefined

  async function getDiskMtime(): Promise<number | undefined> {
    const file = Bun.file(registryPath())
    if (!(await file.exists())) return
    const mtime = file.lastModified
    if (typeof mtime !== "number") return
    return mtime
  }

  async function state(): Promise<Registry> {
    if (_registry) {
      const mtime = await getDiskMtime()
      if (mtime === _mtime) {
        debugCheckpoint("GoogleBinding.state", "Using cached state")
        return _registry
      }
      debugCheckpoint("GoogleBinding.state", "Loading from disk", { reason: "mtime-changed" })
    } else {
      debugCheckpoint("GoogleBinding.state", "Loading from disk", { reason: "no-cache" })
    }

    _registry = await load()
    _mtime = await getDiskMtime()
    return _registry
  }

  async function load(): Promise<Registry> {
    const fp = registryPath()
    const file = Bun.file(fp)

    if (!(await file.exists())) {
      log.info("Binding registry not found, returning empty", { path: fp })
      return {}
    }

    try {
      const data = await file.json()
      const parsed = Registry.safeParse(data)
      if (!parsed.success) {
        log.warn("Invalid binding registry format", { path: fp, error: parsed.error })
        return {}
      }
      debugCheckpoint("GoogleBinding.load", "Loaded", { entries: Object.keys(parsed.data).length })
      return parsed.data
    } catch (e) {
      log.warn("Failed to read binding registry", {
        path: fp,
        error: e instanceof Error ? e.message : String(e),
      })
      return {}
    }
  }

  async function save(registry: Registry): Promise<void> {
    const fp = registryPath()
    debugCheckpoint("GoogleBinding.save", "Writing", { path: fp })
    try {
      const content = JSON.stringify(registry, null, 2)

      // Atomic write: temp file + rename
      const tmpPath = `${fp}.tmp.${process.pid}`
      await Bun.write(tmpPath, content)
      await fs.chmod(tmpPath, 0o664)
      await fs.rename(tmpPath, fp)

      _registry = registry
      _mtime = await getDiskMtime()
      debugCheckpoint("GoogleBinding.save", "Write successful", { entries: Object.keys(registry).length })
    } catch (e) {
      debugCheckpoint("GoogleBinding.save", "Write failed", {
        error: e instanceof Error ? e.message : String(e),
      })
      throw e
    }
  }

  // --- Promise-chain mutex ---

  let _mutexChain: Promise<void> = Promise.resolve()
  function withMutex<T>(fn: () => Promise<T>): Promise<T> {
    const result = _mutexChain.then(fn, fn)
    _mutexChain = result.then(
      () => {},
      () => {},
    )
    return result
  }

  // --- Public API ---

  /**
   * Look up the Linux username bound to a Google email.
   */
  export async function lookup(email: string): Promise<string | undefined> {
    const registry = await state()
    return registry[email]
  }

  /**
   * Look up the Google email bound to a Linux username (reverse lookup).
   */
  export async function getByUsername(username: string): Promise<string | undefined> {
    const registry = await state()
    for (const [email, user] of Object.entries(registry)) {
      if (user === username) return email
    }
    return undefined
  }

  /**
   * Bind a Google email to a Linux username.
   * Enforces 1:1 cardinality — throws if email or username already bound.
   */
  export function bind(email: string, username: string): Promise<void> {
    return withMutex(async () => {
      const registry = await state()

      // Check email uniqueness
      if (registry[email]) {
        const msg = `Google email '${email}' is already bound to Linux user '${registry[email]}'`
        log.warn("Binding rejected: email already bound", { email, existingUser: registry[email] })
        throw new Error(msg)
      }

      // Check username uniqueness (reverse direction)
      for (const [existingEmail, user] of Object.entries(registry)) {
        if (user === username) {
          const msg = `Linux user '${username}' is already bound to Google email '${existingEmail}'`
          log.warn("Binding rejected: username already bound", { username, existingEmail })
          throw new Error(msg)
        }
      }

      registry[email] = username
      await save(registry)
      log.info("Google binding created", { email, username })
    })
  }

  /**
   * Remove the binding for a Linux username.
   */
  export function unbind(username: string): Promise<void> {
    return withMutex(async () => {
      const registry = await state()
      let found = false

      for (const [email, user] of Object.entries(registry)) {
        if (user === username) {
          delete registry[email]
          found = true
          log.info("Google binding removed", { email, username })
          break
        }
      }

      if (!found) {
        log.info("No binding found to remove", { username })
        return
      }

      await save(registry)
    })
  }

  /**
   * List all bindings.
   */
  export async function list(): Promise<Registry> {
    return await state()
  }
}
