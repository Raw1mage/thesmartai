import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import fs from "fs/promises"
import path from "path"

import type { MessageV2 } from "../../session/message-v2"
import { Storage } from "../../storage/storage"
import { LegacyStore } from "../../session/storage/legacy"
import { ConnectionPool } from "../../session/storage/pool"
import { detectFormat, Router } from "../../session/storage/router"
import { StorageAdmin } from "./storage"

const SID_LEGACY = "ses_test_storage_migrate_now_legacy"
const SID_SQLITE = "ses_test_storage_migrate_now_sqlite"
const SID_PENDING = "ses_test_storage_status_pending"

function legacyDir(sessionID: string): string {
  return path.join(path.dirname(ConnectionPool.resolveDbPath(sessionID)), sessionID)
}

function user(sessionID: string, id: string): MessageV2.User {
  return {
    id,
    sessionID,
    role: "user",
    time: { created: 1700000000000 },
    agent: "build",
    model: { providerId: "anthropic", modelID: "claude-opus-4-7" },
  }
}

function assistant(sessionID: string, id: string, parentID: string): MessageV2.Assistant {
  return {
    id,
    sessionID,
    role: "assistant",
    time: { created: 1700000001000, completed: 1700000002000 },
    parentID,
    modelID: "claude-opus-4-7",
    providerId: "anthropic",
    mode: "build",
    agent: "build",
    path: { cwd: "/tmp/repo", root: "/tmp/repo" },
    cost: 0,
    tokens: { total: 7, input: 3, output: 4, reasoning: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  }
}

function textPart(sessionID: string, messageID: string, id: string): MessageV2.Part {
  return { id, sessionID, messageID, type: "text", text: "manual migration", synthetic: false } as MessageV2.Part
}

async function seedLegacy(sessionID: string): Promise<void> {
  const u = user(sessionID, `msg_${sessionID}_u`)
  const a = assistant(sessionID, `msg_${sessionID}_a`, u.id)
  await Storage.write(["session", sessionID], { id: sessionID, projectID: "proj_test" })
  await LegacyStore.upsertMessage(u)
  await LegacyStore.upsertMessage(a)
  await LegacyStore.upsertPart(textPart(sessionID, a.id, `prt_${sessionID}_a`))
}

async function clean(sessionID: string): Promise<void> {
  ConnectionPool.close(sessionID)
  const db = ConnectionPool.resolveDbPath(sessionID)
  for (const p of [db, db + "-wal", db + "-shm", db + ".tmp", db + ".tmp-wal", db + ".tmp-shm"]) {
    await fs.rm(p, { force: true }).catch(() => {})
  }
  await fs.rm(legacyDir(sessionID), { recursive: true, force: true }).catch(() => {})
}

beforeEach(async () => {
  ConnectionPool.closeAll()
  await clean(SID_LEGACY)
  await clean(SID_SQLITE)
  await clean(SID_PENDING)
})

afterEach(async () => {
  ConnectionPool.closeAll()
  await clean(SID_LEGACY)
  await clean(SID_SQLITE)
  await clean(SID_PENDING)
})

describe("storage admin CLI helpers", () => {
  it("reports the legacy pending count and retirement milestone", async () => {
    await seedLegacy(SID_PENDING)

    const result = await StorageAdmin.status()

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("legacy_sessions_pending_count")
    expect(result.stdout).toContain("LegacyStore retirement gate: blocked")
    expect(result.stdout).toContain("legacy_sessions_pending_count == 0 for >= 7 days")
  })

  it("force-migrates one named legacy session without sweeping other legacy sessions", async () => {
    await seedLegacy(SID_LEGACY)
    await seedLegacy(SID_PENDING)

    const result = await StorageAdmin.migrateNow(SID_LEGACY)

    expect(result).toEqual({ stdout: `session ${SID_LEGACY} migrated\nlegacy_sessions_pending_count 1\n`, exitCode: 0 })
    expect(detectFormat(SID_LEGACY).format).toBe("sqlite")
    expect(detectFormat(SID_PENDING).format).toBe("legacy")
    const migrated = await Router.get({ sessionID: SID_LEGACY, messageID: `msg_${SID_LEGACY}_a` })
    expect(migrated.parts[0]?.id).toBe(`prt_${SID_LEGACY}_a`)
  })

  it("is a no-op for already SQLite sessions", async () => {
    await Router.upsertMessage(user(SID_SQLITE, "msg_sqlite"))

    const result = await StorageAdmin.migrateNow(SID_SQLITE)

    expect(result).toEqual({ stdout: `session ${SID_SQLITE} already sqlite; no migration needed\n`, exitCode: 0 })
    expect(detectFormat(SID_SQLITE).format).toBe("sqlite")
  })

  it("does not re-migrate post-rename debris when SQLite is authoritative", async () => {
    await Router.upsertMessage(user(SID_SQLITE, "msg_sqlite"))
    await seedLegacy(SID_SQLITE)

    expect(detectFormat(SID_SQLITE)).toMatchObject({ format: "sqlite", hasLegacyDebris: true })
    const result = await StorageAdmin.migrateNow(SID_SQLITE)

    expect(result).toEqual({ stdout: `session ${SID_SQLITE} already sqlite; no migration needed\n`, exitCode: 0 })
    expect(detectFormat(SID_SQLITE)).toMatchObject({ format: "sqlite", hasLegacyDebris: true })
  })
})
