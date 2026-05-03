import { Platform, usePlatform } from "@/context/platform"
import { makePersisted, type AsyncStorage, type SyncStorage } from "@solid-primitives/storage"
import { checksum } from "@opencode-ai/util/encode"
import { createResource, type Accessor, onCleanup } from "solid-js"
import type { SetStoreFunction, Store } from "solid-js/store"

type InitType = Promise<string> | string | null
type PersistedWithReady<T> = [Store<T>, SetStoreFunction<T>, InitType, Accessor<boolean>]

type PersistTarget = {
  storage?: string
  key: string
  legacy?: string[]
  migrate?: (value: unknown) => unknown
}

const LEGACY_STORAGE = "default.dat"
const GLOBAL_STORAGE = "opencode.global.dat"
const LOCAL_PREFIX = "opencode."
const fallback = new Map<string, boolean>()

const CACHE_MAX_ENTRIES = 500
const CACHE_MAX_BYTES = 8 * 1024 * 1024

type CacheEntry = { value: string; bytes: number }
const cache = new Map<string, CacheEntry>()
const cacheTotal = { bytes: 0 }

function cacheDelete(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  cacheTotal.bytes -= entry.bytes
  cache.delete(key)
}

function cachePrune() {
  for (;;) {
    if (cache.size <= CACHE_MAX_ENTRIES && cacheTotal.bytes <= CACHE_MAX_BYTES) return
    const oldest = cache.keys().next().value as string | undefined
    if (!oldest) return
    cacheDelete(oldest)
  }
}

function cacheSet(key: string, value: string) {
  const bytes = value.length * 2
  if (bytes > CACHE_MAX_BYTES) {
    cacheDelete(key)
    return
  }

  const entry = cache.get(key)
  if (entry) cacheTotal.bytes -= entry.bytes
  cache.delete(key)
  cache.set(key, { value, bytes })
  cacheTotal.bytes += bytes
  cachePrune()
}

function cacheGet(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function fallbackDisabled(scope: string) {
  return fallback.get(scope) === true
}

function fallbackSet(scope: string) {
  fallback.set(scope, true)
}

function quota(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "QuotaExceededError") return true
    if (error.name === "NS_ERROR_DOM_QUOTA_REACHED") return true
    if (error.name === "QUOTA_EXCEEDED_ERR") return true
    if (error.code === 22 || error.code === 1014) return true
    return false
  }

  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return true
  if (name && /quota/i.test(name)) return true

  const code = (error as { code?: number }).code
  if (code === 22 || code === 1014) return true

  const message = (error as { message?: string }).message
  if (typeof message !== "string") return false
  if (/quota/i.test(message)) return true
  return false
}

type Evict = { key: string; size: number }

function evict(storage: Storage, keep: string, value: string) {
  const total = storage.length
  const indexes = Array.from({ length: total }, (_, index) => index)
  const items: Evict[] = []

  for (const index of indexes) {
    const name = storage.key(index)
    if (!name) continue
    if (!name.startsWith(LOCAL_PREFIX)) continue
    if (name === keep) continue
    const stored = storage.getItem(name)
    items.push({ key: name, size: stored?.length ?? 0 })
  }

  items.sort((a, b) => b.size - a.size)

  // Surface quota-eviction events so the source of the leak is
  // discoverable. Without this, `server.v3` (sidebar tabs) silently
  // disappears on the next reload and the user has no way to know
  // which other key forced the eviction.
  const totalBytes = items.reduce((acc, x) => acc + x.size, 0)
  // eslint-disable-next-line no-console
  console.warn("[persist:evict] quota hit; pruning to fit `" + keep + "` (" + value.length + " bytes).", {
    keep,
    keepBytes: value.length,
    totalLocalBytes: totalBytes,
    top10: items.slice(0, 10).map((x) => ({ key: x.key, kb: +(x.size / 1024).toFixed(1) })),
  })

  const evicted: string[] = []
  for (const item of items) {
    storage.removeItem(item.key)
    cacheDelete(item.key)
    evicted.push(item.key)

    try {
      storage.setItem(keep, value)
      cacheSet(keep, value)
      // eslint-disable-next-line no-console
      console.warn("[persist:evict] freed", evicted.length, "key(s):", evicted)
      return true
    } catch (error) {
      if (!quota(error)) throw error
    }
  }

  // eslint-disable-next-line no-console
  console.error("[persist:evict] still cannot fit `" + keep + "` after evicting all " + items.length + " keys.")
  return false
}

function write(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
    cacheSet(key, value)
    return true
  } catch (error) {
    if (!quota(error)) throw error
  }

  try {
    storage.removeItem(key)
    cacheDelete(key)
    storage.setItem(key, value)
    cacheSet(key, value)
    return true
  } catch (error) {
    if (!quota(error)) throw error
  }

  const ok = evict(storage, key, value)
  return ok
}

function snapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function merge(defaults: unknown, value: unknown): unknown {
  if (value === undefined) return defaults
  if (value === null) return value

  if (Array.isArray(defaults)) {
    if (Array.isArray(value)) return value
    return defaults
  }

  if (isRecord(defaults)) {
    if (!isRecord(value)) return defaults

    const result: Record<string, unknown> = { ...defaults }
    for (const key of Object.keys(value)) {
      if (key in defaults) {
        result[key] = merge((defaults as Record<string, unknown>)[key], (value as Record<string, unknown>)[key])
      } else {
        result[key] = (value as Record<string, unknown>)[key]
      }
    }
    return result
  }

  return value
}

function parse(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function normalize(defaults: unknown, raw: string, migrate?: (value: unknown) => unknown) {
  const parsed = parse(raw)
  if (parsed === undefined) return
  const migrated = migrate ? migrate(parsed) : parsed
  const merged = merge(defaults, migrated)
  return JSON.stringify(merged)
}

function workspaceStorage(dir: string) {
  const head = dir.slice(0, 12) || "workspace"
  const sum = checksum(dir) ?? "0"
  return `opencode.workspace.${head}.${sum}.dat`
}

function localStorageWithPrefix(prefix: string): SyncStorage {
  const base = `${prefix}:`
  const scope = `prefix:${prefix}`
  const item = (key: string) => base + key
  return {
    getItem: (key) => {
      const name = item(key)
      const cached = cacheGet(name)
      if (fallbackDisabled(scope)) return cached ?? null

      const stored = (() => {
        try {
          return localStorage.getItem(name)
        } catch {
          fallbackSet(scope)
          return null
        }
      })()
      if (stored === null) return cached ?? null
      cacheSet(name, stored)
      return stored
    },
    setItem: (key, value) => {
      const name = item(key)
      if (fallbackDisabled(scope)) return
      try {
        if (write(localStorage, name, value)) return
      } catch {
        fallbackSet(scope)
        return
      }
      fallbackSet(scope)
    },
    removeItem: (key) => {
      const name = item(key)
      cacheDelete(name)
      if (fallbackDisabled(scope)) return
      try {
        localStorage.removeItem(name)
      } catch {
        fallbackSet(scope)
      }
    },
  }
}

function localStorageDirect(): SyncStorage {
  const scope = "direct"
  return {
    getItem: (key) => {
      const cached = cacheGet(key)
      if (fallbackDisabled(scope)) return cached ?? null

      const stored = (() => {
        try {
          return localStorage.getItem(key)
        } catch {
          fallbackSet(scope)
          return null
        }
      })()
      if (stored === null) return cached ?? null
      cacheSet(key, stored)
      return stored
    },
    setItem: (key, value) => {
      if (fallbackDisabled(scope)) return
      try {
        if (write(localStorage, key, value)) return
      } catch {
        fallbackSet(scope)
        return
      }
      fallbackSet(scope)
    },
    removeItem: (key) => {
      cacheDelete(key)
      if (fallbackDisabled(scope)) return
      try {
        localStorage.removeItem(key)
      } catch {
        fallbackSet(scope)
      }
    },
  }
}

export const PersistTesting = {
  localStorageDirect,
  localStorageWithPrefix,
  normalize,
}

// Diagnostic: at startup (and on demand from console), enumerate every
// localStorage entry under our prefix, decode the JSON, and report a
// per-sub-key size breakdown. Helps surface which persisted store is
// growing without bound — eviction otherwise drops `opencode.global.dat`
// silently and the user only notices that sidebar tabs / project list
// vanished after reload.
type StorageBreakdown = {
  bucket: string
  bytes: number
  topSubKeys: Array<{ key: string; kb: number }>
}

function decodeBucket(bucket: string, raw: string): StorageBreakdown {
  const out: StorageBreakdown = { bucket, bytes: raw.length, topSubKeys: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return out
  }
  if (!parsed || typeof parsed !== "object") return out
  const entries: Array<{ key: string; kb: number }> = []
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    let bytes: number
    try {
      bytes = JSON.stringify(value).length
    } catch {
      bytes = 0
    }
    entries.push({ key, kb: +(bytes / 1024).toFixed(1) })
  }
  entries.sort((a, b) => b.kb - a.kb)
  out.topSubKeys = entries.slice(0, 15)
  return out
}

export function persistDiagnostic(threshold = 2 * 1024 * 1024) {
  if (typeof localStorage === "undefined") return
  const buckets: StorageBreakdown[] = []
  let total = 0
  for (let i = 0; i < localStorage.length; i += 1) {
    const name = localStorage.key(i)
    if (!name || !name.startsWith(LOCAL_PREFIX)) continue
    const raw = localStorage.getItem(name) ?? ""
    total += raw.length
    if (raw.length < 50_000 && raw.length < threshold / 4) continue
    buckets.push(decodeBucket(name, raw))
  }
  buckets.sort((a, b) => b.bytes - a.bytes)
  if (total < threshold) {
    // eslint-disable-next-line no-console
    console.info("[persist] localStorage usage", {
      totalKb: +(total / 1024).toFixed(1),
      buckets: buckets.length,
      thresholdKb: +(threshold / 1024).toFixed(1),
    })
    return { totalBytes: total, buckets }
  }
  // eslint-disable-next-line no-console
  console.warn("[persist] LARGE localStorage", {
    totalKb: +(total / 1024).toFixed(1),
    note: "Approaching browser quota (typ 5–10MB). Sub-key breakdown below.",
  })
  for (const b of buckets) {
    // eslint-disable-next-line no-console
    console.warn(`[persist] ${b.bucket} (${(b.bytes / 1024).toFixed(1)} KB)`, b.topSubKeys)
  }
  return { totalBytes: total, buckets }
}

if (typeof window !== "undefined") {
  ;(window as unknown as { persistDiagnostic?: typeof persistDiagnostic }).persistDiagnostic = persistDiagnostic
  // Auto-scan only when the user explicitly opts in via
  // `localStorage["opencode.persist.debug"] = "1"`. Otherwise the call
  // is on-demand via `window.persistDiagnostic()` from the console.
  // We previously auto-ran on every page load to surface quota issues
  // proactively, but it added a [Violation] warning + an info log to
  // every healthy session and the actual quota bug never reproduced.
  let force = false
  try {
    force = localStorage.getItem("opencode.persist.debug") === "1"
  } catch {
    // ignore
  }
  if (force) {
    setTimeout(() => persistDiagnostic(0), 1500)
  }
}

export const Persist = {
  global(key: string, legacy?: string[]): PersistTarget {
    return { storage: GLOBAL_STORAGE, key, legacy }
  },
  workspace(dir: string, key: string, legacy?: string[]): PersistTarget {
    return { storage: workspaceStorage(dir), key: `workspace:${key}`, legacy }
  },
  session(dir: string, session: string, key: string, legacy?: string[]): PersistTarget {
    return { storage: workspaceStorage(dir), key: `session:${session}:${key}`, legacy }
  },
  scoped(dir: string, session: string | undefined, key: string, legacy?: string[]): PersistTarget {
    if (session) return Persist.session(dir, session, key, legacy)
    return Persist.workspace(dir, key, legacy)
  },
}

export function removePersisted(target: { storage?: string; key: string }, platform?: Platform) {
  const isDesktop = platform?.platform === "desktop" && !!platform.storage

  if (isDesktop) {
    return platform.storage?.(target.storage)?.removeItem(target.key)
  }

  if (!target.storage) {
    localStorageDirect().removeItem(target.key)
    return
  }

  localStorageWithPrefix(target.storage).removeItem(target.key)
}

export function persisted<T>(
  target: string | PersistTarget,
  store: [Store<T>, SetStoreFunction<T>],
): PersistedWithReady<T> {
  const platform = usePlatform()
  const config: PersistTarget = typeof target === "string" ? { key: target } : target
  let timeout: ReturnType<typeof setTimeout>

  const defaults = snapshot(store[0])
  const legacy = config.legacy ?? []

  const isDesktop = platform.platform === "desktop" && !!platform.storage

  const currentStorage = (() => {
    if (isDesktop) return platform.storage?.(config.storage)
    if (!config.storage) return localStorageDirect()
    return localStorageWithPrefix(config.storage)
  })()

  const legacyStorage = (() => {
    if (!isDesktop) return localStorageDirect()
    if (!config.storage) return platform.storage?.()
    return platform.storage?.(LEGACY_STORAGE)
  })()

  const storage = (() => {
    if (!isDesktop) {
      const current = currentStorage as SyncStorage
      const legacyStore = legacyStorage as SyncStorage

      const api: SyncStorage = {
        getItem: (key) => {
          const raw = current.getItem(key)
          if (raw !== null) {
            const next = normalize(defaults, raw, config.migrate)
            if (next === undefined) {
              current.removeItem(key)
              return null
            }
            if (raw !== next) current.setItem(key, next)
            return next
          }

          for (const legacyKey of legacy) {
            const legacyRaw = legacyStore.getItem(legacyKey)
            if (legacyRaw === null) continue

            const next = normalize(defaults, legacyRaw, config.migrate)
            if (next === undefined) {
              legacyStore.removeItem(legacyKey)
              continue
            }
            current.setItem(key, next)
            legacyStore.removeItem(legacyKey)
            return next
          }

          return null
        },
        setItem: (key, value) => {
          if (timeout) clearTimeout(timeout)
          timeout = setTimeout(() => current.setItem(key, value), 1000)
        },
        removeItem: (key) => {
          current.removeItem(key)
        },
      }

      return api
    }

    const current = currentStorage as AsyncStorage
    const legacyStore = legacyStorage as AsyncStorage | undefined

    const api: AsyncStorage = {
      getItem: async (key) => {
        const raw = await current.getItem(key)
        if (raw !== null) {
          const next = normalize(defaults, raw, config.migrate)
          if (next === undefined) {
            await current.removeItem(key).catch(() => undefined)
            return null
          }
          if (raw !== next) await current.setItem(key, next)
          return next
        }

        if (!legacyStore) return null

        for (const legacyKey of legacy) {
          const legacyRaw = await legacyStore.getItem(legacyKey)
          if (legacyRaw === null) continue

          const next = normalize(defaults, legacyRaw, config.migrate)
          if (next === undefined) {
            await legacyStore.removeItem(legacyKey).catch(() => undefined)
            continue
          }
          await current.setItem(key, next)
          await legacyStore.removeItem(legacyKey)
          return next
        }

        return null
      },
      setItem: async (key, value) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => current.setItem(key, value), 1000)
      },
      removeItem: async (key) => {
        await current.removeItem(key)
      },
    }

    return api
  })()

  const [state, setState, init] = makePersisted(store, { name: config.key, storage })

  const isAsync = init instanceof Promise
  const [ready] = createResource(
    () => init,
    async (initValue) => {
      if (initValue instanceof Promise) await initValue
      return true
    },
    { initialValue: !isAsync },
  )

  onCleanup(() => clearTimeout(timeout))

  return [state, setState, init, () => ready() === true]
}
