import { describe, expect, it } from "bun:test"
import { shouldAutoOpenProvidersPage } from "./dialog-admin-auto-open"

describe("shouldAutoOpenProvidersPage", () => {
  it("returns true for initial empty activities state", () => {
    expect(
      shouldAutoOpenProvidersPage({
        didAutoOpenProviders: false,
        page: "activities",
        step: "root",
        activityTotal: 0,
      }),
    ).toBe(true)
  })

  it("returns false once auto-open already ran", () => {
    expect(
      shouldAutoOpenProvidersPage({
        didAutoOpenProviders: true,
        page: "activities",
        step: "root",
        activityTotal: 0,
      }),
    ).toBe(false)
  })

  it("returns false when activities already have entries", () => {
    expect(
      shouldAutoOpenProvidersPage({
        didAutoOpenProviders: false,
        page: "activities",
        step: "root",
        activityTotal: 2,
      }),
    ).toBe(false)
  })

  it("returns false for provider deep-link flow", () => {
    expect(
      shouldAutoOpenProvidersPage({
        didAutoOpenProviders: false,
        targetProviderID: "openai",
        page: "activities",
        step: "root",
        activityTotal: 0,
      }),
    ).toBe(false)
  })

  it("returns false outside initial root activities page", () => {
    expect(
      shouldAutoOpenProvidersPage({
        didAutoOpenProviders: false,
        page: "providers",
        step: "root",
        activityTotal: 0,
      }),
    ).toBe(false)

    expect(
      shouldAutoOpenProvidersPage({
        didAutoOpenProviders: false,
        page: "activities",
        step: "account_select",
        activityTotal: 0,
      }),
    ).toBe(false)
  })
})
