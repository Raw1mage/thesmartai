#!/usr/bin/env bun

import { Global } from "../src/global"
import fs from "fs"
import os from "os"
import path from "path"
import { $ } from "bun"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
process.chdir(repoRoot)

const pkgPath = path.join(repoRoot, "package.json")
const pkgJson = await Bun.file(pkgPath).json()
const pkgName = pkgJson.name as string

// @event_2026-02-07_install: build + system install flow

const installDir = (() => {
  if (process.env.OPENCODE_INSTALL_DIR) {
    return path.resolve(process.env.OPENCODE_INSTALL_DIR)
  }

  if (process.env.XDG_BIN_DIR) {
    return path.resolve(process.env.XDG_BIN_DIR)
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? ""
    if (localAppData) {
      return path.resolve(localAppData, "bin")
    }
    return path.resolve(repoRoot, "bin")
  }

  return "/usr/local/bin"
})()

const binaryName = process.platform === "win32" ? "opencode.exe" : "opencode"
const osSegment = process.platform === "win32" ? "windows" : process.platform
const archMap: Record<string, string | undefined> = {
  x64: "x64",
  arm64: "arm64",
}
const archSegment = archMap[process.arch]

if (!archSegment) {
  throw new Error(`unsupported architecture: ${process.arch}`)
}

const targetName = `${pkgName}-${osSegment}-${archSegment}`
const builtBinaryPath = path.join(repoRoot, "dist", targetName, "bin", binaryName)

const ensureDir = (dir: string) => {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (error) {
    if ((error as { code?: string }).code !== "EEXIST") {
      throw error
    }
  }
}

const fsPromises = fs.promises
const templatesDir = path.join(repoRoot, "templates")
const manifestPath = path.join(templatesDir, "manifest.json")
const TEMPLATE_SENSITIVE_FILES = new Set(["accounts.json", "mcp-auth.json"])
const LEGACY_OPENCODE_DIR = path.join(os.homedir(), ".opencode")

type TemplateTarget = "config" | "state" | "data"

const resolveTargetDir = (target?: TemplateTarget) => {
  switch (target) {
    case "state":
      return Global.Path.state
    case "data":
      return Global.Path.data
    case "config":
    default:
      return Global.Path.config
  }
}

const loadManifestEntries = async (): Promise<TemplateManifestEntry[]> => {
  const manifestExists = await Bun.file(manifestPath).exists()
  if (!manifestExists) return []

  try {
    const manifest = JSON.parse(await Bun.file(manifestPath).text())
    if (Array.isArray(manifest.entries)) return manifest.entries
    if (Array.isArray(manifest)) return manifest
  } catch (error) {
    console.error("無法解析 templates/manifest.json", error)
  }
  return []
}

const movePath = async (src: string, dest: string) => {
  ensureDir(path.dirname(dest))
  try {
    await fsPromises.rename(src, dest)
    return
  } catch (error) {
    if ((error as { code?: string }).code !== "EXDEV") throw error
  }

  const stat = await fsPromises.lstat(src)
  if (stat.isDirectory()) {
    await fsPromises.cp(src, dest, { recursive: true })
    await fsPromises.rm(src, { recursive: true, force: true })
  } else {
    await fsPromises.copyFile(src, dest)
    await fsPromises.rm(src, { force: true })
  }
}

const cleanupToCyclebin = async (entries: TemplateManifestEntry[]) => {
  // @event_2026-02-07_install: cleanup clutter to cyclebin (XDG-aware)
  const targets: TemplateTarget[] = ["config", "state", "data"]
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const cyclebinRoot = path.join(Global.Path.state, "cyclebin")

  const manifestFilesByTarget = new Map<TemplateTarget, Set<string>>()
  for (const target of targets) manifestFilesByTarget.set(target, new Set())

  for (const entry of entries) {
    const target = entry.target ?? "config"
    const firstSegment = entry.path.split(/[/\\]/)[0]
    manifestFilesByTarget.get(target)?.add(firstSegment)
  }

  const protectedByTarget = (target: TemplateTarget) => {
    const protectedPaths = new Set(manifestFilesByTarget.get(target))
    if (target === "state") protectedPaths.add("cyclebin")
    if (target === "data") {
      protectedPaths.add("log")
      protectedPaths.add("generated-images")
      protectedPaths.add("node_modules")
      protectedPaths.add("bun.lock")
    }
    return protectedPaths
  }

  for (const target of targets) {
    const root = resolveTargetDir(target)
    if (!fs.existsSync(root)) continue

    const entriesInRoot = await fsPromises.readdir(root, { withFileTypes: true })
    let movedCount = 0
    const protectedPaths = protectedByTarget(target)

    for (const entry of entriesInRoot) {
      if (protectedPaths.has(entry.name)) continue

      if (movedCount === 0) ensureDir(path.join(cyclebinRoot, timestamp, target))

      const src = path.join(root, entry.name)
      const dest = path.join(cyclebinRoot, timestamp, target, entry.name)

      try {
        await movePath(src, dest)
        console.log(`已將雜物 ${entry.name} 移至 cyclebin/${timestamp}/${target}/`)
        movedCount++
      } catch (error) {
        console.warn(`無法移動 ${entry.name} 到 cyclebin:`, error)
      }
    }

    if (movedCount > 0) {
      console.log(`清理完成（${target}），共移動 ${movedCount} 個項目至 cyclebin`)
    }
  }
}

type TemplateManifestEntry = {
  path: string
  description?: string
  sensitive?: boolean
  target?: TemplateTarget
}

const migrateLegacyOpencode = async (entries: TemplateManifestEntry[]) => {
  // @event_2026-02-07_install: migrate legacy ~/.opencode to XDG
  if (!fs.existsSync(LEGACY_OPENCODE_DIR)) return

  const legacyRuntimeDirs = [
    { name: "generated-images", dest: path.join(Global.Path.data, "generated-images") },
    { name: "logs", dest: Global.Path.log },
    { name: "node_modules", dest: path.join(Global.Path.data, "node_modules") },
    { name: "cyclebin", dest: path.join(Global.Path.state, "cyclebin", "legacy-import") },
  ]

  const legacyFiles = [
    {
      name: "openai-codex-accounts.json",
      dest: path.join(Global.Path.config, "openai-codex-accounts.json"),
      sensitive: true,
    },
    {
      name: "openai-codex-auth-config.json",
      dest: path.join(Global.Path.config, "openai-codex-auth-config.json"),
      sensitive: true,
    },
    {
      name: "model-status.json",
      dest: path.join(Global.Path.state, "model-status.json"),
    },
  ]

  for (const entry of entries) {
    const src = path.join(LEGACY_OPENCODE_DIR, entry.path)
    if (!fs.existsSync(src)) continue
    const destRoot = resolveTargetDir(entry.target ?? "config")
    const dest = path.join(destRoot, entry.path)

    // @event_2026-02-07_install: improved migration logic
    // Overwrite if target is missing, empty, or a small default template
    // especially for files like AGENTS.md where user content is likely larger.
    const destExists = fs.existsSync(dest)
    if (destExists) {
      const srcStat = await fsPromises.stat(src)
      const destStat = await fsPromises.stat(dest)
      if (destStat.size >= srcStat.size && destStat.size > 100) {
        continue
      }
      console.log(`正在用較大的 legacy 檔案覆蓋 XDG 預設檔: ${entry.path}`)
    }

    try {
      await movePath(src, dest)
      if (entry.sensitive || TEMPLATE_SENSITIVE_FILES.has(path.basename(entry.path))) {
        await fsPromises.chmod(dest, 0o600).catch(() => {})
      }
      console.log(`已搬遷 legacy 設定 ${entry.path} 到 ${dest}`)
    } catch (error) {
      console.warn(`無法搬遷 legacy 設定 ${entry.path}:`, error)
    }
  }

  for (const legacy of legacyRuntimeDirs) {
    const src = path.join(LEGACY_OPENCODE_DIR, legacy.name)
    if (!fs.existsSync(src)) continue
    if (fs.existsSync(legacy.dest)) continue
    try {
      await movePath(src, legacy.dest)
      console.log(`已搬遷 legacy 資產 ${legacy.name} 到 ${legacy.dest}`)
    } catch (error) {
      console.warn(`無法搬遷 legacy 資產 ${legacy.name}:`, error)
    }
  }

  for (const legacy of legacyFiles) {
    const src = path.join(LEGACY_OPENCODE_DIR, legacy.name)
    if (!fs.existsSync(src)) continue
    if (fs.existsSync(legacy.dest)) continue
    try {
      await movePath(src, legacy.dest)
      if (legacy.sensitive) await fsPromises.chmod(legacy.dest, 0o600).catch(() => {})
      console.log(`已搬遷 legacy 檔案 ${legacy.name} 到 ${legacy.dest}`)
    } catch (error) {
      console.warn(`無法搬遷 legacy 檔案 ${legacy.name}:`, error)
    }
  }

  const remaining = await fsPromises.readdir(LEGACY_OPENCODE_DIR, { withFileTypes: true })
  if (remaining.length === 0) {
    await fsPromises.rmdir(LEGACY_OPENCODE_DIR).catch(() => {})
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const legacyBin = path.join(Global.Path.state, "cyclebin", timestamp, "legacy-opencode")
  ensureDir(legacyBin)

  for (const entry of remaining) {
    const src = path.join(LEGACY_OPENCODE_DIR, entry.name)
    const dest = path.join(legacyBin, entry.name)
    try {
      await movePath(src, dest)
      console.log(`已封存 legacy 項目 ${entry.name} 到 ${legacyBin}`)
    } catch (error) {
      console.warn(`無法封存 legacy 項目 ${entry.name}:`, error)
    }
  }

  await fsPromises.rmdir(LEGACY_OPENCODE_DIR).catch(() => {})
}

const installTemplates = async (entries: TemplateManifestEntry[]) => {
  // @event_2026-02-07_install: template manifest-driven initialization (XDG targets)
  if (entries.length === 0) return

  for (const entry of entries) {
    const relativePath = entry.path
    const src = path.join(templatesDir, relativePath)
    const targetRoot = resolveTargetDir(entry.target ?? "config")
    const dest = path.join(targetRoot, relativePath)
    if (!(await Bun.file(src).exists())) continue
    if (await Bun.file(dest).exists()) continue
    ensureDir(path.dirname(dest))
    await Bun.write(dest, Bun.file(src))
    if (entry.sensitive || TEMPLATE_SENSITIVE_FILES.has(path.basename(relativePath))) {
      await fsPromises.chmod(dest, 0o600)
    }
    console.log(`初始化設定檔 ${relativePath} 到 ${dest}`)
  }
}

const runBuild = async () => {
  console.log("正在執行 bun run build --single --skip-install")
  await $`bun run build --single --skip-install`
}

const installBinary = () => {
  if (!fs.existsSync(builtBinaryPath)) {
    throw new Error(`找不到建置輸出: ${builtBinaryPath}`)
  }

  ensureDir(installDir)

  const destination = path.join(installDir, binaryName)
  console.log(`將 ${path.basename(builtBinaryPath)} 安裝到 ${destination}`)

  try {
    fs.copyFileSync(builtBinaryPath, destination)
    fs.chmodSync(destination, 0o755)
  } catch (error) {
    if ((error as { code?: string }).code === "EACCES") {
      throw new Error(`權限不足，請使用具有寫入 ${installDir} 權限的帳號（例如 sudo）重新執行 bun run install`)
    }
    throw error
  }
  console.log("安裝完成")
}

try {
  const entries = await loadManifestEntries()
  await runBuild()
  installBinary()
  await migrateLegacyOpencode(entries)
  await cleanupToCyclebin(entries)
  await installTemplates(entries)
} catch (error) {
  console.error("安裝失敗:", error)
  process.exit(1)
}
