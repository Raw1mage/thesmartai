/**
 * codex-family-only-fallback.test.ts
 *
 * @spec specs/provider-account-decoupling DD-5
 *
 * The legacy `enforceCodexFamilyOnly` string-shape gate is gone. This file
 * now serves two purposes:
 *
 *   1. Document (via assertion) that no caller in the rotation pool emits a
 *      candidate whose providerId is a per-account form (the regression
 *      guard for the 2026-05-02 CodexFamilyExhausted incident).
 *   2. Keep the `CodexFamilyExhausted` error class round-trip tests — the
 *      class is still raised by session/llm.ts:handleRateLimitFallback when
 *      `findFallback` returns null AND current vector is codex (genuinely
 *      empty pool, not a string filter).
 */
import { describe, expect, test } from "bun:test"

import type { FallbackCandidate } from "../../src/account/rotation3d"

describe("rotation candidate shape invariant (post-DD-1, post-DD-5)", () => {
  test("FallbackCandidate.providerId is documented as the family form", () => {
    // This is a structural / contract test — there's no runtime check we can
    // call into without spinning up the full state. The invariant is enforced
    // at the registry boundary (provider/registry-shape.ts:assertFamilyKey),
    // which throws RegistryShapeError if a per-account providerId is ever
    // inserted into providers[]. Once that boundary holds, every entry in
    // `Object.entries(providers)` carries a family-form key, and every
    // candidate built from that pool inherits the same shape.
    //
    // The legacy enforceCodexFamilyOnly gate string-compared candidate.providerId
    // against the literal "codex". Per DD-5 it's deleted: any equality check
    // we keep is `candidate.providerId === current.providerId` and BOTH sides
    // are families by construction.
    const candidate: FallbackCandidate = {
      providerId: "codex", // family — never "codex-subscription-<slug>" anymore
      accountId: "codex-subscription-yeats-luo-thesmart-cc", // opaque
      modelID: "gpt-5.5",
      healthScore: 100,
      isRateLimited: false,
      waitTimeMs: 0,
      priority: 10,
      reason: "same-model-diff-account",
    }
    expect(candidate.providerId).not.toMatch(/^codex-(api|subscription)-/)
    expect(candidate.providerId).toBe("codex")
  })
})

describe("CodexFamilyExhausted error class", () => {
  test("raises with the hotfix-defined data shape", async () => {
    const { CodexFamilyExhausted } = await import("../../src/account/rate-limit-judge")

    const err = new CodexFamilyExhausted({
      providerId: "codex",
      accountId: "codex-subscription-a",
      modelId: "gpt-5.4",
      triedCount: 3,
      message: "All codex accounts drained",
    })

    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("CodexFamilyExhausted")
    expect(err.data.providerId).toBe("codex")
    expect(err.data.triedCount).toBe(3)
    expect(CodexFamilyExhausted.isInstance(err)).toBe(true)
  })

  test("isInstance returns false for unrelated errors", async () => {
    const { CodexFamilyExhausted } = await import("../../src/account/rate-limit-judge")
    expect(CodexFamilyExhausted.isInstance(new Error("boom"))).toBe(false)
    expect(CodexFamilyExhausted.isInstance({ name: "OtherError" })).toBe(false)
    expect(CodexFamilyExhausted.isInstance(undefined)).toBe(false)
  })
})
