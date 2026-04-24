/**
 * transport-ws.test.ts — WS upgrade header fingerprint (Phase 1 of
 * codex-fingerprint-alignment).
 *
 * Covers the two inline fixes that the WS transport needed to match
 * upstream codex-rs first-party classification:
 *   - User-Agent must be present on WS upgrade (was missing; HTTP already had it)
 *   - ChatGPT-Account-Id must be TitleCase (was lowercase chatgpt-account-id)
 *
 * Phase 2 will consolidate this into buildHeaders({ isWebSocket: true }),
 * at which point this test stays but should still pass unchanged.
 */
import { describe, expect, test } from "bun:test"
import { buildWsUpgradeHeaders } from "./transport-ws"

describe("buildWsUpgradeHeaders fingerprint", () => {
  const base = {
    accessToken: "access-abc",
    accountId: "codex-subscription-test",
  }

  test("includes TitleCase ChatGPT-Account-Id (not lowercase)", () => {
    const h = buildWsUpgradeHeaders(base)
    expect(h["ChatGPT-Account-Id"]).toBe("codex-subscription-test")
    expect(h["chatgpt-account-id"]).toBeUndefined()
  })

  test("includes User-Agent when provided", () => {
    const ua = "codex_cli_rs/0.125.0-alpha.1 (Linux 5.15.0; x86_64) terminal"
    const h = buildWsUpgradeHeaders({ ...base, userAgent: ua })
    expect(h["User-Agent"]).toBe(ua)
  })

  test("UA prefix matches originator (first-party classifier contract)", () => {
    const ua = "codex_cli_rs/0.125.0-alpha.1 (Linux 5.15.0; x86_64) terminal"
    const h = buildWsUpgradeHeaders({ ...base, userAgent: ua })
    expect(h["originator"]).toBe("codex_cli_rs")
    expect(h["User-Agent"]?.startsWith(h["originator"] + "/")).toBe(true)
  })

  test("omits User-Agent when not provided (caller responsibility)", () => {
    const h = buildWsUpgradeHeaders(base)
    expect(h["User-Agent"]).toBeUndefined()
  })

  test("always emits Authorization + originator + OpenAI-Beta", () => {
    const h = buildWsUpgradeHeaders(base)
    expect(h["Authorization"]).toBe("Bearer access-abc")
    expect(h["originator"]).toBe("codex_cli_rs")
    expect(h["OpenAI-Beta"]).toMatch(/^responses_websockets=\d{4}-\d{2}-\d{2}$/)
  })

  test("x-codex-turn-state flows through when provided", () => {
    const h = buildWsUpgradeHeaders({ ...base, turnState: "turn-xyz" })
    expect(h["x-codex-turn-state"]).toBe("turn-xyz")
  })

  test("no accountId → no ChatGPT-Account-Id header at all", () => {
    const h = buildWsUpgradeHeaders({ accessToken: "t" })
    expect(h["ChatGPT-Account-Id"]).toBeUndefined()
    expect(h["chatgpt-account-id"]).toBeUndefined()
  })
})
