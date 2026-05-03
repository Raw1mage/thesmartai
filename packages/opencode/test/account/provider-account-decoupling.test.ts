/**
 * @spec specs/provider-account-decoupling
 *
 * Boundary contract tests for the provider/family/account decoupling:
 *
 *   1. RegistryShapeError    — per-account providerId rejected at registry boundary
 *   2. UnknownFamilyError    — Auth.get on a non-family family arg
 *   3. NoActiveAccountError  — Auth.get(family) with no active account selected
 *
 * The migration boot guard (Phase 7 / DD-6) is covered separately in
 * `migration-boot-guard.test.ts`.
 */
import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Auth } from "../../src/auth"
import { Account } from "../../src/account"
import { Global } from "../../src/global"
import {
  assertFamilyKey,
  RegistryShapeError,
  UnknownFamilyError,
  NoActiveAccountError,
} from "../../src/provider/registry-shape"

describe("registry-shape: assertFamilyKey", () => {
  const known = ["codex", "openai", "anthropic", "gemini-cli"] as const

  test("accepts family-form providerIds", () => {
    expect(() => assertFamilyKey("codex", known)).not.toThrow()
    expect(() => assertFamilyKey("openai", known)).not.toThrow()
    expect(() => assertFamilyKey("gemini-cli", known)).not.toThrow()
  })

  test("rejects per-account providerIds (the 2026-05-02 incident shape)", () => {
    expect(() => assertFamilyKey("codex-subscription-yeats-luo-thesmart-cc", known)).toThrow()
    try {
      assertFamilyKey("codex-subscription-foo", known)
      throw new Error("did not throw")
    } catch (e) {
      expect(RegistryShapeError.isInstance(e)).toBeTrue()
      if (RegistryShapeError.isInstance(e)) {
        expect(e.data.providerId).toBe("codex-subscription-foo")
        expect(e.data.knownFamilies).toEqual([...known])
      }
    }
  })

  test("rejects empty providerId", () => {
    expect(() => assertFamilyKey("", known)).toThrow()
  })
})

describe("Auth.get error contracts (DD-2)", () => {
  test("UnknownFamilyError when family is not registered", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({ $schema: "https://opencode.ai/config.json" }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        let caught: unknown
        try {
          await Auth.get("totally-not-a-family", "any-account")
        } catch (e) {
          caught = e
        }
        expect(UnknownFamilyError.isInstance(caught)).toBeTrue()
      },
    })
  })

  test("NoActiveAccountError when accountId omitted and family has no active", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({ $schema: "https://opencode.ai/config.json" }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Construct a family with accounts but NO activeAccount — the
        // NoActiveAccountError contract path. Auth.set auto-activates, so we
        // bypass the public API and directly clear `activeAccount` on disk,
        // then call Auth.get(family) which re-reads accounts.json.
        await Auth.set("claude-cli", { type: "api", key: "no-active-test" })

        const accountsJsonPath = path.join(Global.Path.user, "accounts.json")
        const raw = JSON.parse(await fs.readFile(accountsJsonPath, "utf8"))
        if (raw.families?.["claude-cli"]) {
          delete raw.families["claude-cli"].activeAccount
        }
        await fs.writeFile(accountsJsonPath, JSON.stringify(raw))
        await Account.refresh()

        let caught: unknown
        try {
          await Auth.get("claude-cli") // <-- single-arg, no accountId
        } catch (e) {
          caught = e
        }
        expect(NoActiveAccountError.isInstance(caught)).toBeTrue()
      },
    })
  })

  test("explicit accountId path returns the matching auth blob", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({ $schema: "https://opencode.ai/config.json" }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await Auth.set("gemini-cli", { type: "api", key: "key-for-test" })
        const accounts = await Account.list("gemini-cli")
        const accountIds = Object.keys(accounts)
        const accountId = accountIds.find((id) => {
          const acc = accounts[id]
          return acc && (acc as any).apiKey === "key-for-test"
        })
        expect(accountId).toBeDefined()

        const auth = await Auth.get("gemini-cli", accountId!)
        expect(auth?.type).toBe("api")
        if (auth?.type === "api") {
          expect((auth as any).key ?? (auth as any).apiKey).toBe("key-for-test")
        }
      },
    })
  })
})
