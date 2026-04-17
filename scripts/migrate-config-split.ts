#!/usr/bin/env bun
/**
 * migrate-config-split.ts
 *
 * One-shot migration for plans/config-restructure Phase 3. Splits a legacy
 * single-file ~/.config/opencode/opencode.json into three purpose-specific
 * files so a parse failure in one section no longer takes down the daemon:
 *
 *   opencode.json   → \$schema + plugin + permissionMode + other boot keys
 *   providers.json  → provider + disabled_providers + model
 *   mcp.json        → mcp
 *
 * Runtime has already been taught to merge the three files (additively; legacy
 * opencode.json still works). This script is purely a convenience for
 * operators who want the blast-radius reduction NOW instead of waiting until
 * their next config edit to split by hand.
 *
 * Usage:
 *   bun run scripts/migrate-config-split.ts --dry-run
 *   bun run scripts/migrate-config-split.ts --apply
 */

import fs from "fs/promises"
import path from "path"
import os from "os"
import { parse as parseJsonc } from "jsonc-parser"

const CONFIG_HOME = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")
const CONFIG_DIR = path.join(CONFIG_HOME, "opencode")
const OPENCODE = path.join(CONFIG_DIR, "opencode.json")
const OPENCODE_JSONC = path.join(CONFIG_DIR, "opencode.jsonc")
const PROVIDERS = path.join(CONFIG_DIR, "providers.json")
const MCP = path.join(CONFIG_DIR, "mcp.json")

// Keys that move out of opencode.json. Anything not listed here stays in
// opencode.json as a boot-critical / low-frequency key.
const PROVIDER_KEYS = ["provider", "disabled_providers", "model"] as const
const MCP_KEYS = ["mcp"] as const

type Config = Record<string, unknown>

async function readJson(filepath: string): Promise<{ text: string; data: Config } | undefined> {
  try {
    const text = await Bun.file(filepath).text()
    const data = parseJsonc(text, undefined as any, { allowTrailingComma: true }) as Config
    if (!data || typeof data !== "object") {
      throw new Error(`${filepath} did not parse into an object`)
    }
    return { text, data }
  } catch (err: any) {
    if (err?.code === "ENOENT") return
    throw err
  }
}

function extract(src: Config, keys: readonly string[]): { moved: Config; remaining: Config } {
  const moved: Config = {}
  const remaining: Config = {}
  for (const [k, v] of Object.entries(src)) {
    if (keys.includes(k)) moved[k] = v
    else remaining[k] = v
  }
  return { moved, remaining }
}

function summarize(section: string, data: Config) {
  const keys = Object.keys(data).filter((k) => k !== "$schema")
  if (keys.length === 0) return `  ${section}.json → (empty, not written)`
  const detail = keys
    .map((k) => {
      const v = (data as any)[k]
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return `${k}(${Object.keys(v).length} entries)`
      }
      if (Array.isArray(v)) return `${k}[${v.length}]`
      return k
    })
    .join(", ")
  return `  ${section}.json ← ${detail}`
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run"

  console.log(`# migrate-config-split (${mode})`)
  console.log(`# config dir:  ${CONFIG_DIR}`)

  // Prefer opencode.json over opencode.jsonc when both exist.
  let sourcePath = OPENCODE
  let source = await readJson(OPENCODE)
  if (!source) {
    sourcePath = OPENCODE_JSONC
    source = await readJson(OPENCODE_JSONC)
  }
  if (!source) {
    console.error(`error: ${OPENCODE} (or .jsonc) not found. Nothing to split.`)
    process.exit(2)
  }

  const existingProviders = await readJson(PROVIDERS)
  const existingMcp = await readJson(MCP)

  const { moved: providerSection, remaining: afterProviders } = extract(source.data, PROVIDER_KEYS)
  const { moved: mcpSection, remaining: nextMain } = extract(afterProviders, MCP_KEYS)

  const nextProviders: Config = {
    $schema: source.data.$schema ?? "https://opencode.ai/config.json",
    ...providerSection,
  }
  const nextMcp: Config = {
    $schema: source.data.$schema ?? "https://opencode.ai/config.json",
    ...mcpSection,
  }

  console.log("")
  console.log("Planned split:")
  console.log(summarize("opencode", nextMain))
  console.log(summarize("providers", nextProviders))
  console.log(summarize("mcp", nextMcp))
  console.log("")

  if (existingProviders || existingMcp) {
    console.log("warning: existing split files detected — they will NOT be overwritten:")
    if (existingProviders) console.log(`  ${PROVIDERS} (${Object.keys(existingProviders.data).length} keys)`)
    if (existingMcp) console.log(`  ${MCP} (${Object.keys(existingMcp.data).length} keys)`)
    console.log("  resolve manually before re-running, or remove them to overwrite.")
    console.log("")
    if (mode === "apply") {
      process.exit(3)
    }
  }

  const nothingToMove = Object.keys(providerSection).length === 0 && Object.keys(mcpSection).length === 0
  if (nothingToMove) {
    console.log("Nothing to move. opencode.json has neither provider/disabled_providers/model nor mcp sections.")
    return
  }

  if (mode === "dry-run") {
    console.log("Dry run — no files written. Re-run with --apply to split.")
    return
  }

  const backupPath = `${sourcePath}.pre-split.bak`
  await fs.copyFile(sourcePath, backupPath)
  console.log(`Backup written: ${backupPath}`)

  // If nextProviders / nextMcp only carry \$schema, skip the write (empty split
  // adds no value). Only touch files the split has something to put in.
  const writes: Array<[string, Config]> = []
  writes.push([sourcePath, nextMain])
  if (Object.keys(providerSection).length > 0) writes.push([PROVIDERS, nextProviders])
  if (Object.keys(mcpSection).length > 0) writes.push([MCP, nextMcp])

  for (const [p, data] of writes) {
    await Bun.write(p, JSON.stringify(data, null, 2) + "\n")
    console.log(`  wrote ${p}`)
  }

  console.log("")
  console.log("Done. If the runtime misbehaves, restore with:")
  console.log(`  mv ${backupPath} ${sourcePath}`)
  console.log(`  rm -f ${PROVIDERS} ${MCP}`)
}

await main()
