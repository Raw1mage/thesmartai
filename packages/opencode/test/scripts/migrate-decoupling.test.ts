/**
 * @spec specs/provider-account-decoupling DD-6, DD-7
 *
 * End-to-end test of the migration script via subprocess. Uses a synthetic
 * storage tree under a per-test tmpdir and exercises the three subcommands
 * (--dry-run / --apply / --verify) plus the idempotence + already-clean
 * skip paths from test-vectors.json TV5/TV6.
 */
import { describe, expect, test } from "bun:test"
import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import os from "os"

const SCRIPT = path.join(import.meta.dir, "..", "..", "scripts", "migrate-provider-account-decoupling.ts")

async function makeFixture() {
  const root = path.join(os.tmpdir(), `migrate-test-${Math.random().toString(36).slice(2)}`)
  const dataStorage = path.join(root, "data", "storage")
  const config = path.join(root, "config")
  await fs.mkdir(path.join(dataStorage, "message", "ses_X"), { recursive: true })
  await fs.mkdir(path.join(dataStorage, "session", "ses_X"), { recursive: true })
  await fs.mkdir(config, { recursive: true })

  await fs.writeFile(
    path.join(config, "accounts.json"),
    JSON.stringify({
      version: 1,
      families: {
        codex: { accounts: { "codex-subscription-foo": { type: "oauth" } } },
      },
    }),
  )
  await fs.writeFile(
    path.join(dataStorage, "message", "ses_X", "msg_assistant.json"),
    JSON.stringify({
      id: "msg_assistant",
      sessionID: "ses_X",
      role: "assistant",
      providerId: "codex-subscription-foo",
      modelID: "gpt-5.5",
    }),
  )
  await fs.writeFile(
    path.join(dataStorage, "message", "ses_X", "msg_user.json"),
    JSON.stringify({
      id: "msg_user",
      sessionID: "ses_X",
      role: "user",
      model: { providerId: "claude-cli-subscription-x", modelID: "claude-opus-4-7" },
    }),
  )
  await fs.writeFile(
    path.join(dataStorage, "session", "ses_X", "info.json"),
    JSON.stringify({
      id: "ses_X",
      execution: { providerId: "codex-subscription-foo", accountId: "codex-subscription-foo" },
    }),
  )
  await fs.writeFile(
    path.join(dataStorage, "message", "ses_X", "msg_clean.json"),
    JSON.stringify({
      id: "msg_clean",
      sessionID: "ses_X",
      role: "assistant",
      providerId: "codex",
      modelID: "gpt-5.5",
    }),
  )
  return { root, dataStorage, config }
}

describe("migrate-provider-account-decoupling.ts", () => {
  test("dry-run reports planned rewrites without modifying disk (TV5)", async () => {
    const f = await makeFixture()
    try {
      const before = await fs.readFile(path.join(f.dataStorage, "message", "ses_X", "msg_assistant.json"), "utf8")
      const result = await $`bun run ${SCRIPT} --dry-run`.env({ ...process.env, OPENCODE_DATA_HOME: f.root }).text()

      expect(result).toContain("rewrite providerId codex-subscription-foo → codex")
      expect(result).toContain("rewrite model.providerId claude-cli-subscription-x → claude-cli")
      expect(result).toContain("rewrite execution.providerId codex-subscription-foo → codex")
      expect(result).toContain('"wouldRewrite": 3')
      expect(result).toContain('"cleanAlready": 1')

      const after = await fs.readFile(path.join(f.dataStorage, "message", "ses_X", "msg_assistant.json"), "utf8")
      expect(after).toBe(before)
    } finally {
      await fs.rm(f.root, { recursive: true, force: true })
    }
  })

  test("apply rewrites in place + writes marker; verify is then a no-op (TV5+TV6)", async () => {
    const f = await makeFixture()
    try {
      const apply = await $`bun run ${SCRIPT} --apply`.env({ ...process.env, OPENCODE_DATA_HOME: f.root }).text()
      expect(apply).toContain("apply ok: rewrote 3 file(s)")

      const assistant = JSON.parse(
        await fs.readFile(path.join(f.dataStorage, "message", "ses_X", "msg_assistant.json"), "utf8"),
      )
      expect(assistant.providerId).toBe("codex")

      const user = JSON.parse(await fs.readFile(path.join(f.dataStorage, "message", "ses_X", "msg_user.json"), "utf8"))
      expect(user.model.providerId).toBe("claude-cli")

      const sessionInfo = JSON.parse(await fs.readFile(path.join(f.dataStorage, "session", "ses_X", "info.json"), "utf8"))
      expect(sessionInfo.execution.providerId).toBe("codex")
      expect(sessionInfo.execution.accountId).toBe("codex-subscription-foo")

      const marker = JSON.parse(await fs.readFile(path.join(f.dataStorage, ".migration-state.json"), "utf8"))
      expect(marker.version).toBe("1")
      expect(marker.backup_path).toContain("provider-account-decoupling-")

      // TV6: re-running --verify must be a no-op
      const verify = await $`bun run ${SCRIPT} --verify`.env({ ...process.env, OPENCODE_DATA_HOME: f.root }).text()
      expect(verify).toContain("verify ok: no further rewrites needed")
      expect(verify).toContain("skipped: already-clean")
    } finally {
      await fs.rm(f.root, { recursive: true, force: true })
    }
  })

  test("apply twice is idempotent (no rewrites on second run)", async () => {
    const f = await makeFixture()
    try {
      await $`bun run ${SCRIPT} --apply`.env({ ...process.env, OPENCODE_DATA_HOME: f.root }).quiet()
      const second = await $`bun run ${SCRIPT} --apply`.env({ ...process.env, OPENCODE_DATA_HOME: f.root }).text()
      expect(second).toContain("apply ok: rewrote 0 file(s)")
    } finally {
      await fs.rm(f.root, { recursive: true, force: true })
    }
  })
})
