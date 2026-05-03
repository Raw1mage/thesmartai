#!/usr/bin/env bun
/**
 * @spec specs/provider-account-decoupling DD-6, DD-7
 *
 * One-shot storage migrator for the provider-account-decoupling refactor.
 *
 * Rewrites legacy per-account `providerId` strings (e.g.
 * `codex-subscription-yeats-luo-thesmart-cc`) on disk to their canonical
 * family form (e.g. `codex`) so the post-refactor daemon can read every
 * historical session through a single (family, accountId, modelId) lens.
 *
 * Subcommands:
 *   --dry-run (default): walk storage, log every rewrite that WOULD happen,
 *                        write nothing. Safe to run repeatedly.
 *   --apply           : take a backup snapshot, rewrite in place, drop the
 *                       `.migration-state.json` marker.
 *   --verify          : re-walk in read-only mode; non-zero exit if any
 *                       file would still be rewritten.
 *
 * The script is intentionally self-contained — it does NOT import the
 * Account namespace because that pulls in storage init, models.dev fetch,
 * and other side effects that we want to avoid in an offline migration
 * tool. PROVIDERS list + resolveFamilyFromKnown are re-implemented inline
 * (kept in lockstep with src/account/index.ts).
 */
import fs from "fs/promises"
import fsSync from "fs"
import path from "path"
import os from "os"

// --------------------------------------------------------------------------
// Inlined from packages/opencode/src/account/index.ts (kept in lockstep)
// --------------------------------------------------------------------------
const HARDCODED_PROVIDERS = [
  "google-api",
  "openai",
  "claude-cli",
  "gemini-cli",
  "gitlab",
  "github-copilot",
  "gmicloud",
  "opencode",
] as const

function resolveFamilyFromKnown(providerId: string, knownFamilies: readonly string[]): string | undefined {
  if (!providerId) return undefined
  const unique = Array.from(new Set(knownFamilies.filter(Boolean)))
  const set = new Set(unique)
  if (set.has(providerId)) return providerId
  const accountIdMatch = providerId.match(/^(.+)-(api|subscription)-/)
  if (accountIdMatch?.[1] && set.has(accountIdMatch[1])) return accountIdMatch[1]
  const sorted = [...unique].sort((a, b) => b.length - a.length)
  for (const family of sorted) {
    if (providerId.startsWith(`${family}-`)) return family
  }
  return undefined
}

// --------------------------------------------------------------------------
// Paths — must match Global.Path resolution (src/global/index.ts)
// --------------------------------------------------------------------------
function resolveStoragePaths() {
  const fallbackRoot = process.env.OPENCODE_DATA_HOME
  if (fallbackRoot) {
    return {
      data: path.join(fallbackRoot, "data"),
      config: path.join(fallbackRoot, "config"),
    }
  }
  const xdgData = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local/share")
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")
  return {
    data: path.join(xdgData, "opencode"),
    config: path.join(xdgConfig, "opencode"),
  }
}

const PATHS = resolveStoragePaths()
const STORAGE_ROOT = path.join(PATHS.data, "storage")
const MESSAGE_ROOT = path.join(STORAGE_ROOT, "message")
const SESSION_ROOT = path.join(STORAGE_ROOT, "session")
const ACCOUNTS_JSON = path.join(PATHS.config, "accounts.json")
const MARKER_FILE = path.join(STORAGE_ROOT, ".migration-state.json")
const BACKUP_PARENT = path.join(STORAGE_ROOT, ".backup")

// --------------------------------------------------------------------------
// Marker shape
// --------------------------------------------------------------------------
interface MigrationMarker {
  version: "1"
  migrated_at: string
  backup_path: string
}

// --------------------------------------------------------------------------
// Atomic write — tmp + fsync + rename
// --------------------------------------------------------------------------
async function writeAtomic(file: string, content: string) {
  const tmp = `${file}.tmp-migrate-${process.pid}`
  await fs.writeFile(tmp, content, { encoding: "utf8" })
  const fd = await fs.open(tmp, "r+")
  try {
    await fd.sync()
  } finally {
    await fd.close()
  }
  await fs.rename(tmp, file)
}

// --------------------------------------------------------------------------
// Walker — collect every file we need to inspect
// --------------------------------------------------------------------------
async function* walkJson(root: string, depth: number, max: number): AsyncGenerator<string> {
  let entries: import("fs").Dirent[]
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch (e: any) {
    if (e?.code === "ENOENT") return
    throw e
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (depth + 1 < max) {
        yield* walkJson(full, depth + 1, max)
      }
      continue
    }
    if (entry.isFile() && entry.name.endsWith(".json")) yield full
  }
}

// --------------------------------------------------------------------------
// Rewrite — the core mutation. Returns the new shape + a list of audit lines.
// --------------------------------------------------------------------------
interface RewriteResult {
  changed: boolean
  cleanHits: number
  audit: string[]
  next: any
}

type FieldOutcome = "rewrote" | "already-clean" | "absent"

function rewriteProviderField(
  obj: any,
  fieldPath: string,
  knownFamilies: readonly string[],
  audit: string[],
): FieldOutcome {
  const segments = fieldPath.split(".")
  let cursor: any = obj
  for (let i = 0; i < segments.length - 1; i++) {
    if (cursor == null || typeof cursor !== "object") return "absent"
    cursor = cursor[segments[i]]
  }
  if (cursor == null || typeof cursor !== "object") return "absent"
  const leaf = segments[segments.length - 1]
  const value = cursor[leaf]
  if (typeof value !== "string" || value.length === 0) return "absent"
  const family = resolveFamilyFromKnown(value, knownFamilies)
  if (!family) return "absent"
  if (family === value) return "already-clean"
  audit.push(`rewrite ${fieldPath} ${value} → ${family}`)
  cursor[leaf] = family
  return "rewrote"
}

const PROVIDER_FIELD_PATHS = [
  // Assistant message — top-level providerId
  "providerId",
  // User message — nested model.providerId
  "model.providerId",
  // Session info — execution.providerId
  "execution.providerId",
] as const

function rewriteFile(input: any, knownFamilies: readonly string[]): RewriteResult {
  const audit: string[] = []
  const next = JSON.parse(JSON.stringify(input))
  let changed = false
  let cleanHits = 0
  for (const fp of PROVIDER_FIELD_PATHS) {
    const outcome = rewriteProviderField(next, fp, knownFamilies, audit)
    if (outcome === "rewrote") changed = true
    else if (outcome === "already-clean") cleanHits += 1
  }
  return { changed, cleanHits, audit, next }
}

// --------------------------------------------------------------------------
// Sanity-check accounts.json families[] keys
// --------------------------------------------------------------------------
async function readAccountsJson(): Promise<{ version?: number; families?: Record<string, unknown> }> {
  if (!fsSync.existsSync(ACCOUNTS_JSON)) return {}
  const raw = await fs.readFile(ACCOUNTS_JSON, "utf8")
  return JSON.parse(raw)
}

function sanityCheckAccountsJson(
  accounts: { families?: Record<string, unknown> },
  knownFamilies: readonly string[],
): void {
  const families = accounts.families ?? {}
  const set = new Set(knownFamilies)
  for (const key of Object.keys(families)) {
    if (!set.has(key)) {
      throw new Error(
        `accounts.json families[].${key} is not a known family. ` +
          `knownFamilies=${JSON.stringify(knownFamilies)}. ` +
          `Refusing to migrate against an unrecognised family key.`,
      )
    }
  }
}

// --------------------------------------------------------------------------
// Backup — recursive copy of accounts.json + storage/{session,message}
// --------------------------------------------------------------------------
async function backupSnapshot(stamp: string): Promise<string> {
  const dest = path.join(BACKUP_PARENT, `provider-account-decoupling-${stamp}`)
  await fs.mkdir(dest, { recursive: true })
  // accounts.json
  if (fsSync.existsSync(ACCOUNTS_JSON)) {
    await fs.copyFile(ACCOUNTS_JSON, path.join(dest, "accounts.json"))
  }
  // storage/session and storage/message — recursive cp
  for (const sub of ["session", "message"] as const) {
    const src = path.join(STORAGE_ROOT, sub)
    if (!fsSync.existsSync(src)) continue
    await fs.cp(src, path.join(dest, sub), { recursive: true, errorOnExist: false, force: true })
  }
  return dest
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
type Mode = "dry-run" | "apply" | "verify"

async function deriveKnownFamilies(): Promise<string[]> {
  const accounts = await readAccountsJson()
  const fromStorage = Object.keys(accounts.families ?? {})
  return Array.from(new Set([...HARDCODED_PROVIDERS, ...fromStorage]))
}

async function run(mode: Mode) {
  const knownFamilies = await deriveKnownFamilies()
  const accounts = await readAccountsJson()
  sanityCheckAccountsJson(accounts, knownFamilies)

  let totalScanned = 0
  let totalChanged = 0
  let totalSkipped = 0
  const auditLog: string[] = []
  const filesToWrite: { file: string; payload: string }[] = []

  const targets: { root: string; depth: number }[] = [
    // storage/message/<sessionID>/<messageID>.json — depth 2
    { root: MESSAGE_ROOT, depth: 2 },
    // storage/session/<sessionID>/info.json (and any other .json under the session dir)
    { root: SESSION_ROOT, depth: 3 },
  ]

  for (const target of targets) {
    for await (const file of walkJson(target.root, 0, target.depth)) {
      totalScanned += 1
      let raw: string
      try {
        raw = await fs.readFile(file, "utf8")
      } catch {
        continue
      }
      let parsed: any
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }
      const result = rewriteFile(parsed, knownFamilies)
      if (!result.changed) {
        totalSkipped += 1
        if (result.cleanHits > 0) auditLog.push(`${file}: skipped: already-clean`)
        continue
      }
      totalChanged += 1
      for (const line of result.audit) auditLog.push(`${file}: ${line}`)
      const next = JSON.stringify(result.next, null, 2)
      filesToWrite.push({ file, payload: next })
    }
  }

  const summary = {
    mode,
    storageRoot: STORAGE_ROOT,
    accountsJson: ACCOUNTS_JSON,
    knownFamilies,
    scanned: totalScanned,
    wouldRewrite: totalChanged,
    cleanAlready: totalSkipped,
  }

  console.log(JSON.stringify({ summary }, null, 2))
  for (const line of auditLog) console.log(line)

  if (mode === "verify") {
    if (totalChanged > 0) {
      console.error(`verify failed: ${totalChanged} file(s) would still be rewritten`)
      process.exit(1)
    }
    console.log("verify ok: no further rewrites needed")
    return
  }

  if (mode === "dry-run") {
    console.log("\n[dry-run] no files written; pass --apply to commit")
    return
  }

  // mode === "apply"
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = await backupSnapshot(stamp)
  console.log(`backup snapshot written to ${backupPath}`)

  for (const { file, payload } of filesToWrite) {
    await writeAtomic(file, payload)
  }

  const marker: MigrationMarker = {
    version: "1",
    migrated_at: new Date().toISOString(),
    backup_path: backupPath,
  }
  await writeAtomic(MARKER_FILE, JSON.stringify(marker, null, 2))
  console.log(`marker written: ${MARKER_FILE}`)
  console.log(`apply ok: rewrote ${totalChanged} file(s); ${totalSkipped} already clean`)
}

const args = process.argv.slice(2)
let mode: Mode = "dry-run"
for (const a of args) {
  if (a === "--dry-run") mode = "dry-run"
  else if (a === "--apply") mode = "apply"
  else if (a === "--verify") mode = "verify"
  else if (a === "--help" || a === "-h") {
    console.log("Usage: bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts [--dry-run|--apply|--verify]")
    process.exit(0)
  } else {
    console.error(`unknown flag: ${a}`)
    process.exit(2)
  }
}

await run(mode)
